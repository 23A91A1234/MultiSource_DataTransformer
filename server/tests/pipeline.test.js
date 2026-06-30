import { describe, it, expect } from 'vitest';
import { runPipeline } from '../src/pipeline/index.js';

describe('Pipeline Integration', () => {

  it('runs full pipeline with default config producing schema-valid canonical structures', async () => {
    const csvSource = {
      filename: 'recruiter.csv',
      content: 'name,email,phone,current_company,title\nAlice Smith,alice.smith@example.com,4155551111,Google,Senior Staff Engineer'
    };

    const linkedinSource = {
      filename: 'linkedin.json',
      content: JSON.stringify({
        name: 'Alice M. Smith',
        headline: 'Staff Engineer at Google',
        emails: ['alice.smith@example.com'],
        phones: ['+14155551111'],
        experience: [
          { company: 'Google', title: 'Senior Staff Engineer', start: '2021-06', end: null, summary: 'Leading infrastructure.' }
        ]
      })
    };

    const sources = [csvSource, linkedinSource];

    const result = await runPipeline(sources);

    expect(result.warnings).toEqual([]);
    expect(result.canonicalProfiles.length).toBe(1);
    expect(result.projectedProfiles.length).toBe(1);

    const profile = result.projectedProfiles[0];
    
    // Assert structure matches default Zod schema fields
    expect(profile.candidate_id).toBeDefined();
    expect(profile.full_name).toBe('Alice Smith'); // Preferred from higher confidence or tie-breaker
    expect(profile.emails).toContain('alice.smith@example.com');
    expect(profile.phones).toContain('+14155551111');
    expect(profile.overall_confidence).toBeGreaterThan(0.5);
    expect(profile.provenance.length).toBeGreaterThan(0);
  });

  it('runs full pipeline with custom projection config and validates output shape', async () => {
    const sources = [
      {
        filename: 'recruiter.csv',
        content: 'name,email,phone,current_company,title\nAlice Smith,alice.smith@example.com,4155551111,Google,Senior Eng'
      }
    ];

    const customConfig = {
      fields: [
        { path: 'alias', from: 'full_name', type: 'string', required: true },
        { path: 'contact.primary_email', from: 'emails[0]', type: 'string', required: true },
        { path: 'experience_years', from: 'years_experience', type: 'number', required: false }
      ],
      include_confidence: true,
      include_provenance: false,
      on_missing: 'null'
    };

    const result = await runPipeline(sources, customConfig);

    expect(result.projectedProfiles.length).toBe(1);
    const projected = result.projectedProfiles[0];

    // Assert shape matches custom configuration exactly
    expect(projected.alias).toBe('Alice Smith');
    expect(projected.contact.primary_email).toBe('alice.smith@example.com');
    expect(projected.experience_years).toBeNull(); // Missing required: false maps to null under on_missing: 'null'
    expect(projected.overall_confidence).toBeDefined();
    expect(projected.provenance).toBeUndefined(); // include_provenance was set to false
  });

  it('degrades gracefully on missing or malformed inputs without crashing', async () => {
    // Inject a completely empty source and a garbage CSV
    const sources = [
      {
        filename: 'malformed.csv',
        content: 'invalid,header,without,name,or,email'
      },
      {
        filename: 'recruiter_notes.txt',
        content: 'Candidate is anonymous' // Missing name, emails, phones
      }
    ];

    const result = await runPipeline(sources);

    // Should complete successfully without crashing
    expect(result.projectedProfiles.length).toBe(1);
    const profile = result.projectedProfiles[0];

    // Missing required fields (emails/phones) will penalize confidence to 0.15 (50% penalty on name-only profile)
    expect(profile.overall_confidence).toBe(0.15);
    expect(profile.emails).toEqual([]);
    expect(profile.phones).toEqual([]);
  });
});
