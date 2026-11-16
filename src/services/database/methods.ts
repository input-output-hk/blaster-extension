import { basename } from 'node:path';
import { getGroupStatus, matchesTestRun } from '../../utils/testRun';

import type { Database, TestDocument, TestDocumentData, WorkspaceDocument } from './collections';

const toTest = (document: TestDocumentData): Test => ({
	id: document.testId,
	workspaceId: document.workspaceId,
	name: document.name,
	group: document.group,
	status: document.status,
	isWaiting: document.isWaiting,
	isRunning: document.isRunning,
	location: {
		path: document.location.path,
		range: {
			start: {
				line: document.location.range.start.line,
				character: document.location.range.start.character,
			},
			end: {
				line: document.location.range.end.line,
				character: document.location.range.end.character,
			},
		},
	},
	time: document.time,
});

export const getTest = async (database: Database, workspaceId: string, testId: string): Promise<Test> => {
	const testDocument: TestDocument | null = await database.tests.findOne({
		selector: { id: `${workspaceId}:${testId}` }
	}).exec();

	if (testDocument === null) throw new Error(`Test not found for id: ${workspaceId}:${testId}`);

	return toTest(testDocument);
};

export const getTestResult = async (database: Database, workspaceId: string, testId: string): Promise<TestResult> => {
	const resultDocument = await database.testResults.findOne({
		selector: { id: `${workspaceId}:${testId}` }
	}).exec();

	if (resultDocument === null) return {};

	return {
		steps: resultDocument.steps,
		graph: resultDocument.graph,
	};
};

const updateWorkspace = async (database: Database, workspaceId: string): Promise<void> => {
	const workspaceDocument: WorkspaceDocument | null = await database.workspaces.findOne({
		selector: { id: workspaceId }
	}).exec();

	if (workspaceDocument === null) return;

	const tests: Array<TestDocument> = await database.tests.find({
		selector: { workspaceId }
	}).exec();

	const isWaiting = tests.some(test => test.isWaiting);
	const isRunning = tests.some(test => test.isRunning) || (workspaceDocument.isRunning && isWaiting);
	const status = getGroupStatus(tests);

	await workspaceDocument.update({
		$set: {
			status,
			isWaiting: isWaiting && !isRunning,
			isRunning,
			time: isWaiting || isRunning ? undefined : tests.reduce((sum, test) => sum + (test.time ?? 0), 0),
		}
	});
};

export const handleTestUpdateEvent = async (database: Database, event: TestUpdateEvent): Promise<void> => {
	const { workspaceId, testId, status, isRunning, time } = event.payload;

	const testDocument: TestDocument | null = await database.tests.findOne({
		selector: { id: `${workspaceId}:${testId}` }
	}).exec();

	if (testDocument !== null) {
		if (isRunning && !testDocument.isRunning) {
			await database.testResults.findOne({
				selector: { id: `${workspaceId}:${testId}` }
			}).remove();
		}

		const updateData: Partial<TestDocumentData> = {};
		if (time !== undefined) updateData.time = time;
		if (isRunning !== undefined) updateData.isRunning = isRunning;
		if (isRunning === true) updateData.isWaiting = false;

		if (status !== undefined) {
			updateData.status = status;
			updateData.isRunning = isRunning ?? false;
			updateData.isWaiting = false;
		}

		await testDocument.update({ $set: updateData });
		await updateWorkspace(database, workspaceId);
	}
};

export const handleTestResultEvent = async (database: Database, event: TestResultEvent): Promise<void> => {
	const { workspaceId, testId, result } = event.payload;
	const id = `${workspaceId}:${testId}`;
	const testDocument = await database.tests.findOne({ selector: { id } }).exec();

	if (testDocument === null) return;

	await database.testResults.upsert({
		id,
		workspaceId,
		testId,
		steps: result.steps,
		graph: result.graph,
	});
};

export const handleTestErrorEvent = async (database: Database, event: TestErrorEvent): Promise<void> => {
	const { workspaceId, testId } = event.payload;

	await database.testResults.findOne({
		selector: { id: `${workspaceId}:${testId}` }
	}).remove();

	await handleTestUpdateEvent(database, {
		type: 'test-update',
		payload: { workspaceId, testId, status: 'error', isRunning: false }
	});
};

