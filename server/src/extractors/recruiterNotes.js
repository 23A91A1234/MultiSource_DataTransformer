import { parseResumeText } from './resumeTextParser.js';

/**
 * Extracts data from Recruiter Notes (.txt).
 * Uses regex/keyword extraction, sets confidence to 0.3.
 * @param {string|Buffer} content 
 * @param {string} [filename]
 * @returns {Promise<object>} RawRecord
 */
export async function extract(content, filename = 'recruiter_notes') {
  try {
    const text = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content);
    
    const parsedFields = parseResumeText(text);

    return {
      source_id: filename,
      source_type: 'unstructured',
      candidate_hint: {
        name: parsedFields.name,
        email: parsedFields.emails[0] || null,
        phone: parsedFields.phones[0] || null
      },
      fields: parsedFields,
      raw_confidence: 0.3 // Forced low raw confidence for unreliable free text
    };
  } catch (error) {
    console.warn(`Failed to parse recruiter notes from ${filename}:`, error.message);
    return {
      source_id: filename,
      source_type: 'unstructured',
      candidate_hint: { name: null, email: null, phone: null },
      fields: {},
      raw_confidence: 0
    };
  }
}

export default { extract };
