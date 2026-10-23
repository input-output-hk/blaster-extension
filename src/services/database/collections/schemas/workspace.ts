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
  runStatusSchema,
  finalStringSchema,
  workspaceIdSchema,
} from '../common/schemas';

const workspaceSchemaLiteral = {
  title: 'workspace',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: workspaceIdSchema,
    path: finalStringSchema,
    status: runStatusSchema,
    isWaiting: booleanSchema,
    isRunning: booleanSchema,
    time: numberSchema,
  },
  required: [
    'id',
    'path',
    'status',
    'isWaiting',
    'isRunning',
  ]
} as const;

const schemaTyped = toTypedRxJsonSchema(workspaceSchemaLiteral);
type WorkspaceDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof schemaTyped>;
export const workspaceSchema: RxJsonSchema<WorkspaceDocType> = workspaceSchemaLiteral;
export type WorkspaceDocument = RxDocument<WorkspaceDocType>;
export type WorkspaceDocumentData = WorkspaceDocType;
export type WorkspaceCollection = RxCollection<WorkspaceDocType>;
