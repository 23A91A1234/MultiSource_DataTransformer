import { vi, describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import recruiterCsv from '../src/extractors/recruiterCsv.js';
import atsJson from '../src/extractors/atsJson.js';
import githubApi from '../src/extractors/githubApi.js';
import linkedinJson from '../src/extractors/linkedinJson.js';
import resumePdf from '../src/extractors/resumePdf.js';
import resumeDocx from '../src/extractors/resumeDocx.js';
import recruiterNotes from '../src/extractors/recruiterNotes.js';
import { parseResumeText, extractDateRange } from '../src/extractors/resumeTextParser.js';

// Mock pdf-parse
vi.mock('pdf-parse', () => {
  return {
    default: async (buffer) => {
      const bufStr = buffer.toString();
      if (bufStr === 'INVALID') {
        throw new Error('Invalid PDF');
      }
      return {
        text: 'Alice Smith\nemail: alice.smith@example.com\nphone: +14155551111\nSkills: React, AWS\nExperience:\nGoogle - Staff Engineer\n2021-06 - Present'
      };
    }
  };
});

// Mock mammoth
vi.mock('mammoth', () => {
  return {
    default: {
      extractRawText: async ({ buffer }) => {
        const bufStr = buffer.toString();
        if (bufStr === 'INVALID') {
          throw new Error('Invalid DOCX');
        }
        return {
          value: 'Bob Jones\nemail: bob.jones@example.com\nphone: 415-555-2222\nSkills: Python, MySQL\nExperience:\nMeta - Developer\n2018-01 - 2021-05'
        };
      }
    }
  };
});

// Mock native fetch for GitHub API
const originalFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (url) => {
  if (url.includes('users/erroruser')) {
    return { ok: false, status: 404 };
  }
  if (url.includes('users/octocat/repos')) {
    return {
      ok: true,
      json: async () => [
        { name: 'repo1', language: 'JavaScript' },
        { name: 'repo2', language: 'TypeScript' },
        { name: 'repo3', language: 'JavaScript' }
      ]
    };
  }
  if (url.includes('users/octocat')) {
    return {
      ok: true,
      json: async () => ({
        name: 'The Octocat',
        email: 'octocat@github.com',
        bio: 'Testing bios',
        html_url: 'https://github.com/octocat',
        blog: 'https://octocat.myportfolio.com',
        public_repos: 3
      })
    };
  }
  return { ok: false, status: 500 };
});

