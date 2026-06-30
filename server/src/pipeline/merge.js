import Fuse from 'fuse.js';
import crypto from 'crypto';

// Source priority order for tie-breaking
export const SOURCE_PRIORITY = [
  'ats_json',
  'recruiter_csv',
  'linkedin_json',
  'github_api',
  'resume_pdf',
  'resume_docx',
  'resume', // general fallback
  'recruiter_notes'
];

/**
 * Checks if two names fuzzy match using Fuse.js or custom word-overlap logic.
 * Handles initials (e.g. 'M.' matching 'Malireddy') and case-insensitivity.
 * @param {string} name1 
 * @param {string} name2 
 * @returns {boolean}
 */
export function checkFuzzyNameMatch(name1, name2) {
  if (!name1 || !name2) return false;
  
  const n1 = name1.toLowerCase().replace(/[.,]/g, ' ').trim();
  const n2 = name2.toLowerCase().replace(/[.,]/g, ' ').trim();
  
  if (n1 === n2) return true;

  // 1. Standard Fuse.js match
  const fuse = new Fuse([n2], {
    includeScore: true,
    threshold: 0.15
  });
  const results = fuse.search(n1);
  if (results.length > 0 && results[0].score <= 0.15) {
    return true;
  }

  // 2. Custom word-overlap match (handles initials and middle names)
  const words1 = n1.split(/\s+/).filter(w => w.length > 0);
  const words2 = n2.split(/\s+/).filter(w => w.length > 0);

  let sharedCount = 0;
  words1.forEach(w => {
    if (words2.includes(w)) {
      sharedCount++;
    } else {
      // Check if it's an initial (e.g. 'm' matches 'malireddy')
      const initialMatch = words2.some(w2 => 
        (w.length === 1 && w2.startsWith(w)) || 
        (w2.length === 1 && w.startsWith(w2))
      );
      if (initialMatch) {
        sharedCount += 0.5; // partial match for initial
      }
    }
  });

  const minWords = Math.min(words1.length, words2.length);
  const overlapRatio = sharedCount / minWords;
  
  return overlapRatio >= 0.75;
}

/**
 * Checks if two records share a company (current_company or experience company)
 */
function hasSharedCompany(rec1, rec2) {
  const getCompanies = (rec) => {
    const list = [];
    if (rec.fields.current_company) list.push(rec.fields.current_company);
    if (rec.fields.experience && Array.isArray(rec.fields.experience)) {
      rec.fields.experience.forEach(exp => {
        if (exp.company) list.push(exp.company);
      });
    }
    return list.map(c => c.toLowerCase().trim()).filter(Boolean);
  };

  const comp1 = getCompanies(rec1);
  const comp2 = getCompanies(rec2);
  return comp1.some(c => comp2.includes(c));
}

/**
 * Checks if two records share a location (city, region, or country)
 */
function hasSharedLocation(rec1, rec2) {
  const loc1 = rec1.fields.location;
  const loc2 = rec2.fields.location;
  if (!loc1 || !loc2) return false;

  const city1 = loc1.city?.toLowerCase().trim();
  const city2 = loc2.city?.toLowerCase().trim();
  if (city1 && city2 && city1 === city2) return true;

  const reg1 = loc1.region?.toLowerCase().trim();
  const reg2 = loc2.region?.toLowerCase().trim();
  if (reg1 && reg2 && reg1 === reg2) return true;

  const c1 = loc1.country?.toLowerCase().trim();
  const c2 = loc2.country?.toLowerCase().trim();
  if (c1 && c2 && c1 === c2) return true;

  return false;
}

/**
 * Checks if two records share at least 3 skills
 */
function hasSharedSkills(rec1, rec2) {
  const skills1 = (rec1.fields.skills || []).map(s => s.name.toLowerCase());
  const skills2 = (rec2.fields.skills || []).map(s => s.name.toLowerCase());
  if (skills1.length === 0 || skills2.length === 0) return false;

  const shared = skills1.filter(s => skills2.includes(s));
  return shared.length >= 3;
}

/**
 * Checks if one name contains all words of the other name (ignoring punctuation).
 * Helps merge mock profiles that share a name but have no other contact/professional data.
 */
