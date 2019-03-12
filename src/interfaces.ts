import { Range } from 'vscode-languageserver';

import { Context } from './Context';
import { BrsFile } from './files/BrsFile';
import { XmlFile } from './files/XmlFile';
import { FunctionScope } from './FunctionScope';
import { BrsType } from './types/BrsType';
import { FunctionType } from './types/FunctionType';

export interface Diagnostic {
    severity: 'hint' | 'information' | 'warning' | 'error';
    /**
     * The message for this diagnostic
     */
    message: string;
    /**
     * The unique diagnostic code for this type of message
     */
    code: number;
    location: Range;
    file: File;

}

export interface Callable {
    file: BrsFile | XmlFile;
    name: string;
    /**
     * Is the callable declared as "sub". If falsey, assumed declared as "function"
     */
    isSub: boolean;
    type: FunctionType;
    /**
     * A short description of the callable. Should be a short sentence.
     */
    shortDescription?: string;
    /**
     * A more lengthy explanation of the callable. This is parsed as markdown
     */
    documentation?: string;
    params: CallableParam[];
    nameRange?: Range;
    bodyRange?: Range;
    isDepricated?: boolean;
}

export interface ExpressionCall {
    functionScope: FunctionScope;
    file: File;
    name: string;
    args: CallableArg[];
    nameRange: Range;
}

/**
 * An argument for an expression call.
 */
export interface CallableArg {
    text: string;
    type: BrsType;
    range: Range;
}

export interface CallableParam {
    name: string;
    type: BrsType;
    isOptional?: boolean;
    /**
     * Indicates that an unlimited number of arguments can be passed in
     */
    isRestArgument?: boolean;
    /**
     * The range for the name of this param
     */
    nameRange: Range;
}

export interface FileObj {
    src: string;
    dest: string;
}

/**
 * Represents a file import in a component <script> tag
 */
export interface FileReference {
    /**
     * The relative path to the referenced file. This is relative to the root, and should
     * be used to look up the file in the program
     */
    pkgPath: string;
    text: string;
    /**
     * The XML file that is doing the importing of this file
     */
    sourceFile: XmlFile;
    /**
     * The index of the line this reference is located at
     */
    lineIndex: number;
    /**
     * The start column index of the file reference
     */
    columnIndexBegin?: number;
    /**
     * The end column index of the file reference
     */
    columnIndexEnd?: number;
}

export interface File {
    /**
     * The absolute path to the file, relative to the pkg
     */
    pkgPath: string;
    pathAbsolute: string;
    getDiagnostics(): Diagnostic[];
}

export interface Assignment {
    name: string;
    /**
     * The type on the left-hand of the assignment (i.e. a = b, this would be the type of a).
     * If this is the first assignemnt for this object, the currentType should be set to uninitialized.
     */
    currentType: BrsType;

    /**
     * The type on the right-hand of the assignment. I.e. a = b, this would be the type of b.
     */
    incomingType: BrsType;
    /**
     * The range for the variable name
     */
    nameRange: Range;
}

//copied from brs (since it's not exported from there)
export enum ValueKind {
    Invalid = 0,
    Boolean = 1,
    String = 2,
    Int32 = 3,
    Int64 = 4,
    Float = 5,
    Double = 6,
    Callable = 7,
    Uninitialized = 8,
    Dynamic = 9,
    Void = 10,
    Object = 11
}

/**
 * A wrapper around a callable to provide more information about where it came from
 */
export interface CallableContainer {
    callable: Callable;
    context: Context;
}
