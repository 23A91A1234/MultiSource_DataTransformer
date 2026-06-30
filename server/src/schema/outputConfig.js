import { z } from 'zod';

export const OutputConfigSchema = z.object({
  fields: z.array(z.object({
    path: z.string(), // output field name, supports dot-paths or simple names
    from: z.string(), // canonical source path, e.g., "emails[0]", "location.city"
    type: z.enum(["string", "number", "boolean", "string[]", "object"]),
    required: z.boolean().default(false),
    normalize: z.enum(["E164", "canonical", "YYYY-MM"]).optional()
  })),
  include_confidence: z.boolean().default(true),
  include_provenance: z.boolean().default(true),
  on_missing: z.enum(["null", "omit", "error"]).default("null")
});

export default OutputConfigSchema;
