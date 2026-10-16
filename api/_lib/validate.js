/**
 * Defense-in-depth validator for Vertex responseSchema objects (OpenAPI subset:
 * type, properties, required, items, enum, nullable). Vertex enforces the schema at
 * decode time; this re-checks before anything reaches the client's state mutator.
 */
export function validateSchema(schema, value, path = '$', errors = []) {
  if (value === null || value === undefined) {
    if (schema.nullable || value === undefined) return errors;
    errors.push(`${path}: null is not allowed`);
    return errors;
  }
  switch (schema.type) {
    case 'OBJECT': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path}: expected object`);
        return errors;
      }
      for (const key of schema.required || []) {
        if (value[key] === undefined) errors.push(`${path}.${key}: required`);
      }
      for (const [key, sub] of Object.entries(schema.properties || {})) {
        if (value[key] !== undefined) validateSchema(sub, value[key], `${path}.${key}`, errors);
      }
      break;
    }
    case 'ARRAY': {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array`);
        return errors;
      }
      if (schema.items) value.forEach((v, i) => validateSchema(schema.items, v, `${path}[${i}]`, errors));
      break;
    }
    case 'STRING':
      if (typeof value !== 'string') errors.push(`${path}: expected string`);
      else if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: "${value}" not in [${schema.enum.join(', ')}]`);
      break;
    case 'INTEGER':
      if (typeof value !== 'number' || !Number.isInteger(value)) errors.push(`${path}: expected integer`);
      break;
    case 'NUMBER':
      if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${path}: expected number`);
      break;
    case 'BOOLEAN':
      if (typeof value !== 'boolean') errors.push(`${path}: expected boolean`);
      break;
    default:
      break;
  }
  return errors;
}

/** Rounds stray floats into integers where the schema demands INTEGER (models occasionally emit 2.0). */
export function coerceIntegers(schema, value) {
  if (value === null || value === undefined) return value;
  if (schema.type === 'INTEGER' && typeof value === 'number') return Math.round(value);
  if (schema.type === 'INTEGER' && typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim())) return Math.round(Number(value));
  if (schema.type === 'OBJECT' && typeof value === 'object' && !Array.isArray(value)) {
    const out = { ...value };
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (out[key] !== undefined) out[key] = coerceIntegers(sub, out[key]);
    }
    return out;
  }
  if (schema.type === 'ARRAY' && Array.isArray(value) && schema.items) return value.map((v) => coerceIntegers(schema.items, v));
  return value;
}