function checkExactWordOverlap(name1, name2) {
  const w1 = name1.toLowerCase().replace(/[.,]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const w2 = name2.toLowerCase().replace(/[.,]/g, ' ').trim().split(/\s+/).filter(Boolean);
  
  const minWords = Math.min(w1.length, w2.length);
  if (minWords <= 1) return false; // Avoid matching single common words

  let shared = 0;
  w1.forEach(w => {
    if (w2.includes(w)) shared++;
  });
  
  return shared === minWords;
}

/**
 * Determines if a record should be merged into an existing group of records
 */
export function shouldMerge(record, group) {
  // 1. Check exact email match (highest priority)
  const recordEmails = record.fields.emails || [];
  for (const groupRec of group) {
    const groupEmails = groupRec.fields.emails || [];
    const sharedEmail = recordEmails.find(e => groupEmails.includes(e));
    if (sharedEmail) return true;
  }

  // 2. Check exact phone match (E.164)
  const recordPhones = record.fields.phones || [];
  for (const groupRec of group) {
    const groupPhones = groupRec.fields.phones || [];
    const sharedPhone = recordPhones.find(p => groupPhones.includes(p));
    if (sharedPhone) return true;
  }

  // 3. Check fuzzy name + at least one secondary signal
  const recordName = record.fields.full_name;
  if (!recordName) return false;

  for (const groupRec of group) {
    const groupName = groupRec.fields.full_name;
    if (!groupName) continue;

    // Check exact word overlap first (strong name match, no secondary signal required)
    if (checkExactWordOverlap(recordName, groupName)) {
      return true;
    }

    // Otherwise, check fuzzy name match + secondary signal
    if (checkFuzzyNameMatch(recordName, groupName)) {
      if (
        hasSharedCompany(record, groupRec) || 
        hasSharedLocation(record, groupRec) ||
        hasSharedSkills(record, groupRec)
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Groups normalized records into candidate clusters
 * @param {array} normalizedRecords 
 * @returns {array} Array of clusters (arrays of records)
 */
export function groupRecords(normalizedRecords) {
  const groups = [];

  for (const record of normalizedRecords) {
    let matchedGroupIndex = -1;

    for (let i = 0; i < groups.length; i++) {
      if (shouldMerge(record, groups[i])) {
        matchedGroupIndex = i;
        break;
      }
    }

    if (matchedGroupIndex !== -1) {
      groups[matchedGroupIndex].push(record);
    } else {
      groups.push([record]);
    }
  }

  return groups;
}

/**
 * Resolve scalar fields using raw_confidence and source priority tie-breakers
 */
function resolveScalarField(fieldPath, records, getValueFn) {
  const active = records
    .map(rec => ({
      source_id: rec.source_id,
      source_type: rec.source_type,
      raw_confidence: rec.raw_confidence,
      value: getValueFn(rec)
    }))
    .filter(s => s.value !== null && s.value !== undefined && s.value !== '');

  if (active.length === 0) {
    return { value: null, provenance: [] };
  }

  // Sort by raw_confidence descending, then by source priority index ascending
  const sorted = [...active].sort((a, b) => {
    if (b.raw_confidence !== a.raw_confidence) {
      return b.raw_confidence - a.raw_confidence;
    }
    
    // Normalize source types to match priority order keys
    const normalizeType = (type) => {
      if (type.startsWith('resume')) return 'resume';
      return type;
    };

    const typeA = normalizeType(a.source_type);
    const typeB = normalizeType(b.source_type);

    const pA = SOURCE_PRIORITY.indexOf(typeA) === -1 ? 99 : SOURCE_PRIORITY.indexOf(typeA);
    const pB = SOURCE_PRIORITY.indexOf(typeB) === -1 ? 99 : SOURCE_PRIORITY.indexOf(typeB);
    return pA - pB;
  });

  const winner = sorted[0];
  const agreeingSources = sorted.filter(s => s.value === winner.value);
  const losingSources = sorted.filter(s => s.value !== winner.value);

  let method = 'direct';
  if (sorted.length > 1) {
    if (agreeingSources.length > sorted.length / 2) {
      method = 'merged_majority';
    } else {
      method = 'merged_priority';
    }
  }

  const provenance = [];
  provenance.push({
    field: fieldPath,
    source: winner.source_id,
    method
  });

  losingSources.forEach(loss => {
    provenance.push({
      field: fieldPath,
      source: loss.source_id,
      method
    });
  });

  return {
    value: winner.value,
    provenance
  };
}

/**
 * Merges a group of records belonging to the same candidate into a single CanonicalProfile.
 * @param {array} records - NormalizedRecords in this group
 * @returns {object} CanonicalProfile
 */
export function mergeGroup(records) {
  const provenance = [];

  // Generate candidate_id deterministically if possible (using hash of first email or name)
  const primaryEmail = records.flatMap(r => r.fields.emails || [])[0];
  const primaryName = records.map(r => r.fields.full_name).filter(Boolean)[0] || 'unknown';
  let candidate_id;
  if (primaryEmail) {
    candidate_id = crypto.createHash('md5').update(primaryEmail).digest('hex');
  } else {
    candidate_id = crypto.createHash('md5').update(primaryName).digest('hex');
  }

  // 1. Resolve scalars
  const nameResult = resolveScalarField('full_name', records, r => r.fields.full_name);
  const full_name = nameResult.value || 'Unknown Candidate';
  provenance.push(...nameResult.provenance);

  const headlineResult = resolveScalarField('headline', records, r => r.fields.headline);
  const headline = headlineResult.value;
  provenance.push(...headlineResult.provenance);

  const yearsResult = resolveScalarField('years_experience', records, r => r.fields.years_experience);
  const years_experience = yearsResult.value;
  provenance.push(...yearsResult.provenance);

  // 2. Resolve location fields
  const cityResult = resolveScalarField('location.city', records, r => r.fields.location?.city);
  const regionResult = resolveScalarField('location.region', records, r => r.fields.location?.region);
  const countryResult = resolveScalarField('location.country', records, r => r.fields.location?.country);
  
  let location = null;
  if (cityResult.value || regionResult.value || countryResult.value) {
    location = {
      city: cityResult.value,
      region: regionResult.value,
      country: countryResult.value
    };
    provenance.push(...cityResult.provenance, ...regionResult.provenance, ...countryResult.provenance);
  }

  // 3. Resolve links
  const linkedinResult = resolveScalarField('links.linkedin', records, r => r.fields.links?.linkedin);
  const githubResult = resolveScalarField('links.github', records, r => r.fields.links?.github);
  const portfolioResult = resolveScalarField('links.portfolio', records, r => r.fields.links?.portfolio);
  
  provenance.push(...linkedinResult.provenance, ...githubResult.provenance, ...portfolioResult.provenance);

  // Union other links
  const otherLinksSet = new Set();
  const otherLinksSources = {};
  records.forEach(r => {
    const urls = r.fields.links?.other || [];
    urls.forEach(url => {
      otherLinksSet.add(url);
      if (!otherLinksSources[url]) {
        otherLinksSources[url] = [];
      }
      otherLinksSources[url].push(r.source_id);
    });
  });
  
  const otherLinks = Array.from(otherLinksSet);
  otherLinks.forEach((url, index) => {
    const srcs = otherLinksSources[url] || [];
    srcs.forEach(src => {
      provenance.push({
        field: `links.other[${index}]`,
        source: src,
        method: 'direct'
      });
    });
  });

  const links = {
    linkedin: linkedinResult.value,
    github: githubResult.value,
    portfolio: portfolioResult.value,
    other: otherLinks
  };

  // 4. Union & Deduplicate Emails & Phones
  const emailsSet = new Set();
  const emailSources = {};
  records.forEach(r => {
    const ems = r.fields.emails || [];
    ems.forEach(e => {
      emailsSet.add(e);
      if (!emailSources[e]) emailSources[e] = [];
      emailSources[e].push(r.source_id);
    });
  });
  const emails = Array.from(emailsSet);
  emails.forEach((email, index) => {
    (emailSources[email] || []).forEach(src => {
      provenance.push({
        field: `emails[${index}]`,
        source: src,
        method: 'direct'
      });
    });
  });

  const phonesSet = new Set();
  const phoneSources = {};
  records.forEach(r => {
    const phs = r.fields.phones || [];
    phs.forEach(p => {
      phonesSet.add(p);
      if (!phoneSources[p]) phoneSources[p] = [];
      phoneSources[p].push(r.source_id);
    });
  });
  const phones = Array.from(phonesSet);
  phones.forEach((phone, index) => {
    (phoneSources[phone] || []).forEach(src => {
      provenance.push({
        field: `phones[${index}]`,
        source: src,
        method: 'direct'
      });
    });
  });

  // 5. Merge Skills by Name
  // Group skills by canonical name, keep track of contributing sources & confidences
  const skillsMap = {};
  records.forEach(r => {
    const sks = r.fields.skills || [];
    sks.forEach(s => {
      const canonicalName = s.name;
      if (!skillsMap[canonicalName]) {
        skillsMap[canonicalName] = {
          name: canonicalName,
          confidences: [],
          sources: new Set()
        };
      }
      skillsMap[canonicalName].confidences.push(s.confidence);
      skillsMap[canonicalName].sources.add(r.source_id);
    });
  });

  const skills = Object.values(skillsMap).map((sk, index) => {
    const sourcesArr = Array.from(sk.sources);
    
    // Per-field confidence calculation for skills (weighted average or simple average)
    // plus bonus (+0.1 if >= 2 sources agree)
    const avgConf = sk.confidences.reduce((sum, c) => sum + c, 0) / sk.confidences.length;
    const bonus = sourcesArr.length >= 2 ? 0.1 : 0;
    const finalConfidence = Math.min(1.0, parseFloat((avgConf + bonus).toFixed(2)));

    // Track provenance for this skill
    sourcesArr.forEach(src => {
      provenance.push({
        field: `skills[${index}]`,
        source: src,
        method: sourcesArr.length >= 2 ? 'merged_majority' : 'direct'
      });
    });

    return {
      name: sk.name,
      confidence: finalConfidence,
      sources: sourcesArr
    };
  });

  // 6. Union and Deduplicate Experience
  // If two jobs have the same company and title (case insensitive), we merge them.
  const experienceList = [];
  records.forEach(r => {
    const jobs = r.fields.experience || [];
    jobs.forEach(job => {
      // Find matching job in current list
      const match = experienceList.find(
        existing => {
          const compMatch = (existing.company || '').toLowerCase().trim() === (job.company || '').toLowerCase().trim();
          const titleMatch = (existing.title || '').toLowerCase().trim() === (job.title || '').toLowerCase().trim();
          // Only merge if company/title match and at least one identifier is non-empty
          return compMatch && titleMatch && (existing.company || existing.title);
        }
      );
      if (match) {
        // Merge summary and dates
        if (job.summary && !match.summary.includes(job.summary)) {
          match.summary = match.summary ? `${match.summary}\n${job.summary}` : job.summary;
        }
        if (job.start && (!match.start || job.start < match.start)) {
          match.start = job.start;
        }
        if (job.end && (!match.end || job.end > match.end)) {
          match.end = job.end;
        }
        match.sources.add(r.source_id);
      } else {
        experienceList.push({
          company: job.company,
          title: job.title,
          start: job.start,
          end: job.end,
          summary: job.summary,
          sources: new Set([r.source_id])
        });
      }
    });
  });

  const experience = experienceList.map((job, index) => {
    const sourcesArr = Array.from(job.sources);
    sourcesArr.forEach(src => {
      provenance.push({
        field: `experience[${index}]`,
        source: src,
        method: sourcesArr.length >= 2 ? 'merged_majority' : 'direct'
      });
    });
    return {
      company: job.company,
      title: job.title,
      start: job.start,
      end: job.end,
      summary: job.summary
    };
  });

  // 7. Union and Deduplicate Education
  const educationList = [];
  records.forEach(r => {
    const edus = r.fields.education || [];
    edus.forEach(edu => {
      const match = educationList.find(
        existing => {
          const instMatch = (existing.institution || '').toLowerCase().trim() === (edu.institution || '').toLowerCase().trim();
          const degMatch = (existing.degree || '').toLowerCase().trim() === (edu.degree || '').toLowerCase().trim();
          // Only merge if institution/degree match and at least one is non-empty
          return instMatch && degMatch && (existing.institution || existing.degree);
        }
      );
      if (match) {
        if (edu.field && !match.field) match.field = edu.field;
        if (edu.end_year && !match.end_year) match.end_year = edu.end_year;
        match.sources.add(r.source_id);
      } else {
        educationList.push({
          institution: edu.institution,
          degree: edu.degree,
          field: edu.field,
          end_year: edu.end_year,
          sources: new Set([r.source_id])
        });
      }
    });
  });

  const education = educationList.map((edu, index) => {
    const sourcesArr = Array.from(edu.sources);
    sourcesArr.forEach(src => {
      provenance.push({
        field: `education[${index}]`,
        source: src,
        method: sourcesArr.length >= 2 ? 'merged_majority' : 'direct'
      });
    });
    return {
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field,
      end_year: edu.end_year
    };
  });

  return {
    candidate_id,
    full_name,
    emails,
    phones,
    location,
    links,
    headline,
    years_experience,
    skills,
    experience,
    education,
    provenance,
    overall_confidence: 1.0 // will be computed in next stage
  };
}
