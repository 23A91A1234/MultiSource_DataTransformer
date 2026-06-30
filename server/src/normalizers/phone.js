import parsePhoneNumberFromString from 'libphonenumber-js';

/**
 * Normalizes a phone number to E.164 format.
 * @param {string} phoneStr 
 * @returns {string|null} E.164 normalized phone, or original/null if invalid
 */
export function normalizePhone(phoneStr) {
  if (!phoneStr || typeof phoneStr !== 'string') {
    return null;
  }

  const cleanStr = phoneStr.trim();
  
  // 1. Try to parse directly (which works if a leading + and country code is present)
  let phoneNumber = parsePhoneNumberFromString(cleanStr);
  if (phoneNumber && phoneNumber.isValid()) {
    return phoneNumber.number;
  }

  // 2. Try parsing with US/Canada as a default country code
  phoneNumber = parsePhoneNumberFromString(cleanStr, 'US');
  if (phoneNumber && phoneNumber.isValid()) {
    return phoneNumber.number;
  }

  // 3. Fallback: manually format if it looks like a 10 or 11-digit number
  const digits = cleanStr.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.length > 7) {
    // If it starts with +, just prepend + to digits
    if (cleanStr.startsWith('+')) {
      return `+${digits}`;
    }
  }

  return cleanStr; // Return as-is if we cannot normalize it
}

export default normalizePhone;
