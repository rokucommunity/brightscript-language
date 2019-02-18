import { FileReference, Diagnostic, Callable, ExpressionCall, File } from '../interfaces';
import util from '../util';
import { Program } from '../Program';
import * as path from 'path';
import { CompletionItem, CompletionItemKind, TextEdit, Range, Position, Hover } from 'vscode-languageserver';
import { diagnosticMessages } from '../DiagnosticMessages';
import { EventEmitter } from 'events';
import { FunctionScope } from '../FunctionScope';

export class XmlFile {
    constructor(
        public pathAbsolute: string,
        /**
         * The absolute path to the file, relative to the pkg
         */
        public pkgPath: string,
        public program: Program
    ) {
        this.extension = path.extname(pathAbsolute).toLowerCase();
    }

    /**
     * The extension for this file
     */
    public extension: string;

    public ownScriptImports = [] as FileReference[];

    public getDiagnostics() {
        return [...this.parseDiagnistics];
    }

    public parseDiagnistics = [] as Diagnostic[];

    //TODO implement the xml CDATA parsing, which would populate this list
    public callables = [] as Callable[];

    //TODO implement the xml CDATA parsing, which would populate this list
    public functionCalls = [] as ExpressionCall[];

    /**
     * The name of the component that this component extends
     */
    public parentComponentName: string;

    /**
     * The name of the component declared in this xml file
     */
    public componentName: string;

    /**
     * Indicates if this file was processed by the program yet. 
     */
    public wasProcessed = false;

