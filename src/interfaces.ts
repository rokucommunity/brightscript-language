import { BRSFile } from './BRSFile';

export interface BRSError {
    severity: string | 'warning' | 'error';
    message: string;
    filePath: string;
    lineIndex: number;
    columnIndexBegin: number;
    columnIndexEnd: number;
    file: BRSFile
}

export interface BRSCallable {
    file: BRSFile;
    name: string;
    type: 'function' | 'sub';
    description?: string;
    returnType: BRSType;
    params: BRSParam[];
    lineIndex?: number;
    columnIndexBegin?: number;
    columnIndexEnd?: number;
    isDepricated?: boolean;
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
    type: BRSType;
    isOptional: boolean;
    /**
     * Indicates that an unlimited number of arguments can be passed in
     */
    isRestArgument: boolean;
}
export type BRSType = 'boolean' | 'integer' | 'longinteger' | 'float' | 'double' | 'string' | 'string[]' | 'object' | 'function' | 'interface' | 'invalid' | 'dynamic';