const getRunTests = async (database: Database, testRuns: Array<TestRun>): Promise<Array<TestDocument>> => {
	const workspaceIds = Array.from(new Set(testRuns.map(run => run.workspaceId)));
	const tests = await database.tests.find({ selector: { workspaceId: { $in: workspaceIds } } }).exec();
	return tests.filter(test => testRuns.some(run => matchesTestRun(test, run)));
};

export const handleTestRun = async (database: Database, testRuns: Array<TestRun>): Promise<void> => {
	const tests = await getRunTests(database, testRuns);
	
	if (tests.length === 0) return;
	const testIds = tests.map(test => test.id);
	const workspaceIds = Array.from(new Set(tests.map(test => test.workspaceId)));

	await database.tests
		.findByIds(testIds)
		.update({ $set: { isWaiting: true, status: 'empty', time: undefined } });

	await database.workspaces
		.findByIds(workspaceIds)
		.update({ $set: { isWaiting: true, time: undefined } });

	await database.testResults
		.findByIds(testIds)
		.remove();
};

export const handleTestRunAll = async (database: Database): Promise<void> => {
	await database.tests.find()
		.update({ $set: { isWaiting: true, status: 'empty', time: undefined } });

	await database.workspaces.find()
		.update({ $set: { isWaiting: true, time: undefined } });

	await database.testResults.find().remove();
};

export const handleTestRunFailedEvent = async (database: Database, event: TestRunFailedEvent): Promise<void> => {
	const tests = await getRunTests(database, [event.payload.testRun]);

	for (const test of tests) {
		await handleTestUpdateEvent(database, {
			type: 'test-update',
			payload: { workspaceId: test.workspaceId, testId: test.testId, status: 'empty', isRunning: false }
		});
	}
};

const createTestTree = (workspaceId: string, openState: Record<string, boolean>, tests: Array<Test>): GenericMap<TestTreeGroupNode> => {
	const nodes: GenericMap<TestTreeGroupNode> = {};

	for (const test of tests) {
		const group = test.group.length > 0 ? test.group : [basename(test.location.path)];
		let currentNodes = nodes;

		for (let index = 0; index < group.length; index++) {
			const name = group[index];
			const isOpen = openState[[workspaceId, ...group.slice(0, index + 1)].join(':')] ?? false;

			if (index === group.length - 1) {
				if (currentNodes[name] === undefined) {
					currentNodes[name] = { type: 'file', name, isOpen, tests: {} } as TestTreeFileNode;
				}
				(currentNodes[name] as TestTreeFileNode).tests[test.id] = test;
			} else {
				if (currentNodes[name] === undefined) {
					currentNodes[name] = { type: 'folder', name, isOpen, nodes: {} } as TestTreeFolderNode;
				}
				currentNodes = (currentNodes[name] as TestTreeFolderNode).nodes;
			}
		}
	}

	return nodes;
};

export const fetchTestTree = async (database: Database, openState: Record<string, boolean>): Promise<TestTree> => {
	const testTree: TestTree = { workspaces: {} };

	const workspaceDocuments: Array<WorkspaceDocument> = await database.workspaces.find().exec();
	for (const workspaceDocument of workspaceDocuments) {
		const testDocuments: Array<TestDocument> = await database.tests.find({
			selector: { workspaceId: workspaceDocument.id }
		}).exec();

		testTree.workspaces[workspaceDocument.id] = {
			id: workspaceDocument.id,
			path: workspaceDocument.path,
			status: workspaceDocument.status,
			isWaiting: workspaceDocument.isWaiting,
			isRunning: workspaceDocument.isRunning,
			time: workspaceDocument.time,
			isOpen: openState[workspaceDocument.id] ?? false,
			nodes: createTestTree(workspaceDocument.id, openState, testDocuments.map(toTest)),
		};
	}

	return testTree;
};

