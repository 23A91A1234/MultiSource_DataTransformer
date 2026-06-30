import { detectSourceType } from './detect.js';
import { normalizeRecord } from './normalize.js';
import { groupRecords, mergeGroup } from './merge.js';
import { calculateConfidence } from './confidence.js';
import { projectProfile } from './project.js';
import { validateCanonical, validateProjected } from './validate.js';

// Extractors
import recruiterCsv from '../extractors/recruiterCsv.js';
import atsJson from '../extractors/atsJson.js';
import githubApi from '../extractors/githubApi.js';
import linkedinJson from '../extractors/linkedinJson.js';
import resumePdf from '../extractors/resumePdf.js';
import resumeDocx from '../extractors/resumeDocx.js';
import recruiterNotes from '../extractors/recruiterNotes.js';

export const DEFAULT_OUTPUT_CONFIG = {
  fields: [
    { path: 'candidate_id', from: 'candidate_id', type: 'string', required: true },
    { path: 'full_name', from: 'full_name', type: 'string', required: true },
    { path: 'emails', from: 'emails', type: 'string[]', required: true },
    { path: 'phones', from: 'phones', type: 'string[]', required: true },
    { path: 'location', from: 'location', type: 'object', required: false },
    { path: 'links', from: 'links', type: 'object', required: true },
    { path: 'headline', from: 'headline', type: 'string', required: false },
    { path: 'years_experience', from: 'years_experience', type: 'number', required: false },
    { path: 'skills', from: 'skills', type: 'object', required: true },
    { path: 'experience', from: 'experience', type: 'object', required: true },
    { path: 'education', from: 'education', type: 'object', required: true }
  ],
  include_confidence: true,
  include_provenance: true,
  on_missing: 'null'
};

/**
 * Pure pipeline orchestrator.
 * 
 * @param {Array<object>} sources - [{ filename, content, url }]
 * @param {object} [config] - OutputConfig JSON, defaults to DEFAULT_OUTPUT_CONFIG
 * @returns {Promise<object>} { rawRecords, canonicalProfiles, projectedProfiles, warnings }
 */
export async function runPipeline(sources, config = DEFAULT_OUTPUT_CONFIG) {
  const warnings = [];
  const rawRecords = [];

  // 1. Detect & Extract
  for (const source of sources) {
    const { filename, content, url } = source;
    const sourceType = detectSourceType(content, filename, url);
    
    let rawRecord;
    const sourceId = filename || url || `source_${Date.now()}`;

    try {
      switch (sourceType) {
        case 'recruiter_csv':
          rawRecord = await recruiterCsv.extract(content, sourceId);
          break;
        case 'ats_json':
          rawRecord = await atsJson.extract(content, sourceId);
          break;
        case 'github_api':
          // content could be username or URL
          rawRecord = await githubApi.extract(url || content, sourceId);
          break;
        case 'linkedin_json':
          rawRecord = await linkedinJson.extract(content, sourceId);
          break;
        case 'resume_pdf':
          rawRecord = await resumePdf.extract(content, sourceId);
          break;
        case 'resume_docx':
          rawRecord = await resumeDocx.extract(content, sourceId);
          break;
        case 'recruiter_notes':
        default:
          rawRecord = await recruiterNotes.extract(content, sourceId);
          break;
      }
      
      // Override source type if needed
      if (rawRecord) {
        const recordsArray = Array.isArray(rawRecord) ? rawRecord : [rawRecord];
        for (const rec of recordsArray) {
          rec.source_type = sourceType;
          rawRecords.push(rec);
        }
      }
    } catch (err) {
      warnings.push(`Extraction failed for source ${sourceId}: ${err.message}`);
      // Graceful degradation: return empty raw record with 0 confidence
      rawRecords.push({
        source_id: sourceId,
        source_type: sourceType,
        candidate_hint: { name: null, email: null, phone: null },
        fields: {},
        raw_confidence: 0
      });
    }
  }

  // 2. Normalize
  const normalizedRecords = rawRecords.map(rawRec => {
    try {
      return normalizeRecord(rawRec);
    } catch (err) {
      warnings.push(`Normalization failed for source ${rawRec.source_id}: ${err.message}`);
      // return unnormalized fields as fallback, wrapped in standard structure
      return {
        source_id: rawRec.source_id,
        source_type: rawRec.source_type,
        raw_confidence: rawRec.raw_confidence,
        candidate_hint: rawRec.candidate_hint || { name: null, email: null, phone: null },
        fields: rawRec.fields || {}
      };
    }
  });

  // Map source_id -> raw_confidence for confidence score calculations
  const sourceConfidences = {};
  rawRecords.forEach(r => {
    sourceConfidences[r.source_id] = r.raw_confidence;
  });

  // 3. Merge Groups
  const recordGroups = groupRecords(normalizedRecords);
  const canonicalProfiles = [];

  for (const group of recordGroups) {
    try {
      // Merge Group fields
      const merged = mergeGroup(group);
      
      // Compute Confidence
      const profileWithConfidence = calculateConfidence(merged, sourceConfidences);

      // Validate Canonical
      const validated = validateCanonical(profileWithConfidence);
      // Skip empty profiles with zero provenance entries
      if (validated.provenance && validated.provenance.length > 0) {
        canonicalProfiles.push(validated);
      }
    } catch (err) {
      warnings.push(`Merge/Validation failed for candidate group: ${err.message}`);
    }
  }

  // 4. Project & Validate Output Shape
  const projectedProfiles = [];
  for (const profile of canonicalProfiles) {
    try {
      const { output, warnings: projWarnings } = projectProfile(profile, config);
      if (projWarnings && projWarnings.length > 0) {
        warnings.push(...projWarnings);
      }
      
      // Validate Projected
      const validatedProjected = validateProjected(output, config);
      projectedProfiles.push(validatedProjected);
    } catch (err) {
      warnings.push(`Projection/Validation failed for candidate ${profile.candidate_id}: ${err.message}`);
    }
  }

  return {
    rawRecords,
    canonicalProfiles,
    projectedProfiles,
    warnings
  };
}

export default runPipeline;