describe('Extractor Units', () => {
  
  it('recruiterCsv extract happy path', async () => {
    const csvContent = 'name,email,phone,current_company,title\nAlice Smith,alice.smith@example.com,4155551111,Google,Senior Eng';
    const records = await recruiterCsv.extract(csvContent, 'recruiter_csv');
    expect(records).toHaveLength(1);
    expect(records[0].raw_confidence).toBe(0.9);
    expect(records[0].candidate_hint.name).toBe('Alice Smith');
    expect(records[0].fields.current_company).toBe('Google');
  });

  it('recruiterCsv extract malformed input catches error', async () => {
    const records = await recruiterCsv.extract(null, 'recruiter_csv');
    expect(records).toEqual([]);
  });

  it('recruiterCsv extract multi-row CSV returns an array of RawRecords', async () => {
    const filePath = path.join(__dirname, 'fixtures', 'recruiter_multi.csv');
    const content = await fs.readFile(filePath, 'utf-8');
    const records = await recruiterCsv.extract(content, 'recruiter_multi.csv');
    
    expect(records).toHaveLength(5);
    expect(records[0].fields.name).toBe('Alice Smith');
    expect(records[0].source_id).toBe('recruiter_multi.csv#row0');
    expect(records[1].fields.name).toBe('Bob Jones');
    expect(records[1].source_id).toBe('recruiter_multi.csv#row1');
    expect(records[4].fields.name).toBe('Eva Green');
    expect(records[4].source_id).toBe('recruiter_multi.csv#row4');
  });

  it('atsJson extract happy path and correct key mapping', async () => {
    const jsonContent = JSON.stringify({
      cand_full_name: 'Bob Jones',
      email_addr: 'bob.jones@example.com',
      phone_num: '415-555-2222',
      company_name: 'Meta',
      position: 'Tech Lead',
      years_of_experience: 5
    });
    const record = await atsJson.extract(jsonContent, 'ats_json');
    expect(record.raw_confidence).toBe(0.95);
    expect(record.fields.name).toBe('Bob Jones');
    expect(record.fields.title).toBe('Tech Lead');
    expect(record.fields.years_experience).toBe(5);
  });

  it('atsJson extract malformed JSON', async () => {
    const record = await atsJson.extract('invalid json string', 'ats_json');
    expect(record.raw_confidence).toBe(0);
    expect(record.fields).toEqual({});
  });

  it('githubApi extract happy path', async () => {
    const record = await githubApi.extract('octocat', 'github_api');
    expect(record.raw_confidence).toBe(0.8);
    expect(record.fields.name).toBe('The Octocat');
    expect(record.fields.email).toBe('octocat@github.com');
    expect(record.fields.languages).toEqual(['JavaScript', 'TypeScript']);
  });

  it('githubApi extract network failure degrades gracefully', async () => {
    const record = await githubApi.extract('erroruser', 'github_api');
    expect(record.raw_confidence).toBe(0);
    expect(record.fields).toEqual({});
  });

  it('linkedinJson extract happy path', async () => {
    const jsonContent = JSON.stringify({
      name: 'Alice Smith',
      headline: 'Google Staff Engineer',
      emails: ['alice@example.com']
    });
    const record = await linkedinJson.extract(jsonContent, 'linkedin_json');
    expect(record.raw_confidence).toBe(0.9);
    expect(record.fields.name).toBe('Alice Smith');
  });

  it('resumePdf extract happy path', async () => {
    const record = await resumePdf.extract(Buffer.from('VALID_PDF'), 'resume.pdf');
    expect(record.raw_confidence).toBe(0.7);
    expect(record.fields.name).toBe('Alice Smith');
    expect(record.fields.emails).toContain('alice.smith@example.com');
    expect(record.fields.skills).toContain('React');
  });

  it('resumePdf extract parses invalid binary gracefully', async () => {
    const record = await resumePdf.extract(Buffer.from('INVALID'), 'resume.pdf');
    expect(record.raw_confidence).toBe(0);
    expect(record.fields).toEqual({});
  });

  it('resumeDocx extract happy path', async () => {
    const record = await resumeDocx.extract(Buffer.from('VALID_DOCX'), 'resume.docx');
    expect(record.raw_confidence).toBe(0.7);
    expect(record.fields.name).toBe('Bob Jones');
    expect(record.fields.emails).toContain('bob.jones@example.com');
  });

  it('resumeDocx extract parses invalid binary gracefully', async () => {
    const record = await resumeDocx.extract(Buffer.from('INVALID'), 'resume.docx');
    expect(record.raw_confidence).toBe(0);
    expect(record.fields).toEqual({});
  });

  it('recruiterNotes extract checks low raw confidence (<= 0.3)', async () => {
    const notesContent = 'Contact Alice at alice@example.com. She knows React.';
    const record = await recruiterNotes.extract(notesContent, 'recruiter_notes');
    expect(record.raw_confidence).toBeLessThanOrEqual(0.3);
    expect(record.fields.emails).toContain('alice@example.com');
  });

  it('Bug 1 Regression: linkedinJson extract garbage input returns empty record with raw_confidence 0', async () => {
    const record = await linkedinJson.extract('garbage_input_not_a_url', 'test');
    expect(record.raw_confidence).toBe(0);
    expect(record.fields.name).toBeNull();
    expect(record.fields.headline).toBeNull();
    expect(record.fields.experience).toEqual([]);
  });

  it('Bug 2 Regression: linkedinJson extract slug-derived URL returns name, null headline, raw_confidence 0.3', async () => {
    const record = await linkedinJson.extract('https://www.linkedin.com/in/bhavana-siva-sri-2a9168291/', 'test');
    expect(record.raw_confidence).toBe(0.3);
    expect(record.fields.name).toBe('Bhavana Siva Sri');
    expect(record.fields.headline).toBeNull();
  });

  it('Bug 3 Regression: resumeTextParser link parser extracts bare domain links', () => {
    const text = 'linkedin.com/in/bhavana | github.com/bhavana | Personal Portfolio';
    const fields = parseResumeText(text);
    expect(fields.links.linkedin).toBe('https://linkedin.com/in/bhavana');
    expect(fields.links.github).toBe('https://github.com/bhavana');
  });

  it('Bug 4 Regression: degree matching respects word boundaries', () => {
    const text = 'Education:\nAditya University\nDegree in Mathematics\nPrathibha Junior College\nIntermediate in Physics';
    const fields = parseResumeText(text);
    const eduPrathibha = fields.education.find(e => e.institution.includes('Prathibha'));
    expect(eduPrathibha.degree).toBe('Secondary/Intermediate');
  });

  it('Bug 5 Regression: institution parser splits on em-dash and strips date ranges', () => {
    const text = 'Education:\nAditya University Jan 2023 — Apr 2027\nDegree in IT';
    const fields = parseResumeText(text);
    const edu = fields.education[0];
    expect(edu.institution).toBe('Aditya University');
  });

  it('Bug 6 Regression: graduation year maps to end year', () => {
    const text = 'Education:\nAditya University Jan 2023 — Apr 2027\nDegree in IT';
    const fields = parseResumeText(text);
    const edu = fields.education[0];
    expect(edu.end_year).toBe(2027);
  });

  it('Bug 7 Regression: experience title and month-aware dates', () => {
    const text = 'Experience:\nFrontend Developer May 2025 - July 2025\nWorked on SkillHance';
    const fields = parseResumeText(text);
    const exp = fields.experience[0];
    expect(exp.title).toBe('Frontend Developer');
    expect(exp.start).toBe('2025-05');
    expect(exp.end).toBe('2025-07');
  });

  describe('extractDateRange Unit Tests', () => {
    it('handles Month YYYY - Month YYYY', () => {
      const res = extractDateRange('Jan 2020 - Dec 2022');
      expect(res.start).toBe('2020-01');
      expect(res.end).toBe('2022-12');
      expect(res.matchedText).toBe('Jan 2020 - Dec 2022');
    });

    it('handles Month YYYY - Present', () => {
      const res = extractDateRange('May 2025 - Present');
      expect(res.start).toBe('2025-05');
      expect(res.end).toBe('Present');
      expect(res.matchedText).toBe('May 2025 - Present');
    });

    it('handles YYYY - YYYY', () => {
      const res = extractDateRange('2019 - 2021');
      expect(res.start).toBe('2019-01');
      expect(res.end).toBe('2021-01');
      expect(res.matchedText).toBe('2019 - 2021');
    });

    it('handles YYYY-MM - YYYY-MM', () => {
      const res = extractDateRange('2020-01 - 2022-12');
      expect(res.start).toBe('2020-01');
      expect(res.end).toBe('2022-12');
      expect(res.matchedText).toBe('2020-01 - 2022-12');
    });

    it('handles no date at all safely', () => {
      const res = extractDateRange('No date pattern here');
      expect(res.start).toBeNull();
      expect(res.end).toBeNull();
      expect(res.matchedText).toBeNull();
    });
  });

  describe('Synthetic Resume Fixture Integration Tests', () => {
    it('parses Fixture A correctly (single-line formats)', async () => {
      const filePath = path.join(__dirname, 'fixtures', 'resume_fixture_a.txt');
      const text = await fs.readFile(filePath, 'utf-8');
      const fields = parseResumeText(text);

      expect(fields.experience).toHaveLength(1);
      const exp = fields.experience[0];
      expect(exp.company).toBe('Acme Corp');
      expect(exp.title).toBe('Senior Engineer');
      expect(exp.start).toBe('2020-01');
      expect(exp.end).toBe('2022-12');

      expect(fields.education).toHaveLength(1);
      const edu = fields.education[0];
      expect(edu.institution).toBe('Acme University');
      expect(edu.degree).toBe('Bachelor');
      expect(edu.field).toBe('Computer Science');
      expect(edu.end_year).toBe(2019);
    });

    it('parses Fixture B correctly (at phrasing and Degree in Field phrasing)', async () => {
      const filePath = path.join(__dirname, 'fixtures', 'resume_fixture_b.txt');
      const text = await fs.readFile(filePath, 'utf-8');
      const fields = parseResumeText(text);

      expect(fields.experience).toHaveLength(1);
      const exp = fields.experience[0];
      expect(exp.company).toBe('Globex Inc');
      expect(exp.title).toBe('Software Engineer');
      expect(exp.start).toBe('2019-01');
      expect(exp.end).toBe('2021-01');

      expect(fields.education).toHaveLength(1);
      const edu = fields.education[0];
      expect(edu.institution).toBe('Globex University');
      expect(edu.degree).toBe('Master');
      expect(edu.field).toBe('Data Science');
      expect(edu.end_year).toBe(2019);
    });
  });
});
