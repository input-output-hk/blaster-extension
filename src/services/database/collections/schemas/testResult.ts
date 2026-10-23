import {
  toTypedRxJsonSchema,
  ExtractDocumentTypeFromTypedRxJsonSchema,
  RxJsonSchema,
  RxDocument,
  RxCollection,
} from 'rxdb';

import {
  testIdSchema,
  workspaceIdSchema,
  workspaceTestIdSchema
} from '../common/schemas';

const testResultSchemaLiteral = {
  title: 'testResult',
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
    steps: { type: 'array', items: { type: 'object' } },
    graph: { type: 'array', items: { type: 'object' } },
  },
  required: [
    'id',
    'testId',
    'workspaceId',
  ],
  indexes: [
    'workspaceId',
  ],
} as const;

const schemaTyped = toTypedRxJsonSchema(testResultSchemaLiteral);
type TestResultDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped> & TestResult;
export const testResultSchema: RxJsonSchema<TestResultDocType> = testResultSchemaLiteral;
export type TestResultDocument = RxDocument<TestResultDocType>;
export type TestResultDocumentData = TestResultDocType;
export type TestResultCollection = RxCollection<TestResultDocType>;
