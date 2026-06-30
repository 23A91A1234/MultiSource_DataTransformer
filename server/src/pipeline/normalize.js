import { normalizePhone } from '../normalizers/phone.js';
import { normalizeDate } from '../normalizers/date.js';
import { normalizeSkill } from '../normalizers/skills.js';

/**
 * Standardizes raw fields of a RawRecord into a normalized representation.
 * @param {object} rawRecord 
 * @returns {object} NormalizedRecord
 */
export function normalizeRecord(rawRecord) {
  const fields = rawRecord.fields || {};
  const sourceId = rawRecord.source_id;

  // 1. Normalize name
  const rawName = fields.name || rawRecord.candidate_hint?.name || null;
  const fullName = typeof rawName === 'string' ? rawName.trim() : null;

  // 2. Normalize emails (ensure array, lowercased, trimmed)
  let rawEmails = fields.emails || (fields.email ? [fields.email] : []);
  if (!Array.isArray(rawEmails)) {
    rawEmails = [rawEmails];
  }
  const emails = rawEmails
    .map(e => typeof e === 'string' ? e.trim().toLowerCase() : null)
    .filter(e => e && e.includes('@'));

  // 3. Normalize phones (ensure array, E.164)
  let rawPhones = fields.phones || (fields.phone ? [fields.phone] : []);
  if (!Array.isArray(rawPhones)) {
    rawPhones = [rawPhones];
  }
  const phones = rawPhones
    .map(p => normalizePhone(p))
    .filter(Boolean);

  // 4. Normalize Location
  let city = null;
  let region = null;
  let country = null;
  
  if (fields.location) {
    city = fields.location.city || null;
    region = fields.location.region || null;
    country = fields.location.country || null;
  } else if (fields.city || fields.region || fields.country) {
    city = fields.city || null;
    region = fields.region || null;
    country = fields.country || null;
  }
  
  if (typeof country === 'string') {
    country = country.trim().toUpperCase();
    if (country.length !== 2) {
      // If it's a full name like "United States", try to map to US
      if (country === 'US' || country === 'USA' || country === 'UNITED STATES') {
        country = 'US';
      } else if (country === 'GB' || country === 'UK' || country === 'UNITED KINGDOM') {
        country = 'GB';
      } else if (country === 'CA' || country === 'CANADA') {
        country = 'CA';
      } else {
        country = country.substring(0, 2); // best effort ISO-3166 length 2
      }
    }
  }

  // 5. Normalize Links
  const links = {
    linkedin: fields.linkedin || null,
    github: fields.github || null,
    portfolio: fields.portfolio || null,
    other: Array.isArray(fields.other_links) ? fields.other_links : (fields.other ? [fields.other] : [])
  };
  
  // Ensure URLs are valid URL formats or null
  ['linkedin', 'github', 'portfolio'].forEach(key => {
    if (links[key]) {
      try {
        let urlStr = links[key].trim();
        if (!urlStr.startsWith('http')) {
          urlStr = `https://${urlStr}`;
        }
        new URL(urlStr);
        links[key] = urlStr;
      } catch (e) {
        links[key] = null;
      }
    }
  });
  
  const otherUrls = [];
  if (Array.isArray(links.other)) {
    links.other.forEach(url => {
      try {
        let urlStr = String(url).trim();
        if (!urlStr.startsWith('http')) {
          urlStr = `https://${urlStr}`;
        }
        new URL(urlStr);
        otherUrls.push(urlStr);
      } catch (e) {}
    });
  }
  links.other = otherUrls;

  // 6. Experience
  const rawExp = fields.experience || [];
  const experience = (Array.isArray(rawExp) ? rawExp : []).map(exp => ({
    company: exp.company ? String(exp.company).trim() : 'Unknown Company',
    title: exp.title ? String(exp.title).trim() : 'Software Engineer',
    start: normalizeDate(exp.start),
    end: normalizeDate(exp.end),
    summary: exp.summary ? String(exp.summary).trim() : null
  }));

  // 7. Education
  const rawEdu = fields.education || [];
  const education = (Array.isArray(rawEdu) ? rawEdu : []).map(edu => {
    let end_year = null;
    if (edu.end_year !== undefined && edu.end_year !== null) {
      const yr = parseInt(edu.end_year, 10);
      if (!isNaN(yr)) {
        end_year = yr;
      }
    }
    return {
      institution: edu.institution ? String(edu.institution).trim() : 'Unknown Institution',
      degree: edu.degree ? String(edu.degree).trim() : null,
      field: edu.field ? String(edu.field).trim() : null,
      end_year
    };
  });

  // 8. Skills - Normalize each skill and format it
  const rawSkills = fields.skills || fields.languages || [];
  const skills = (Array.isArray(rawSkills) ? rawSkills : []).map(skill => {
    // A skill can be a string or an object { name, confidence, sources }
    const skillName = typeof skill === 'string' ? skill : (skill.name || '');
    const norm = normalizeSkill(skillName);
    return {
      name: norm.name,
      confidence: norm.confidence,
      sources: [sourceId]
    };
  }).filter(s => s.name && s.name !== 'Unknown');

  return {
    source_id: sourceId,
    source_type: rawRecord.source_type,
    raw_confidence: rawRecord.raw_confidence,
    candidate_hint: {
      name: fullName,
      email: emails[0] || null,
      phone: phones[0] || null
    },
    fields: {
      full_name: fullName,
      emails,
      phones,
      location: (city || region || country) ? { city, region, country } : null,
      links,
      headline: fields.headline || fields.bio || null,
      years_experience: typeof fields.years_experience === 'number' ? fields.years_experience : null,
      skills,
      experience,
      education
    }
  };
}
