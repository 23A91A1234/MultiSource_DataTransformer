import Fuse from 'fuse.js';

// Curated static taxonomy of ~30 common software engineering skills
export const CANONICAL_TAXONOMY = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Go', 'Rust', 'Swift',
  'HTML', 'CSS', 'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot',
  'MongoDB', 'PostgreSQL', 'MySQL', 'SQL', 'Docker', 'Kubernetes', 'AWS', 'Git', 'CI/CD', 
  'Machine Learning', 'Deep Learning', 'NLP', 'PyTorch', 'TensorFlow'
];

const fuse = new Fuse(CANONICAL_TAXONOMY, {
  includeScore: true,
  threshold: 0.35 // Strict threshold for fuzzy matching to taxonomy
});

/**
 * Normalizes a single skill string using the canonical taxonomy.
 * If unrecognized, returns the skill as-is with a low default confidence of 0.4.
 * @param {string} skillName 
 * @returns {object} { name: string, confidence: number }
 */
export function normalizeSkill(skillName) {
  if (!skillName || typeof skillName !== 'string') {
    return { name: 'Unknown', confidence: 0.1 };
  }

  const trimmed = skillName.trim();
  if (!trimmed) {
    return { name: 'Unknown', confidence: 0.1 };
  }

  // 1. Exact case-insensitive match
  const exactMatch = CANONICAL_TAXONOMY.find(
    item => item.toLowerCase() === trimmed.toLowerCase()
  );
  if (exactMatch) {
    return { name: exactMatch, confidence: 1.0 };
  }

  // 2. Fuzzy match using Fuse.js
  const results = fuse.search(trimmed);
  if (results.length > 0) {
    const bestMatch = results[0];
    if (bestMatch.score <= 0.35) {
      // Scale confidence based on score (closer match -> higher confidence)
      const confidence = parseFloat((1.0 - bestMatch.score).toFixed(2));
      return { name: bestMatch.item, confidence };
    }
  }

  // 3. Unrecognized: Preserve as-is but tag with a lower default confidence (0.4)
  return { name: trimmed, confidence: 0.4 };
}

export default normalizeSkill;
