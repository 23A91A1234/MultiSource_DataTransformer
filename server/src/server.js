import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { connectDB } from './db/connect.js';
import { RawSource } from './db/models/RawSource.js';
import { CandidateProfile } from './db/models/CandidateProfile.js';
import { PipelineRun } from './db/models/PipelineRun.js';
import { OutputConfig } from './db/models/OutputConfig.js';
import { runPipeline, DEFAULT_OUTPUT_CONFIG } from './pipeline/index.js';
import { projectProfile } from './pipeline/project.js';
import { validateCanonical, validateProjected } from './pipeline/validate.js';
import { OutputConfigSchema } from './schema/outputConfig.js';
import mongoose from 'mongoose';

dotenv.config();

// Prevent uncaught exceptions and unhandled rejections from crashing the process
process.on('uncaughtException', (error) => {
  console.error('CRITICAL: Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup multer for multi-file upload (in-memory storage)
const storage = multer.memoryStorage();
const upload = multer(storage);

// Global Error Handler formatting helper
function formatError(status, code, message, details = null) {
  return {
    status,
    body: {
      error: {
        code,
        message,
        details
      }
    }
  };
}

// -------------------------------------------------------------
// POST /api/pipeline/run
// Runs the full pipeline, persists to MongoDB, and projects to output.
// -------------------------------------------------------------
app.post('/api/pipeline/run', upload.any(), async (req, res, next) => {
  let runRecord = null;
  try {
    let sources = [];
    let config = DEFAULT_OUTPUT_CONFIG;

    // 1. Check if files were uploaded via multipart/form-data
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        sources.push({
          filename: file.originalname,
          content: file.buffer
        });
      });
    }

    // 2. Parse form body inputs
    if (req.body) {
      // Direct sources list in JSON format
      if (req.body.sources) {
        let directSources = req.body.sources;
        if (typeof directSources === 'string') {
          directSources = JSON.parse(directSources);
        }
        if (Array.isArray(directSources)) {
          directSources.forEach(s => {
            sources.push({
              filename: s.filename,
              content: s.content ? Buffer.from(s.content, 'utf-8') : null,
              url: s.url
            });
          });
        }
      }

      // Add individual URL fields
      if (req.body.github_url) {
        sources.push({
          filename: 'github_api',
          url: req.body.github_url,
          content: req.body.github_url
        });
      }

      if (req.body.linkedin_url) {
        sources.push({
          filename: 'linkedin_json',
          url: req.body.linkedin_url,
          content: req.body.linkedin_url
        });
      }

      // Parse custom config
      if (req.body.config) {
        let configObj = req.body.config;
        if (typeof configObj === 'string') {
          configObj = JSON.parse(configObj);
        }
        
        // Validate OutputConfig schema
        const validatedConfig = OutputConfigSchema.safeParse(configObj);
        if (!validatedConfig.success) {
          const err = formatError(400, 'MALFORMED_CONFIG', 'Invalid configuration provided.', validatedConfig.error.flatten());
          return res.status(err.status).json(err.body);
        }
        config = validatedConfig.data;
      }
    }

    if (sources.length === 0) {
      const err = formatError(400, 'MISSING_INPUT', 'At least one source file or URL is required.');
      return res.status(err.status).json(err.body);
    }

    const hasDB = mongoose.connection.readyState === 1;

    if (hasDB) {
      // Create partial Run Record
      runRecord = await PipelineRun.create({
        status: 'partial',
        started_at: new Date()
      });
    }

    // Run Pipeline
    const result = await runPipeline(sources, config);

    if (hasDB && runRecord) {
      // Save Raw Sources
      const rawSourceDocs = result.rawRecords.map(raw => ({
        run_id: runRecord._id,
        source_id: raw.source_id,
        source_type: raw.source_type,
        candidate_hint: raw.candidate_hint,
        fields: raw.fields,
        raw_confidence: raw.raw_confidence
      }));
      await RawSource.insertMany(rawSourceDocs);

      // Save Canonical Profiles
      const profileDocs = result.canonicalProfiles.map(profile => ({
        run_id: runRecord._id,
        candidate_id: profile.candidate_id,
        profile: profile
      }));
      await CandidateProfile.insertMany(profileDocs);

      // Complete run record
      runRecord.status = 'completed';
      runRecord.source_count = rawSourceDocs.length;
      runRecord.profile_count = profileDocs.length;
      runRecord.warnings = result.warnings;
      runRecord.finished_at = new Date();
      await runRecord.save();
    }

    res.status(200).json({
      run_id: runRecord ? runRecord._id : 'no-persist-run',
      profiles: result.projectedProfiles,
      warnings: result.warnings
    });

  } catch (error) {
    console.error('Pipeline run error:', error);
    if (runRecord) {
      runRecord.status = 'failed';
      runRecord.finished_at = new Date();
      await runRecord.save().catch(console.error);
    }

    if (error.code === 'VALIDATION_ERROR') {
      const err = formatError(422, 'VALIDATION_FAILURE', error.message, error.details);
      return res.status(err.status).json(err.body);
    }

    const err = formatError(500, 'UNEXPECTED_ERROR', 'Internal server error occurred.', error.message);
    res.status(err.status).json(err.body);
  }
});

