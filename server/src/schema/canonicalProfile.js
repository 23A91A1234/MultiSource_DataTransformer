import { z } from 'zod';

export const CanonicalProfileSchema = z.object({
  candidate_id: z.string(),
  full_name: z.string(),
  emails: z.array(z.string().email()),
  phones: z.array(z.string()), // E.164 format, e.g. "+14155551234"
  location: z.object({
    city: z.string().nullable(),
    region: z.string().nullable(),
    country: z.string().length(2).nullable() // ISO-3166 alpha-2
  }).nullable(),
  links: z.object({
    linkedin: z.string().url().nullable(),
    github: z.string().url().nullable(),
    portfolio: z.string().url().nullable(),
    other: z.array(z.string().url())
  }),
  headline: z.string().nullable(),
  years_experience: z.number().nullable(),
  skills: z.array(z.object({
    name: z.string(), // canonical skill name
    confidence: z.number().min(0).max(1),
    sources: z.array(z.string())
  })),
  experience: z.array(z.object({
    company: z.string().nullable(),
    title: z.string().nullable(),
    start: z.string().regex(/^\d{4}-\d{2}$/).nullable(), // YYYY-MM
    end: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
    summary: z.string().nullable()
  })),
  education: z.array(z.object({
    institution: z.string().nullable(),
    degree: z.string().nullable(),
    field: z.string().nullable(),
    end_year: z.number().nullable()
  })),
  provenance: z.array(z.object({
    field: z.string(), // dot-path, e.g. "phones[0]"
    source: z.string(), // e.g. "recruiter_csv", "github_api"
    method: z.string() // e.g. "direct", "regex_extract", "merged_majority"
  })),
  overall_confidence: z.number().min(0).max(1)
});

export default CanonicalProfileSchema;
