export type FolderNode = {
    label: string;
    path: string;
    timeToExecute: string;
    status: 'valid' | 'falsified' | 'unchecked';
    type: 'folder' | 'file';
    children?: PropertyNode[] | FolderNode[];
}

export type PropertyNode = {
    label: string;
    path: string;
    timeToExecute: string;
    status: 'valid' | 'falsified' | 'undetermined' | 'unchecked' | 'error';
    parentFile: string;
    type: 'property'
}

export type TreeNode = [string, string, string[]]