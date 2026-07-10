export function toCamelCase<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const newObj: Record<string, unknown> = {};

  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    newObj[camelKey] = obj[key];
  }

  return newObj;
}