// -------------------------------------------------------------
// POST /api/pipeline/project/:runId
// Re-projects already stored profiles with a new configuration.
// -------------------------------------------------------------
app.post('/api/pipeline/project/:runId', async (req, res) => {
  const { runId } = req.params;
  try {
    if (mongoose.connection.readyState !== 1) {
      const err = formatError(503, 'DATABASE_UNAVAILABLE', 'Database not connected. Reprojection requires database persistence.');
      return res.status(err.status).json(err.body);
    }

    if (!mongoose.Types.ObjectId.isValid(runId)) {
      const err = formatError(400, 'INVALID_RUN_ID', 'Invalid Run ID format.');
      return res.status(err.status).json(err.body);
    }

    // 1. Validate custom config
    if (!req.body.config) {
      const err = formatError(400, 'MISSING_CONFIG', 'A runtime config is required.');
      return res.status(err.status).json(err.body);
    }

    const configParsed = OutputConfigSchema.safeParse(req.body.config);
    if (!configParsed.success) {
      const err = formatError(400, 'MALFORMED_CONFIG', 'Invalid configuration provided.', configParsed.error.flatten());
      return res.status(err.status).json(err.body);
    }
    const config = configParsed.data;

    // 2. Fetch run record
    const run = await PipelineRun.findById(runId);
    if (!run) {
      const err = formatError(404, 'RUN_NOT_FOUND', 'Pipeline run not found.');
      return res.status(err.status).json(err.body);
    }

    // 3. Retrieve stored canonical profiles
    const dbProfiles = await CandidateProfile.find({ run_id: runId });
    if (dbProfiles.length === 0) {
      return res.status(200).json({ run_id: runId, profiles: [], warnings: ['No profiles exist for this run'] });
    }

    const projectedProfiles = [];
    const warnings = [];

    // 4. Apply projection (including Zod re-validation of DB data)
    for (const dbProf of dbProfiles) {
      const rawProfile = dbProf.profile;

      // Re-validate against Canonical schema to defend against DB edits/drift
      const canonicalProfile = validateCanonical(rawProfile);

      // Perform projection
      const { output, warnings: projWarnings } = projectProfile(canonicalProfile, config);
      if (projWarnings) {
        warnings.push(...projWarnings);
      }

      // Validate projected output
      const validatedProjected = validateProjected(output, config);
      projectedProfiles.push(validatedProjected);
    }

    // 5. Update Run configuration reference if saved config exists (optional detail)
    res.status(200).json({
      run_id: runId,
      profiles: projectedProfiles,
      warnings: warnings
    });

  } catch (error) {
    console.error('Reprojection error:', error);
    if (error.code === 'VALIDATION_ERROR') {
      const err = formatError(422, 'VALIDATION_FAILURE', error.message, error.details);
      return res.status(err.status).json(err.body);
    }
    const err = formatError(500, 'UNEXPECTED_ERROR', 'Reprojection failed.', error.message);
    res.status(err.status).json(err.body);
  }
});

// -------------------------------------------------------------
// GET /api/runs
// Lists past pipeline runs.
// -------------------------------------------------------------
app.get('/api/runs', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json([]);
    }
    const runs = await PipelineRun.find().sort({ started_at: -1 });
    res.status(200).json(runs);
  } catch (error) {
    const err = formatError(500, 'UNEXPECTED_ERROR', 'Failed to retrieve past runs.', error.message);
    res.status(err.status).json(err.body);
  }
});

