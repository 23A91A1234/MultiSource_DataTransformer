import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/normalizers/phone.js';
import { normalizeDate } from '../src/normalizers/date.js';
import { normalizeSkill } from '../src/normalizers/skills.js';

describe('Normalizer Units', () => {

  describe('Phone Normalizer', () => {
    it('normalizes formatted US phone number to E.164', () => {
      expect(normalizePhone('(415) 555-1234')).toBe('+14155551234');
    });

    it('normalizes standard string to E.164', () => {
      expect(normalizePhone('+14155551234')).toBe('+14155551234');
    });

    it('normalizes 10-digit number without country code', () => {
      expect(normalizePhone('4155551234')).toBe('+14155551234');
    });

    it('returns as-is or null on garbage input', () => {
      expect(normalizePhone('invalid-phone')).toBe('invalid-phone');
      expect(normalizePhone(null)).toBe(null);
    });
  });

  describe('Date Normalizer', () => {
    it('preserves YYYY-MM format', () => {
      expect(normalizeDate('2020-05')).toBe('2020-05');
    });

    it('converts YYYY to YYYY-01', () => {
      expect(normalizeDate('2020')).toBe('2020-01');
    });

    it('parses text date via dayjs', () => {
      expect(normalizeDate('Jan 2020')).toBe('2020-01');
      expect(normalizeDate('February 2023')).toBe('2023-02');
    });

    it('handles Present / Current / Now by returning null', () => {
      expect(normalizeDate('Present')).toBe(null);
      expect(normalizeDate('Current')).toBe(null);
    });

    it('handles MM/YYYY or MM-YYYY formats', () => {
      expect(normalizeDate('12/2021')).toBe('2021-12');
      expect(normalizeDate('05-2018')).toBe('2018-05');
    });

    it('returns null on invalid formats to prevent Zod regex failure', () => {
      expect(normalizeDate('Not a date')).toBe(null);
    });
  });

  describe('Skills Normalizer', () => {
    it('matches exact canonical skill case-insensitively', () => {
      const res = normalizeSkill('javascript');
      expect(res.name).toBe('JavaScript');
      expect(res.confidence).toBe(1.0);
    });

    it('fuzzy matches taxonomy elements using fuse.js', () => {
      // "nodejs" fuzzy matches "Node.js"
      const res = normalizeSkill('nodejs');
      expect(res.name).toBe('Node.js');
      expect(res.confidence).toBeGreaterThan(0.6);
    });

    it('preserves unrecognized skills as-is but tags with low confidence (0.4)', () => {
      const res = normalizeSkill('Cobol');
      expect(res.name).toBe('Cobol');
      expect(res.confidence).toBe(0.4);
    });

    it('handles invalid inputs gracefully', () => {
      const res = normalizeSkill(null);
      expect(res.name).toBe('Unknown');
      expect(res.confidence).toBe(0.1);
    });
  });
});