const getTreeTests = (nodes: GenericMap<TestTreeGroupNode>): Array<Test> => {
	const tests: Array<Test> = [];
	for (const node of Object.values(nodes)) {
		if (node.type === 'folder') {
			tests.push(...getTreeTests((node as TestTreeFolderNode).nodes));
		} else {
			tests.push(...Object.values((node as TestTreeFileNode).tests));
		}
	}
	return tests;
};

export const storeTestTree = async (database: Database, testTree: TestTree, openState: Record<string, boolean>): Promise<TestTree> => {
	const workspaceIds = new Set(Object.keys(testTree.workspaces));
	const workspaceDocuments = await database.workspaces.find().exec();

	for (const workspaceDocument of workspaceDocuments) {
		if (!workspaceIds.has(workspaceDocument.id)) {
			const workspaceQuery = { selector: { workspaceId: workspaceDocument.id } };
			await database.testResults.find(workspaceQuery).remove();
			await database.tests.find(workspaceQuery).remove();
			await workspaceDocument.remove();
		}
	}

	for (const workspace of Object.values(testTree.workspaces)) {
		const tests = getTreeTests(workspace.nodes);
		const testIds = new Set(tests.map(test => test.id));
		const testDocuments = await database.tests.find({
			selector: { workspaceId: workspace.id }
		}).exec();

		for (const testDocument of testDocuments) {
			if (!testIds.has(testDocument.testId)) {
				await database.testResults.findOne({ selector: { id: testDocument.id } }).remove();
				await testDocument.remove();
			}
		}

		await database.tests.bulkUpsert(tests.map(test => ({
			id: `${workspace.id}:${test.id}`,
			workspaceId: workspace.id,
			testId: test.id,
			name: test.name,
			group: test.group,
			location: test.location,
			status: test.status,
			isWaiting: test.isWaiting,
			isRunning: test.isRunning,
			time: test.time,
		})));

		await database.workspaces.upsert({
			id: workspace.id,
			path: workspace.path,
			status: workspace.status,
			isWaiting: workspace.isWaiting,
			isRunning: workspace.isRunning,
			time: workspace.time,
		});
	}

	return await fetchTestTree(database, openState);
};

export const clearTestResults = async (database: Database): Promise<void> => {
	await database.testResults.find().remove();
	await database.tests.find().update({ $set: { status: 'empty', time: undefined } });
	await database.workspaces.find().update({ $set: { status: 'empty', time: undefined } });
};

export const onTestUpdate = (database: Database, callback: (payload: TestTreeUpdate) => void): void => {
	database.tests.update$.subscribe(changeEvent => {
		callback({ type: 'test', test: toTest(changeEvent.documentData) });
	});

	database.testResults.$.subscribe(async changeEvent => {
		const testDocument = await database.tests.findOne({
			selector: { id: changeEvent.documentData.id }
		}).exec();
		if (testDocument !== null) {
			callback({ type: 'test', test: toTest(testDocument) });
		}
	});
};

export const onTestTreeUpdate = (
	database: Database,
	openState: Record<string, boolean>,
	callback: (payload: TestTreeUpdate) => void
): void => {
	database.workspaces.update$.subscribe(async changeEvent => {
		const document = changeEvent.documentData;
		const update: TestTreeWorkspaceUpdate = { id: document.id };

		if (document.time !== changeEvent.previousDocumentData?.time) {
			update.time = document.time;
		}

		if (document.status !== changeEvent.previousDocumentData?.status) {
			update.status = document.status;
		}

		if (document.isWaiting !== changeEvent.previousDocumentData?.isWaiting) {
			update.isWaiting = document.isWaiting;
		}

		if (document.isRunning !== changeEvent.previousDocumentData?.isRunning) {
			update.isRunning = document.isRunning;
		}

		const testDocuments: Array<TestDocument> = await database.tests.find({
			selector: { workspaceId: document.id }
		}).exec();

		update.nodes = createTestTree(document.id, openState, testDocuments.map(toTest));
		update.isOpen = openState[document.id] ?? false;

		callback({ type: 'workspace', workspace: update });
	});
};
