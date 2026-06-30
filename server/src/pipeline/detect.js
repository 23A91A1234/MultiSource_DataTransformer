/**
 * Detects the source type from file extension, URL, or input shape.
 * 
 * Possible source types:
 * - recruiter_csv
 * - ats_json
 * - github_api
 * - linkedin_json
 * - resume_pdf
 * - resume_docx
 * - recruiter_notes
 * 
 * @param {string|Buffer} content 
 * @param {string} [filename] 
 * @param {string} [url] 
 * @returns {string} The detected source type
 */
export function detectSourceType(content, filename = '', url = '') {
  // 1. Check URL first
  if (url && typeof url === 'string') {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('github.com')) {
      return 'github_api';
    }
    if (lowerUrl.includes('linkedin.com')) {
      return 'linkedin_json';
    }
  }

  // 2. Check filename extension
  if (filename && typeof filename === 'string') {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      return 'recruiter_csv';
    }
    if (ext === 'pdf') {
      return 'resume_pdf';
    }
    if (ext === 'docx') {
      return 'resume_docx';
    }
    if (ext === 'txt') {
      return 'recruiter_notes';
    }
    if (ext === 'json') {
      // Analyze JSON shape to distinguish between ATS and LinkedIn
      try {
        const parsed = typeof content === 'string' ? JSON.parse(content) : JSON.parse(content.toString('utf-8'));
        if (parsed.cand_full_name || parsed.email_addr || parsed.phone_num) {
          return 'ats_json';
        }
        if (parsed.headline || parsed.linkedin || parsed.education) {
          return 'linkedin_json';
        }
      } catch (e) {
        // If JSON fails to parse, default to ats_json
      }
      return 'ats_json';
    }
  }

  // 3. Fallback content inspection
  if (content) {
    const contentStr = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content).trim();
    if (contentStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(contentStr);
        if (parsed.cand_full_name || parsed.email_addr) return 'ats_json';
        if (parsed.headline || parsed.linkedin) return 'linkedin_json';
      } catch (e) {}
    }
    if (contentStr.toLowerCase().includes('name,email,phone')) {
      return 'recruiter_csv';
    }
  }

  return 'recruiter_notes'; // Default fallback
}

export default detectSourceType;
