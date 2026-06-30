/**
 * Calculates per-field and overall confidence scores for a CanonicalProfile.
 * 
 * Formula:
 * 1. Per-field confidence:
 *    - Average of contributing sources' raw_confidences.
 *    - If >= 2 independent sources agree (i.e. contributed to this field), 
 *      add +0.1 agreement bonus.
 *    - Capped at 1.0.
 * 
 * 2. Overall confidence:
 *    - Weighted average of all populated field confidences.
 *    - Weights:
 *      * full_name: 0.20
 *      * emails: 0.15
 *      * phones: 0.15
 *      * location: 0.10
 *      * links: 0.10
 *      * skills: 0.10
 *      * headline: 0.05
 *      * years_experience: 0.05
 *      * experience: 0.05
 *      * education: 0.05
 *      (Total weight sum = 1.0)
 *    - Penalized proportionally to the fraction of required fields that are null.
 *      Required fields are:
 *      * full_name (must be present)
 *      * at least one email or phone (must be present)
 *      If both required categories are met, multiplier = 1.0.
 *      If one category is missing (e.g. no phone/email), multiplier = 0.5 (50% penalty).
 *      If both are missing, multiplier = 0.0.
 * 
 * @param {object} profile - CanonicalProfile (partially merged, overall_confidence=1.0)
 * @param {object} sourceConfidences - Map of source_id -> raw_confidence
 * @returns {object} Profile with updated skills confidences and overall_confidence
 */
export function calculateConfidence(profile, sourceConfidences) {
  const prov = profile.provenance || [];
  
  // Field weights for overall confidence
  const FIELD_WEIGHTS = {
    full_name: 0.20,
    emails: 0.15,
    phones: 0.15,
    location: 0.10,
    links: 0.10,
    skills: 0.10,
    headline: 0.05,
    years_experience: 0.05,
    experience: 0.05,
    education: 0.05
  };

  const fieldConfidences = {};

  // Helper to compute confidence for a simple field or dot-path prefix
  const getFieldConfidence = (fieldPrefix) => {
    const matchingProv = prov.filter(p => p.field === fieldPrefix || p.field.startsWith(`${fieldPrefix}[`));
    if (matchingProv.length === 0) {
      return 0;
    }

    const uniqueSources = Array.from(new Set(matchingProv.map(p => p.source)));
    const confs = uniqueSources.map(src => sourceConfidences[src] || 0.5);
    const avg = confs.reduce((sum, c) => sum + c, 0) / confs.length;
    
    // Add +0.1 agreement bonus if >= 2 sources contributed
    const bonus = uniqueSources.length >= 2 ? 0.1 : 0;
    return Math.min(1.0, parseFloat((avg + bonus).toFixed(2)));
  };

  // Compute confidence for each field
  fieldConfidences.full_name = getFieldConfidence('full_name');
  fieldConfidences.emails = getFieldConfidence('emails');
  fieldConfidences.phones = getFieldConfidence('phones');
  
  // Location
  const cityConf = getFieldConfidence('location.city');
  const regConf = getFieldConfidence('location.region');
  const countryConf = getFieldConfidence('location.country');
  fieldConfidences.location = (cityConf + regConf + countryConf) / 3 || 0;

  // Links
  const liConf = getFieldConfidence('links.linkedin');
  const ghConf = getFieldConfidence('links.github');
  const portConf = getFieldConfidence('links.portfolio');
  const otherConf = getFieldConfidence('links.other');
  fieldConfidences.links = (liConf + ghConf + portConf + otherConf) / 4 || 0;

  fieldConfidences.headline = getFieldConfidence('headline');
  fieldConfidences.years_experience = getFieldConfidence('years_experience');
  fieldConfidences.experience = getFieldConfidence('experience');
  fieldConfidences.education = getFieldConfidence('education');

  // For skills, each skill already has a confidence calculated during merge, but let's
  // compute a general field-level confidence as the average of the individual skills' confidences.
  if (profile.skills && profile.skills.length > 0) {
    const sum = profile.skills.reduce((s, sk) => s + sk.confidence, 0);
    fieldConfidences.skills = parseFloat((sum / profile.skills.length).toFixed(2));
  } else {
    fieldConfidences.skills = 0;
  }

  // Determine which fields are populated
  const isPopulated = (key) => {
    const val = profile[key];
    if (val === null || val === undefined) return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (key === 'full_name') {
      return !!val && val !== 'Unknown Candidate';
    }
    if (key === 'links') {
      return !!(val.linkedin || val.github || val.portfolio || (val.other && val.other.length > 0));
    }
    if (key === 'location') {
      return !!(val.city || val.region || val.country);
    }
    return true;
  };

  // Weighted average of populated fields
  let totalWeight = 0;
  let weightedSum = 0;

  Object.keys(FIELD_WEIGHTS).forEach(key => {
    if (isPopulated(key)) {
      const weight = FIELD_WEIGHTS[key];
      const conf = fieldConfidences[key] || 0;
      weightedSum += conf * weight;
      totalWeight += weight;
    }
  });

  let overall_confidence = totalWeight > 0 ? (weightedSum / totalWeight) : 0;

  // Penalize missing required fields:
  // 1. full_name
  // 2. at least one email or phone
  let requiredCategory1 = isPopulated('full_name') ? 1.0 : 0.0;
  let requiredCategory2 = (isPopulated('emails') || isPopulated('phones')) ? 1.0 : 0.0;

  const penaltyMultiplier = (requiredCategory1 + requiredCategory2) / 2.0;
  overall_confidence = parseFloat((overall_confidence * penaltyMultiplier).toFixed(2));

  profile.overall_confidence = overall_confidence;
  return profile;
}

export default calculateConfidence;
