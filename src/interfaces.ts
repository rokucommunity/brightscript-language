import { File } from './File';

export interface Diagnostic {
    severity: string | 'warning' | 'error';
    message: string;
    filePath: string;
    lineIndex: number;
    columnIndexBegin: number;
    columnIndexEnd: number;
    file: File;
}

export interface Callable {
    file: File;
    name: string;
    type: 'function' | 'sub';
    description?: string;
    returnType: BRSType;
    params: CallableParam[];
    lineIndex?: number;
    columnIndexBegin?: number;
    columnIndexEnd?: number;
    isDepricated?: boolean;
}

export interface ExpressionCall {
    file: File;
    name: string;
    params: CallableParam[];
    lineIndex: number;
    columnIndexBegin: number;
    columnIndexEnd: number;
}

export interface CallableParam {
    name: string;
    type: BRSType;
    isOptional: boolean;
    /**
     * Indicates that an unlimited number of arguments can be passed in
     */
    isRestArgument: boolean;
}
export type BRSType = 'boolean' | 'integer' | 'longinteger' | 'float' | 'double' | 'string' | 'string[]' | 'object' | 'function' | 'interface' | 'invalid' | 'dynamic';

export interface FileObj {
    src: string;
    dest: string;
}