
export const booleanSchema = {
  type: 'boolean',
} as const;

export const numberSchema = {
  type: 'number',
} as const;

export const stringSchema = {
  type: 'string',
} as const;

export const finalStringSchema = {
  type: 'string',
  final: true,
} as const;

export const runStatusSchema = {
  type: 'string',
  enum: ['undetermined', 'valid', 'invalid'],
} as const;

export const workspaceIdSchema = {
  type: 'string',
  maxLength: 8,
  final: true,
} as const;

export const testIdSchema = {
  type: 'string',
  maxLength: 256,
  final: true,
} as const;

export const workspaceTestIdSchema = {
  type: 'string',
  maxLength: 256 + 8 + 1,
  final: true,
} as const;

export const positionSchema = {
  type: 'object',
  properties: {
    line: numberSchema,
    character: numberSchema,
  },
  required: ['line', 'character'],
} as const;

export const rangeSchema = {
  type: 'object',
  properties: {
    start: positionSchema,
    end: positionSchema,
  },
  required: ['start', 'end'],
} as const;