// -------------------------------------------------------------
// GET /api/runs/:runId
// Returns full stored profiles and metadata for a run.
// -------------------------------------------------------------
app.get('/api/runs/:runId', async (req, res) => {
  const { runId } = req.params;
  try {
    if (mongoose.connection.readyState !== 1) {
      const err = formatError(503, 'DATABASE_UNAVAILABLE', 'Database not connected.');
      return res.status(err.status).json(err.body);
    }

    if (!mongoose.Types.ObjectId.isValid(runId)) {
      const err = formatError(400, 'INVALID_RUN_ID', 'Invalid Run ID format.');
      return res.status(err.status).json(err.body);
    }

    const run = await PipelineRun.findById(runId);
    if (!run) {
      const err = formatError(404, 'RUN_NOT_FOUND', 'Pipeline run not found.');
      return res.status(err.status).json(err.body);
    }

    const rawSources = await RawSource.find({ run_id: runId });
    const profiles = await CandidateProfile.find({ run_id: runId });

    res.status(200).json({
      run,
      sources: rawSources,
      profiles: profiles.map(p => p.profile)
    });
  } catch (error) {
    const err = formatError(500, 'UNEXPECTED_ERROR', 'Failed to fetch run details.', error.message);
    res.status(err.status).json(err.body);
  }
});

// -------------------------------------------------------------
// POST /api/sources/validate
// Validates a single source file/payload.
// -------------------------------------------------------------
app.post('/api/sources/validate', upload.single('file'), async (req, res) => {
  try {
    let content = req.body.content;
    let filename = req.body.filename || 'unknown';

    if (req.file) {
      content = req.file.buffer;
      filename = req.file.originalname;
    }

    if (!content) {
      const err = formatError(400, 'MISSING_CONTENT', 'Content or file is required.');
      return res.status(err.status).json(err.body);
    }

    // Run basic validation: detect format
    const { detectSourceType } = await import('./pipeline/detect.js');
    const detectedType = detectSourceType(content, filename);

    res.status(200).json({
      valid: true,
      detected_type: detectedType,
      filename
    });
  } catch (error) {
    const err = formatError(500, 'UNEXPECTED_ERROR', 'Validation failed.', error.message);
    res.status(err.status).json(err.body);
  }
});

// -------------------------------------------------------------
// GET /api/config/default
// Returns default configuration.
// -------------------------------------------------------------
app.get('/api/config/default', (req, res) => {
  res.status(200).json(DEFAULT_OUTPUT_CONFIG);
});

// -------------------------------------------------------------
// GET /api/configs
// Lists saved OutputConfigs.
// -------------------------------------------------------------
app.get('/api/configs', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json([]);
    }
    const configs = await OutputConfig.find().sort({ created_at: -1 });
    res.status(200).json(configs);
  } catch (error) {
    const err = formatError(500, 'UNEXPECTED_ERROR', 'Failed to load configurations.', error.message);
    res.status(err.status).json(err.body);
  }
});

// -------------------------------------------------------------
// POST /api/configs
// Saves a named OutputConfig.
// -------------------------------------------------------------
app.post('/api/configs', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const err = formatError(503, 'DATABASE_UNAVAILABLE', 'Database not connected. Saving configuration requires database persistence.');
      return res.status(err.status).json(err.body);
    }

    const { name, config } = req.body;
    if (!name || !config) {
      const err = formatError(400, 'MISSING_DATA', 'Name and configuration config object are required.');
      return res.status(err.status).json(err.body);
    }

    const validatedConfig = OutputConfigSchema.safeParse(config);
    if (!validatedConfig.success) {
      const err = formatError(400, 'MALFORMED_CONFIG', 'Invalid configuration shape.', validatedConfig.error.flatten());
      return res.status(err.status).json(err.body);
    }

    const doc = await OutputConfig.create({
      name,
      config: validatedConfig.data
    });

    res.status(201).json(doc);
  } catch (error) {
    const err = formatError(500, 'UNEXPECTED_ERROR', 'Failed to save configuration.', error.message);
    res.status(err.status).json(err.body);
  }
});

// -------------------------------------------------------------
// GET /api/health
// Liveness check including database liveness.
// -------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  // readyState codes: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const status = dbStatus === 1 ? 'UP' : 'DEGRADED';
  res.status(dbStatus === 1 ? 200 : 503).json({
    status,
    database: {
      status: dbStates[dbStatus] || 'unknown',
      code: dbStatus
    },
    timestamp: new Date()
  });
});

// Start DB and Express Server
async function startServer() {
  // Start listening immediately
  app.listen(PORT, () => {
    console.log(`Server listening on Port ${PORT}`);
  });

  // Connect to MongoDB asynchronously in the background
  connectDB().catch(err => {
    console.warn('Warning: Failed to connect to MongoDB on startup. Server running in no-persist mode.', err.message);
  });
}

// Only call startServer if run directly, not in tests
if (process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server'))) {
  startServer();
}

export default app;
export { app };
