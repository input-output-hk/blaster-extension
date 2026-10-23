import { RxDatabase } from 'rxdb';

import {
  workspaceSchema,
  type WorkspaceCollection,
  type WorkspaceDocument,
  type WorkspaceDocumentData
} from './schemas/workspace';

import {
  testSchema,
  type TestCollection,
  type TestDocument,
  type TestDocumentData
} from './schemas/test';

import {
  testResultSchema,
  type TestResultCollection,
  type TestResultDocument,
  type TestResultDocumentData
} from './schemas/testResult';

export const databaseCollections = {
  workspaces: {
    schema: workspaceSchema,
  },
  tests: {
    schema: testSchema,
  },
  testResults: {
    schema: testResultSchema,
  },
};

export type DatabaseCollections = {
  workspaces: WorkspaceCollection,
  tests: TestCollection,
  testResults: TestResultCollection,
};

export type Database = RxDatabase<DatabaseCollections>;

export type {
  WorkspaceDocument,
  WorkspaceDocumentData,
  TestDocument,
  TestDocumentData,
  TestResultDocument,
  TestResultDocumentData,
};