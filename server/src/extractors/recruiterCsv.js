import Papa from 'papaparse';

/**
 * Extracts data from Recruiter CSV.
 * Columns: name, email, phone, current_company, title
 * @param {string|Buffer} content 
 * @param {string} [filename]
 * @returns {Promise<object>} RawRecord
 */
export async function extract(content, filename = 'recruiter_csv') {
  try {
    const csvString = Buffer.isBuffer(content) ? content.toString('utf-8') : content;
    
    const parsed = Papa.parse(csvString, {
      header: true,
      skipEmptyLines: true
    });

    if (parsed.errors && parsed.errors.length > 0 && parsed.data.length === 0) {
      console.warn(`CSV Parsing warnings/errors for ${filename}:`, parsed.errors);
      return [];
    }

    if (!parsed.data || parsed.data.length === 0) {
      return [];
    }

    return parsed.data.map((row, index) => {
      const sourceId = `${filename}#row${index}`;
      return {
        source_id: sourceId,
        source_type: 'structured',
        candidate_hint: {
          name: row.name || null,
          email: row.email || null,
          phone: row.phone || null
        },
        fields: {
          name: row.name || null,
          email: row.email || null,
          phone: row.phone || null,
          current_company: row.current_company || null,
          title: row.title || null
        },
        raw_confidence: 0.9
      };
    });
  } catch (error) {
    console.warn(`Failed to parse CSV from ${filename}:`, error);
    return [];
  }
}

export default { extract };
