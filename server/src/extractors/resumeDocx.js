import mammoth from 'mammoth';
import { parseResumeText } from './resumeTextParser.js';

/**
 * Extracts data from a DOCX Resume.
 * @param {Buffer} content 
 * @param {string} [filename]
 * @returns {Promise<object>} RawRecord
 */
export async function extract(content, filename = 'resume_docx') {
  try {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';
    
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
      raw_confidence: 0.7
    };
  } catch (error) {
    console.warn(`Failed to parse DOCX Resume from ${filename}:`, error.message);
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