    public async parse(fileContents?: string) {
        if (this.wasProcessed) {
            throw new Error(`File was already processed. Create a new file instead. ${this.pathAbsolute}`);
        }

        //load from disk if file contents are not provided
        if (typeof fileContents !== 'string') {
            fileContents = await util.getFileContents(this.pathAbsolute);
        }

        //split the text into lines
        let lines = util.getLines(fileContents);

        //find script imports
        {
            let scriptImports = [] as FileReference[];
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                let line = lines[lineIndex];
                let scriptMatch = /(.*<\s*script.*uri\s*=\s*")(.*)".*\/>/ig.exec(line)
                if (scriptMatch) {
                    let junkBeforeUri = scriptMatch[1];
                    let filePath = scriptMatch[2];
                    let columnIndexBegin = junkBeforeUri.length;

                    scriptImports.push({
                        sourceFile: this,
                        text: filePath,
                        lineIndex: lineIndex,
                        columnIndexBegin: columnIndexBegin,
                        columnIndexEnd: columnIndexBegin + filePath.length,
                        pkgPath: util.getPkgPathFromTarget(this.pkgPath, filePath)
                    });
                }
            }

            //add all of these script imports
            this.ownScriptImports = scriptImports;
        }

        try {
            var parsedXml = await util.parseXml(fileContents);

            if (parsedXml && parsedXml.component) {
                if (parsedXml.component.$) {
                    this.componentName = parsedXml.component.$.name;
                    this.parentComponentName = parsedXml.component.$.extends;
                }
                let componentRange: Range;

                //find the range for the component element's opening tag
                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    let match = /(.*)(<component)/gi.exec(lines[lineIndex]);
                    if (match) {
                        componentRange = Range.create(
                            Position.create(lineIndex, match[1].length),
                            Position.create(lineIndex, match[0].length)
                        )
                        break;
                    }
                }
                //component name not defined
                if (!this.componentName) {
                    this.parseDiagnistics.push({
                        code: diagnosticMessages.Component_missing_name_attribute_1006.code,
                        message: diagnosticMessages.Component_missing_name_attribute_1006.message,
                        location: Range.create(
                            componentRange.start.line,
                            componentRange.start.character,
                            componentRange.start.line,
                            componentRange.end.character
                        ),
                        file: this,
                        severity: 'error'
                    });
                }
                //parent component name not defined
                if (!this.parentComponentName) {
                    this.parseDiagnistics.push({
                        code: diagnosticMessages.Component_missing_extends_attribute_1007.code,
                        message: diagnosticMessages.Component_missing_extends_attribute_1007.message,
                        location: Range.create(
                            componentRange.start.line,
                            componentRange.start.character,
                            componentRange.start.line,
                            componentRange.end.character
                        ),
                        file: this,
                        severity: 'error'
                    });
                }
            } else {
                //the component xml element was not found in the file
                this.parseDiagnistics.push({
                    code: diagnosticMessages.Xml_component_missing_component_declaration_1005.code,
                    message: diagnosticMessages.Xml_component_missing_component_declaration_1005.message,
                    location: Range.create(
                        0,
                        0,
                        0,
                        Number.MAX_VALUE
                    ),
                    file: this,
                    severity: 'error'
                });
            }
        } catch (e) {
            var match = /(.*)\r?\nLine:\s*(\d+)\r?\nColumn:\s*(\d+)\r?\nChar:\s*(\d*)/gi.exec(e.message);
            if (match) {

                let lineIndex = parseInt(match[2]);
                let columnIndex = parseInt(match[3]) - 1;
                //add basic xml parse diagnostic errors
                this.parseDiagnistics.push({
                    message: match[1],
                    code: diagnosticMessages.Xml_parse_error_1008.code,
                    location: Range.create(
                        lineIndex,
                        columnIndex,
                        lineIndex,
                        columnIndex
                    ),
                    file: this,
                    severity: 'error'
                });
            }
        }
        this.wasProcessed = true;
    }

    /**
     * Get the list of scripts imported by this component and all of its ancestors
     */
    public getAllScriptImports() {
        var imports = [...this.ownScriptImports] as FileReference[];
        var file: XmlFile = this;
        while (file.parent) {
            imports = [...imports, ...file.parent.getOwnScriptImports()];
            file = file.parent;
        }
        return imports;
    }

    /**
     * Get the list of scripts explicitly imported by this file. 
     * This method excludes any ancestor imports
     */
    public getOwnScriptImports() {
        return this.ownScriptImports;
    }

    /**
     * Determines if this xml file has a reference to the specified file (or if it's itself)
     * @param file 
     */
    public doesReferenceFile(file: File) {
        if (file === this) {
            return true;
        }
        for (let scriptImport of this.ownScriptImports) {
            //if the script imports the file
            if (scriptImport.pkgPath.toLowerCase() === file.pkgPath.toLowerCase()) {
                return true;
            }
        }

        //if this is an xml file...do we extend the component it defines?
        if (path.extname(file.pkgPath).toLowerCase() === '.xml') {

            //didn't find any script imports for this file
            return false;
        }
    }

    /**
     * Get all available completions for the specified position
     * @param lineIndex 
     * @param columnIndex 
     */
    public getCompletions(position: Position): CompletionItem[] {
        let result = [] as CompletionItem[];
        let scriptImport = this.ownScriptImports.find((x) => {
            return x.lineIndex === position.line &&
                //column between start and end
                position.character >= x.columnIndexBegin &&
                position.character <= x.columnIndexEnd
        });
        //the position is within a script import. Provide path completions
        if (scriptImport) {
            //get a list of all scripts currently being imported
            let currentImports = this.ownScriptImports.map(x => x.pkgPath);

            //restrict to only .brs files
            for (let key in this.program.files) {
                let file = this.program.files[key];
                if (
                    //is a brightscript file
                    (file.extension === '.bs' || file.extension === '.brs') &&
                    //not already referenced in this file
                    currentImports.indexOf(file.pkgPath) === -1
                ) {
                    //the text range to replace if the user selects this result
                    let range = {
                        start: {
                            character: scriptImport.columnIndexBegin,
                            line: scriptImport.lineIndex
                        },
                        end: {
                            character: scriptImport.columnIndexEnd,
                            line: scriptImport.lineIndex
                        }
                    } as Range;

                    //add the relative path
                    let relativePath = util.getRelativePath(this.pkgPath, file.pkgPath).replace(/\\/g, '/');
                    let pkgPath = 'pkg:/' + file.pkgPath.replace(/\\/g, '/');

                    result.push({
                        label: relativePath,
                        detail: file.pathAbsolute,
                        kind: CompletionItemKind.File,
                        textEdit: {
                            newText: relativePath,
                            range: range
                        }
                    });

                    //add the absolute path
                    result.push({
                        label: pkgPath,
                        detail: file.pathAbsolute,
                        kind: CompletionItemKind.File,
                        textEdit: {
                            newText: pkgPath,
                            range: range
                        }
                    });
                }
            }
        }
        return result;
    }

    public emitter = new EventEmitter();

    public on(name: 'attach-parent', callback: (data: XmlFile) => void);
    public on(name: 'detach-parent', callback: () => void);
    public on(name: string, callback: (data: any) => void) {
        this.emitter.on(name, callback);
        return () => {
            this.emitter.removeListener(name, callback);
        }
    }

    protected emit(name: 'attach-parent', data: XmlFile);
    protected emit(name: 'detach-parent');
    protected emit(name: string, data?: any) {
        this.emitter.emit(name, data);
    }

    public parent: XmlFile;

    /**
     * Certain conditions make it necessary for this file to be revalidated (like adding/changing/removing a parent).
     * This property will be false when the file needs to be revalidated.
     */
    private isValidated = false;

    /**
     * Components can extend another component.
     * This method attaches the parent component to this component, where 
     * this component can listen for script import changes on the parent. 
     * @param parent 
     */
    public attachParent(parent: XmlFile) {
        //detach any existing parent
        this.detachParent();
        this.parent = parent;
        this.emit('attach-parent', parent);

        this.isValidated = false;
    }

    public detachParent() {
        if (this.parent) {
            this.parent = undefined;
            this.emit('detach-parent');

            this.isValidated = false;
        }
    }

    public getHover(position: Position): Hover {
        //TODO implement
        let result = {} as Hover;
        return null;
    }

    public getFunctionScopeAtPosition(position: Position, functionScopes?: FunctionScope[]): FunctionScope {
        //TODO implement
        return null;
    }
}