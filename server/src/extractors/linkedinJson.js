import fs from 'fs/promises';
import path from 'path';

/**
 * Extracts data from a LinkedIn JSON fixture.
 * @param {string|Buffer} content - Can be a JSON string, a file path, or a LinkedIn URL
 * @param {string} [filename]
 * @returns {Promise<object>} RawRecord
 */
export async function extract(content, filename = 'linkedin_json') {
  let data = null;

  const contentStr = Buffer.isBuffer(content) ? content.toString('utf-8') : String(content).trim();

  // 1. Try to parse direct JSON content
  if (contentStr.startsWith('{')) {
    try {
      data = JSON.parse(contentStr);
    } catch (e) {
      console.warn('Failed to parse LinkedIn JSON content directly');
    }
  }

  // 2. If it is a LinkedIn URL or path, look up in samples directory
  if (!data) {
    const isLinkedInUrl = contentStr.includes('linkedin.com/in/');
    const isJsonFile = contentStr.endsWith('.json') || contentStr.includes('linkedin_');

    if (isLinkedInUrl || isJsonFile) {
      try {
        let sampleFilename = 'linkedin_sample.json';
        if (isLinkedInUrl) {
          const parts = contentStr.split('linkedin.com/in/')[1]?.split('/').filter(Boolean);
          if (parts && parts.length > 0) {
            sampleFilename = `linkedin_${parts[0]}.json`;
          }
        } else if (contentStr.endsWith('.json')) {
          sampleFilename = path.basename(contentStr);
        }

        // Read from samples directory
        // We will look up relative to the workspace root
        const samplesDir = path.resolve(process.cwd(), '../samples');
        const fallbackSamplesDir = path.resolve(process.cwd(), 'samples'); // in case cwd is different

        let filePath = path.join(samplesDir, sampleFilename);
        let fileFound = false;
        try {
          await fs.access(filePath);
          fileFound = true;
        } catch {
          try {
            filePath = path.join(fallbackSamplesDir, sampleFilename);
            await fs.access(filePath);
            fileFound = true;
          } catch {
            // File not found on filesystem
          }
        }

        if (fileFound) {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          data = JSON.parse(fileContent);
        } else {
          // Dynamically extract the name from the LinkedIn URL path if file is missing
          if (isLinkedInUrl) {
            const pathPart = contentStr.split('linkedin.com/in/')[1]?.split('/').filter(Boolean)[0] || '';
            if (pathPart) {
              // Strip trailing alphanumeric ID like -2a9168291
              const cleanPath = pathPart.replace(/-[a-f0-9]+$/, '');
              const words = cleanPath.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1));
              const derivedName = words.join(' ');
              
              data = {
                name: derivedName,
                headline: null,
                emails: [],
                phones: [],
                linkedin: contentStr,
                experience: [],
                education: [],
                isDerived: true
              };
            }
          }
        }
      } catch (error) {
        console.warn('Failed to read LinkedIn JSON fixture from samples:', error.message);
      }
    }
  }

  // BUG 1: Remove John Doe fallback entirely, return empty record
  if (!data) {
    return {
      source_id: filename,
      source_type: 'unstructured',
      candidate_hint: { name: null, email: null, phone: null },
      fields: {
        name: null,
        headline: null,
        emails: [],
        phones: [],
        linkedin: null,
        github: null,
        portfolio: null,
        experience: [],
        education: []
      },
      raw_confidence: 0
    };
  }

  const fields = {
    name: data.name || null,
    headline: data.headline || null,
    emails: Array.isArray(data.emails) ? data.emails : (data.email ? [data.email] : []),
    phones: Array.isArray(data.phones) ? data.phones : (data.phone ? [data.phone] : []),
    linkedin: data.linkedin || null,
    github: data.github || null,
    portfolio: data.portfolio || null,
    experience: Array.isArray(data.experience) ? data.experience.map(exp => ({
      company: exp.company || null,
      title: exp.title || null,
      start: exp.start || null,
      end: exp.end || null,
      summary: exp.summary || null
    })) : [],
    education: Array.isArray(data.education) ? data.education.map(edu => ({
      institution: edu.institution || null,
      degree: edu.degree || null,
      field: edu.field || null,
      end_year: edu.end_year || null
    })) : []
  };

  return {
    source_id: filename,
    source_type: 'unstructured',
    candidate_hint: {
      name: fields.name,
      email: fields.emails[0] || null,
      phone: fields.phones[0] || null
    },
    fields,
    raw_confidence: data.isDerived ? 0.3 : 0.9
  };
}

export default { extract };
