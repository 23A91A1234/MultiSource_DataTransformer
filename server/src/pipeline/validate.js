import { z } from 'zod';
import { CanonicalProfileSchema } from '../schema/canonicalProfile.js';

/**
 * Validates a profile against the CanonicalProfile Zod schema.
 * @param {object} profile 
 * @returns {object} The parsed/validated profile
 */
export function validateCanonical(profile) {
  return CanonicalProfileSchema.parse(profile);
}

/**
 * Dynamically builds a Zod schema based on the output config fields.
 * Handles nested dot paths (e.g. contact.email) and data types.
 * @param {object} config - OutputConfig shape
 * @returns {z.ZodObject} Dynamic Zod schema
 */
export function buildProjectedSchema(config) {
  if (!config || !Array.isArray(config.fields)) {
    return z.any();
  }

  const shape = {};

  const assignSchemaPath = (currentShape, parts, fieldSchema) => {
    const part = parts[0];
    if (parts.length === 1) {
      currentShape[part] = fieldSchema;
      return;
    }

    if (!currentShape[part] || currentShape[part] instanceof z.ZodType) {
      currentShape[part] = {};
    }

    assignSchemaPath(currentShape[part], parts.slice(1), fieldSchema);
  };

  const convertToZodObject = (obj) => {
    const zodShape = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val instanceof z.ZodType) {
        zodShape[key] = val;
      } else {
        zodShape[key] = convertToZodObject(val);
      }
    }
    return z.object(zodShape);
  };

  for (const field of config.fields) {
    let fieldSchema;
    switch (field.type) {
      case 'string':
        fieldSchema = z.string();
        break;
      case 'number':
        fieldSchema = z.number();
        break;
      case 'boolean':
        fieldSchema = z.boolean();
        break;
      case 'string[]':
        fieldSchema = z.array(z.string());
        break;
      case 'object':
        fieldSchema = z.union([z.array(z.any()), z.record(z.any())]);
        break;
      default:
        fieldSchema = z.any();
    }

    if (field.required === false) {
      fieldSchema = fieldSchema.nullable().optional();
    }

    const parts = field.path.split('.');
    assignSchemaPath(shape, parts, fieldSchema);
  }

  // Construct top-level schema and include optional metadata keys if config has them enabled
  const finalShape = convertToZodObject(shape);

  let extendedShape = finalShape.shape;
  
  if (config.include_confidence !== false) {
    extendedShape = {
      ...extendedShape,
      overall_confidence: z.number().min(0).max(1).optional().nullable()
    };
  }

  if (config.include_provenance !== false) {
    extendedShape = {
      ...extendedShape,
      provenance: z.array(
        z.object({
          field: z.string(),
          source: z.string(),
          method: z.string()
        })
      ).optional()
    };
  }

  return z.object(extendedShape);
}

/**
 * Validates a projected profile against the dynamically generated Zod schema.
 * @param {object} output 
 * @param {object} config 
 * @returns {object} The parsed/validated output
 */
export function validateProjected(output, config) {
  const schema = buildProjectedSchema(config);
  return schema.parse(output);
}
