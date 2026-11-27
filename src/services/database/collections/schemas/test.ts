import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
  RxDocument,
  RxCollection,
} from 'rxdb';

import {
  booleanSchema,
  numberSchema,
  stringSchema,
  runStatusSchema,
  rangeSchema,
  testIdSchema,
  workspaceIdSchema,
  workspaceTestIdSchema
} from '../common/schemas';

const testSchemaLiteral = {
  title: 'test',
  version: 0,
  primaryKey: {
    key: 'id',
    fields: ['workspaceId', 'testId'],
    separator: ':',
  },
  type: 'object',
  properties: {
    id: workspaceTestIdSchema,
    testId: testIdSchema,
    workspaceId: workspaceIdSchema,
    name: stringSchema,
    group: {
      type: 'array',
      items: stringSchema
    },
    status: runStatusSchema,
    isWaiting: booleanSchema,
    isRunning: booleanSchema,
    location: {
      type: 'object',
      properties: {
        path: stringSchema,
        range: rangeSchema,
      },
      required: ['path', 'range'],
    },
    time: numberSchema,
    haskell: {
      type: 'object',
      properties: {
        generator: stringSchema,
        propertyId: stringSchema,
        index: numberSchema,
        kind: { type: 'string', enum: ['explicit', 'template'] },
        title: stringSchema,
        content: stringSchema,
        scope: stringSchema,
      },
      required: ['generator', 'propertyId', 'index', 'kind'],
    },
  },
  required: [
    'id',
    'testId',
    'workspaceId',
    'name',
    'group',
    'status',
    'isWaiting',
    'isRunning',
    'location',
  ],
  indexes: [
    'workspaceId',
  ],
} as const;

const schemaTyped = toTypedRxJsonSchema(testSchemaLiteral);
type TestDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;
export const testSchema: RxJsonSchema<TestDocType> = testSchemaLiteral;
export type TestDocument = RxDocument<TestDocType>;
export type TestDocumentData = TestDocType;
export type TestCollection = RxCollection<TestDocType>;
