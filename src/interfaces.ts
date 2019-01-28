import { BRSFile } from './BRSFile';

export interface BRSError {
    severity: string | 'warning' | 'error';
    message: string;
    filePath: string;
    lineIndex: number;
    columnIndexBegin: number;
    columnIndexEnd: number;
}

export interface BRSCallable {
    file: BRSFile;
    name: string;
    type: 'function' | 'sub';
    params: BRSParam[];
    lineIndex: number;
    columnIndexBegin: number;
    columnIndexEnd: number;
}

export interface BRSExpressionCall {
    file: BRSFile;
    name: string;
    params: BRSParam[];
    lineIndex: number;
    columnIndexBegin: number;
    columnIndexEnd: number;
}

export interface BRSParam {
    name: string;
    type: 'string';
}