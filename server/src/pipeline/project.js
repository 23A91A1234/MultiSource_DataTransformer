import { normalizePhone } from '../normalizers/phone.js';
import { normalizeDate } from '../normalizers/date.js';
import { normalizeSkill } from '../normalizers/skills.js';

/**
 * Resolves a dot-path or array index on an object.
 * E.g. "emails[0]" or "location.city" or "skills[0].name"
 */
export function getDotPath(obj, path) {
  if (!path) return undefined;
  // Convert emails[0] -> emails.0
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.');
  
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Sets a value at a dot-path or array index on an object.
 */
export function setDotPath(obj, path, value) {
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalizedPath.split('.');
  
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextNumber = !isNaN(parseInt(nextPart, 10));
    
    if (current[part] === undefined) {
      current[part] = isNextNumber ? [] : {};
    }
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

/**
 * Recursively strips a field name from an object or array.
 */
function stripFieldRecursively(obj, fieldName) {
  if (obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(item => stripFieldRecursively(item, fieldName));
  } else {
    delete obj[fieldName];
    Object.keys(obj).forEach(key => stripFieldRecursively(obj[key], fieldName));
  }
}

/**
 * Projects a CanonicalProfile into a custom output shape based on an OutputConfig.
 * Preserves purity: does not mutate the input profile.
 * 
 * @param {object} profile - The CanonicalProfile to project
 * @param {object} config - The OutputConfig configuration
 * @returns {object} { output: object, warnings: Array<string> }
 */
export function projectProfile(profile, config) {
  // Deep clone to ensure no side effects / mutation
  const canonical = JSON.parse(JSON.stringify(profile));
  
  const projected = {};
  const warnings = [];
  const missingRequiredPaths = [];

  const onMissing = config.on_missing || 'null';

  if (!config.fields || !Array.isArray(config.fields)) {
    return { output: canonical, warnings: ['Invalid config fields: defaulting to canonical profile'] };
  }

  for (const fieldCfg of config.fields) {
    const { path: outPath, from: canonicalPath, required, type, normalize } = fieldCfg;
    
    let value = getDotPath(canonical, canonicalPath);

    // Apply normalization if value is present and requested
    if (value !== null && value !== undefined) {
      if (normalize === 'E164') {
        value = normalizePhone(String(value));
      } else if (normalize === 'YYYY-MM') {
        value = normalizeDate(String(value));
      } else if (normalize === 'canonical') {
        const norm = normalizeSkill(String(value));
        value = norm.name;
      }
      
      // Attempt explicit type coercion
      if (type === 'string') {
        value = String(value);
      } else if (type === 'number') {
        const num = Number(value);
        value = isNaN(num) ? null : num;
      } else if (type === 'boolean') {
        value = Boolean(value);
      } else if (type === 'string[]') {
        if (!Array.isArray(value)) {
          value = value ? [String(value)] : [];
        } else {
          value = value.map(String);
        }
      }
    }

    const isValueMissing = value === undefined || value === null;

    if (isValueMissing) {
      if (required) {
        missingRequiredPaths.push(canonicalPath);
        warnings.push(`Required field '${outPath}' (from canonical '${canonicalPath}') is missing.`);
      }

      if (onMissing === 'error') {
        // We will throw validation error below after checking all fields
      } else if (onMissing === 'omit') {
        // Skip setting key
        continue;
      } else {
        // Insert null
        setDotPath(projected, outPath, null);
      }
    } else {
      setDotPath(projected, outPath, value);
    }
  }

  if (missingRequiredPaths.length > 0 && onMissing === 'error') {
    const err = new Error(`Validation failed. Missing required fields: ${missingRequiredPaths.join(', ')}`);
    err.code = 'VALIDATION_ERROR';
    err.details = missingRequiredPaths;
    throw err;
  }

  // Include overall confidence if requested
  if (config.include_confidence !== false) {
    if (canonical.overall_confidence !== undefined) {
      projected.overall_confidence = canonical.overall_confidence;
    }
  } else {
    delete projected.overall_confidence;
    stripFieldRecursively(projected, 'confidence');
  }

  // Include provenance if requested
  if (config.include_provenance !== false) {
    if (canonical.provenance) {
      projected.provenance = canonical.provenance;
    }
  } else {
    delete projected.provenance;
  }

  return { output: projected, warnings };
}

export default projectProfile;
