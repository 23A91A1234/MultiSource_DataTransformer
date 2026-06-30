import fs from 'fs/promises';
import path from 'path';
import { runPipeline, DEFAULT_OUTPUT_CONFIG } from './pipeline/index.js';
import { connectDB, disconnectDB } from './db/connect.js';
import { RawSource } from './db/models/RawSource.js';
import { CandidateProfile } from './db/models/CandidateProfile.js';
import { PipelineRun } from './db/models/PipelineRun.js';
import dotenv from 'dotenv';

dotenv.config();

// Prevent uncaught exceptions and unhandled rejections from crashing the process
process.on('uncaughtException', (error) => {
  console.error('CRITICAL: Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// Simple command line arguments parser
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    command: args[0],
    sources: [],
    configPath: null,
    outPath: null,
    persist: true,
    githubUrl: null,
    linkedinUrl: null
  };

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--sources') {
      config.sources = args[++i].split(',');
    } else if (args[i] === '--config') {
      config.configPath = args[++i];
    } else if (args[i] === '--out') {
      config.outPath = args[++i];
    } else if (args[i] === '--no-persist') {
      config.persist = false;
    } else if (args[i] === '--github-url') {
      config.githubUrl = args[++i];
    } else if (args[i] === '--linkedin-url') {
      config.linkedinUrl = args[++i];
    }
  }

  return config;
}

/**
 * Resolves files from a path pattern or directory.
 */
async function resolveFiles(paths) {
  const filesList = [];

  for (const p of paths) {
    const cleanPath = p.trim();
    if (!cleanPath) continue;

    // Check if it contains wildcard
    if (cleanPath.includes('*')) {
      const dirName = path.dirname(cleanPath);
      const filePattern = path.basename(cleanPath);
      const regexPattern = new RegExp('^' + filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i');

      try {
        const dirFiles = await fs.readdir(dirName);
        for (const file of dirFiles) {
          if (regexPattern.test(file)) {
            const filePath = path.join(dirName, file);
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
              filesList.push(filePath);
            }
          }
        }
      } catch (err) {
        console.warn(`Warning: Could not resolve wildcard pattern ${cleanPath}:`, err.message);
      }
    } else {
      // Normal path or directory
      try {
        const stat = await fs.stat(cleanPath);
        if (stat.isDirectory()) {
          const dirFiles = await fs.readdir(cleanPath);
          for (const file of dirFiles) {
            const filePath = path.join(cleanPath, file);
            const fileStat = await fs.stat(filePath);
            if (fileStat.isFile()) {
              filesList.push(filePath);
            }
          }
        } else if (stat.isFile()) {
          filesList.push(cleanPath);
        }
      } catch (err) {
        console.warn(`Warning: Could not access path ${cleanPath}:`, err.message);
      }
    }
  }

  return [...new Set(filesList)];
}

async function main() {
  const options = parseArgs();

  if (options.command !== 'run') {
    console.error('Usage: node server/src/cli.js run [--sources <paths>] [--github-url <url>] [--linkedin-url <url>] [--config <configPath>] [--out <outputPath>] [--no-persist]');
    process.exit(1);
  }

  if (options.sources.length === 0 && !options.githubUrl && !options.linkedinUrl) {
    console.error('Error: No sources specified. Provide paths via --sources flag, or specify --github-url/--linkedin-url.');
    process.exit(1);
  }

  // 1. Resolve files
  let resolvedPaths = [];
  if (options.sources.length > 0) {
    resolvedPaths = await resolveFiles(options.sources);
    if (resolvedPaths.length === 0) {
      console.error('Error: No files found matching specified sources.');
      process.exit(1);
    }
    console.log(`Found ${resolvedPaths.length} source file(s) to process.`);
  }

  // 2. Read contents of files
  const sourcesPayload = [];
  for (const filePath of resolvedPaths) {
    try {
      const content = await fs.readFile(filePath);
      sourcesPayload.push({
        filename: path.basename(filePath),
        content: content
      });
    } catch (err) {
      console.error(`Failed to read file ${filePath}:`, err.message);
    }
  }

  // Append URL-based sources
  if (options.githubUrl) {
    sourcesPayload.push({
      filename: 'github_api',
      content: options.githubUrl,
      url: options.githubUrl
    });
  }
  if (options.linkedinUrl) {
    sourcesPayload.push({
      filename: 'linkedin_json',
      content: options.linkedinUrl,
      url: options.linkedinUrl
    });
  }

  // 3. Read configuration
  let config = DEFAULT_OUTPUT_CONFIG;
  if (options.configPath) {
    try {
      const configContent = await fs.readFile(options.configPath, 'utf-8');
      config = JSON.parse(configContent);
    } catch (err) {
      console.error(`Failed to read or parse config file ${options.configPath}:`, err.message);
      process.exit(1);
    }
  }

  // 4. Initialize Database if persistence is enabled
  let runRecord = null;
  if (options.persist) {
    try {
      await connectDB();
      runRecord = await PipelineRun.create({
        status: 'partial',
        started_at: new Date()
      });
    } catch (err) {
      console.warn('MongoDB connection failed. Continuing in --no-persist mode.', err.message);
      options.persist = false;
    }
  }

  console.log('Running candidate data transformation pipeline...');
  const startTime = Date.now();

  try {
    // 5. Execute Pipeline
    const result = await runPipeline(sourcesPayload, config);

    const endTime = Date.now();
    console.log(`Pipeline completed in ${endTime - startTime}ms.`);

    if (result.warnings.length > 0) {
      console.warn('Warnings encountered during pipeline execution:');
      result.warnings.forEach(w => console.warn(` - ${w}`));
    }

    // 6. Persist results to database
    if (options.persist && runRecord) {
      // Write raw sources
      const rawSourceDocs = result.rawRecords.map(raw => ({
        run_id: runRecord._id,
        source_id: raw.source_id,
        source_type: raw.source_type,
        candidate_hint: raw.candidate_hint,
        fields: raw.fields,
        raw_confidence: raw.raw_confidence
      }));
      await RawSource.insertMany(rawSourceDocs);

      // Write candidate profiles
      const profileDocs = result.canonicalProfiles.map(profile => ({
        run_id: runRecord._id,
        candidate_id: profile.candidate_id,
        profile: profile
      }));
      await CandidateProfile.insertMany(profileDocs);

      // Complete run
      runRecord.status = 'completed';
      runRecord.source_count = rawSourceDocs.length;
      runRecord.profile_count = profileDocs.length;
      runRecord.warnings = result.warnings;
      runRecord.finished_at = new Date();
      await runRecord.save();
      console.log(`Persisted run metadata, ${rawSourceDocs.length} raw sources, and ${profileDocs.length} profiles to MongoDB.`);
    }

    // 7. Write outputs to file or console
    const outputJSON = JSON.stringify(result.projectedProfiles, null, 2);
    if (options.outPath) {
      await fs.writeFile(options.outPath, outputJSON, 'utf-8');
      console.log(`Projected profiles written to ${options.outPath}`);
    } else {
      console.log('Projected Output profiles:');
      console.log(outputJSON);
    }
  } catch (err) {
    console.error('Pipeline execution crashed:', err);
    if (options.persist && runRecord) {
      runRecord.status = 'failed';
      runRecord.finished_at = new Date();
      await runRecord.save().catch(console.error);
    }
    process.exit(1);
  } finally {
    if (options.persist) {
      await disconnectDB();
    }
  }
}

main();
