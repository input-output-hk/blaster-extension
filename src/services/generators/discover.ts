import { resolve } from 'node:path';

export const LIST_GENERATORS_SCRIPT = 'scripts/blueprints/list-generators.js';

type ListedProperty = {
  id: string;
  kind: 'explicit' | 'template';
  title?: string;
  content?: string;
  file: string;
  range: TestRange;
};

export type ListedGenerator = {
  target: string;
  cwd: string;
  argv: Array<string>;
  properties: Array<ListedProperty> | null;
  propertyDiscoveryError?: string;
};

/**
 * Tells whether a value is a plain object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Tells whether a value is a zero-based `{ line, character }` position.
 */
function isPosition(value: unknown): value is TestRangePosition {
  return isRecord(value) && Number.isInteger(value.line) && Number.isInteger(value.character)
    && (value.line as number) >= 0 && (value.character as number) >= 0;
}

/**
 * Tells whether a value is a string.
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Tells whether a value is an optional string field.
 */
function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/**
 * Tells whether a value is one property of a list-generators entry.
 */
function isProperty(value: unknown): value is ListedProperty {
  return isRecord(value)
    && typeof value.id === 'string' && value.id !== ''
    && (value.kind === 'explicit' || value.kind === 'template')
    && isOptionalString(value.title) && isOptionalString(value.content)
    && typeof value.file === 'string'
    && isRecord(value.range) && isPosition(value.range.start) && isPosition(value.range.end);
}

/**
 * Tells whether a value is one list-generators entry, with only the fields discovery uses.
 */
function isGenerator(value: unknown): value is ListedGenerator {
  if (!isRecord(value) || typeof value.target !== 'string' || value.target === '' || typeof value.cwd !== 'string') return false;
  if (!Array.isArray(value.argv) || value.argv.length === 0 || !value.argv.every(isString)) return false;
  if (value.properties === null) return typeof value.propertyDiscoveryError === 'string';
  return Array.isArray(value.properties) && value.properties.every(isProperty);
}

/**
 * Parses and validates the stdout of list-generators.js. Throws on anything unexpected.
 */
export function parseGenerators(stdout: string): Array<ListedGenerator> {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Unable to read ${LIST_GENERATORS_SCRIPT} output: ${String(error)}`);
  }
  if (!Array.isArray(value)) throw new Error(`Unexpected ${LIST_GENERATORS_SCRIPT} output: expected an array.`);
  const invalid = value.findIndex(isInvalidGenerator);
  if (invalid >= 0) throw new Error(`Unexpected ${LIST_GENERATORS_SCRIPT} output: invalid generator at index ${invalid}.`);
  return value;
}

/**
 * Tells whether a list-generators entry fails validation.
 */
function isInvalidGenerator(value: unknown): boolean {
  return !isGenerator(value);
}

/**
 * Builds the test ID of a Haskell property. It doesn't depend on the property's position.
 */
export function makeHaskellTestId(target: string, propertyId: string): string {
  return `ual:${target}:${propertyId}`;
}

/**
 * Turns one generator property into a tree test. Ranges are already zero-based (VS Code), so they are used as is.
 */
export function toHaskellTest(workspaceId: string, generator: ListedGenerator, property: ListedProperty, index: number): Test {
  return {
    id: makeHaskellTestId(generator.target, property.id),
    name: property.id,
    group: [generator.target],
    location: { path: resolve(generator.cwd, property.file), range: property.range },
    status: 'empty',
    isWaiting: false,
    isRunning: false,
    workspaceId,
    haskell: {
      generator: generator.target,
      propertyId: property.id,
      index,
      kind: property.kind,
      title: property.title,
      content: property.content,
    },
  };
}
