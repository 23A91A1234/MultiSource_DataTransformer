import dayjs from 'dayjs';

/**
 * Normalizes date strings to YYYY-MM format.
 * Returns null if invalid or represents "Present"/"Current".
 * @param {string} dateStr 
 * @returns {string|null} YYYY-MM format, or null
 */
export function normalizeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const cleanStr = dateStr.trim();
  
  // Handle Present / Current
  if (/^(present|current|now)$/i.test(cleanStr)) {
    return null;
  }

  // 1. Check if already YYYY-MM
  if (/^\d{4}-\d{2}$/.test(cleanStr)) {
    return cleanStr;
  }

  // 2. Check if just a YYYY year
  if (/^\d{4}$/.test(cleanStr)) {
    return `${cleanStr}-01`; // default to January
  }

  // 3. Try parsing common formats using dayjs
  // E.g. "Jan 2020", "January 2020", "2020/01/15", "01-2020"
  const parsed = dayjs(cleanStr);
  if (parsed.isValid()) {
    return parsed.format('YYYY-MM');
  }

  // Fallback check: e.g. "01/2020" or "01-2020"
  const monthYearMatch = cleanStr.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthYearMatch) {
    const month = monthYearMatch[1].padStart(2, '0');
    const year = monthYearMatch[2];
    return `${year}-${month}`;
  }

  // Fallback check: e.g. "2020/01"
  const yearMonthMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonthMatch) {
    const year = yearMonthMatch[1];
    const month = yearMonthMatch[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  return null; // Zod validation requires strict format or null
}

export default normalizeDate;
