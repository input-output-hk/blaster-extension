export type FolderNode = {
    label: string;
    path: string;
    timeToExecute: string;
    status: 'valid' | 'falsified' | 'unchecked';
    type: 'folder';
    children: Array<FileNode | FolderNode>;
}

export type FileNode = {
    label: string;
    path: string;
    timeToExecute: string;
    status: 'valid' | 'falsified' | 'unchecked';
    type: 'file';
    children: PropertyNode[];
}

export type PropertyNode = {
    label: string;
    path: string;
    timeToExecute: string;
    status: 'valid' | 'falsified' | 'undetermined' | 'unchecked' | 'error';
    parentFile: string;
    type: 'property';
}