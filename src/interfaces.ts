import { XmlFile } from './files/XmlFile';
import { Position, Range } from 'vscode-languageserver';
import { BrsFile } from './files/BrsFile';
import { Context } from './Context';
import { BrsType } from './types/BrsType';

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
    type: 'function' | 'sub';
    /**
     * A short description of the callable. Should be a short sentence.
     */
    shortDescription?: string;
    /**
     * A more lengthy explanation of the callable. This is parsed as markdown
     */
    documentation?: string;
    returnType: BrsType;
    params: CallableParam[];
    nameRange?: Range;
    bodyRange?: Range;
    isDepricated?: boolean;
}

export interface ExpressionCall {
    file: File;
    name: string;
    args: CallableArg[];
    lineIndex: number;
    columnIndexBegin: number;
    columnIndexEnd: number;
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

export interface VariableDeclaration {
    name: string;
    type: BrsType;
    /**
     * Since only one variable can be declared at a time, 
     * we only need to know the line index
     */
    lineIndex: number;
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

export enum Lexeme {
    LeftParen = 0,
    RightParen = 1,
    LeftSquare = 2,
    RightSquare = 3,
    LeftBrace = 4,
    RightBrace = 5,
    Caret = 6,
    Minus = 7,
    Plus = 8,
    Star = 9,
    Slash = 10,
    Mod = 11,
    Backslash = 12,
    LeftShift = 13,
    RightShift = 14,
    Less = 15,
    LessEqual = 16,
    Greater = 17,
    GreaterEqual = 18,
    Equal = 19,
    LessGreater = 20,
    Identifier = 21,
    String = 22,
    Integer = 23,
    Float = 24,
    Double = 25,
    LongInteger = 26,
    Dot = 27,
    Comma = 28,
    Colon = 29,
    Semicolon = 30,
    HashIf = 31,
    HashElseIf = 32,
    HashElse = 33,
    HashEndIf = 34,
    HashConst = 35,
    HashError = 36,
    HashErrorMessage = 37,
    And = 38,
    Box = 39,
    CreateObject = 40,
    Dim = 41,
    Else = 42,
    ElseIf = 43,
    End = 44,
    EndFunction = 45,
    EndFor = 46,
    EndIf = 47,
    EndSub = 48,
    EndWhile = 49,
    Eval = 50,
    Exit = 51,
    ExitFor = 52,
    ExitWhile = 53,
    False = 54,
    For = 55,
    ForEach = 56,
    Function = 57,
    GetGlobalAA = 58,
    GetLastRunCompileError = 59,
    GetLastRunRunTimeError = 60,
    Goto = 61,
    If = 62,
    Invalid = 63,
    Let = 64,
    LineNum = 65,
    Next = 66,
    Not = 67,
    ObjFun = 68,
    Or = 69,
    Pos = 70,
    Print = 71,
    Rem = 72,
    Return = 73,
    Run = 74,
    Step = 75,
    Stop = 76,
    Sub = 77,
    Tab = 78,
    Then = 79,
    To = 80,
    True = 81,
    Type = 82,
    While = 83,
    Newline = 84,
    Eof = 85
}
