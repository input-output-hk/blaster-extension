export type FolderNode = {
    label: string;
    path: string;
    type: 'folder';
    children: Array<FileNode | FolderNode>;
}

export type FileNode = {
    label: string;
    path: string;
    type: 'file';
    children: PropertyNode[];
}

export type PropertyNode = {
    label: string;
    position: number;
    path: string;
    status: 'valid' | 'falsified' | 'undetermined' | 'unchecked';
    time: number;
    cex?: object;
    parentFile: string;
    type: 'property';
}

export type Property = Record<string, string[]>;