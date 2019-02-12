import { BrsFile } from './files/BrsFile';
import { XmlFile } from './files/XmlFile';
import { Diagnostic, Callable, File } from './interfaces';
import { EventEmitter } from 'events';
import util from './util';
import { diagnosticMessages } from './DiagnosticMessages';
import { CompletionItem, CompletionItemKind, MarkupContent, Range } from 'vscode-languageserver';
import { Program } from './Program';

/**
 * A class to keep track of all declarations within a given context (like global scope, component scope)
 */
export class Context {
    constructor(
        public name: string,
        private matcher: (file: File) => boolean | void
    ) {
    }

    /**
     * Indicates whether this context needs to be validated. 
     * Will be true when first constructed, or anytime one of its watched files is added, changed, or removed
     */
    public isValidated = true;

    protected program: Program;

    protected programHandles = [] as (() => void)[];

    /**
     * Attach the context to a program. This allows the context to monitor file adds, changes, and removals, and respond accordingly
     * @param program 
     */
    public attachProgram(program: Program) {
        this.program = program;
        this.programHandles = [
            program.on('file-added', (file) => {
                if (this.matcher(file)) {
                    this.addOrReplaceFile(file);
                }
            }),

            program.on('file-removed', (file) => {
                if (this.hasFile(file)) {
                    this.removeFile(file);
                }
            })
        ];

        //add any current matches
        for (let filePath in program.files) {
            let file = program.files[filePath];
            if (this.matcher(file)) {
                this.addOrReplaceFile(file);
            }
        }
    }

    /**
     * Clean up all event handles
     */
    public dispose() {
        for (let disconnect of this.programHandles) {
            disconnect();
        }
        this.detachParent();
    }

    private parentContextHandles = [] as (() => void)[];

    public attachParentContext(parent: Context) {
        this.parentContext = parent;
        this.parentContextHandles = [
            //whenever the parent is marked dirty, mark ourself as dirty
            parent.on('invalidated', () => {
                this.isValidated = false;
            })
        ];

        //immediately invalidate self if parent is not validated
        if (!this.parentContext.isValidated) {
            this.isValidated = false;
        }
    }

    public detachParent() {
        for (let disconnect of this.parentContextHandles) {
            disconnect();
        }
        this.parentContext = this.program.platformContext;
    }

    /**
     * A parent context that this context inherits all things from.
     */
    public parentContext: Context;

    /**
     * Determine if this file should 
     * @param filePath 
     */
    public shouldIncludeFile(file: File) {
        return this.matcher(file) === true ? true : false;
    }

    public files = {} as { [filePath: string]: ContextFile };

    /**
     * Get the list of errors for this context. It's calculated on the fly, so
     * call this sparingly.
     */
    public getDiagnostics(): Diagnostic[] {
        let diagnosticLists = [this._diagnostics] as Diagnostic[][];
        //add diagnostics from every referenced file
        for (let filePath in this.files) {
            let ctxFile = this.files[filePath];
            diagnosticLists.push(ctxFile.file.diagnostics);
        }
        let result = Array.prototype.concat.apply([], diagnosticLists);
        return result;
    }

    /**
     * The list of diagnostics found specifically for this context. Individual file diagnostics are stored on the files themselves.
     */
    protected _diagnostics = [] as Diagnostic[];

    /**
     * Get the list of callables available in this context (either declared in this context or in a parent context) 
     */
    public getCallables() {
        let result = [] as Callable[];

        //get callables from own files
        for (let filePath in this.files) {
            let file = this.files[filePath];
            for (let callable of file.file.callables) {
                result.push(callable);
            }
        }

        //get callables from parent context
        if (this.parentContext) {
            let callables = this.parentContext.getCallables();
            for (let callable of callables) {
                result.push(callable);
            }
        }

        return result;
    }

    public emitter = new EventEmitter();

    public on(eventName: 'invalidated', callback: () => void);
    public on(eventName: string, callback: (data: any) => void) {
        this.emitter.on(eventName, callback);
        return () => {
            this.emitter.removeListener(eventName, callback);
        }
    }

    protected emit(name: 'invalidated');
    protected emit(name: string, data?: any) {
        this.emitter.emit(name, data);
    }

    /**
     * Add a file to the program.
     * @param filePath 
     * @param fileContents 
     */
    public addOrReplaceFile(file: BrsFile | XmlFile) {
        this.isValidated = false;

        //if the file is already loaded, remove it first
        if (this.files[file.pathAbsolute]) {
            this.removeFile(file);
        }

        let ctxFile = new ContextFile(file);

        //keep a reference to this file
        this.files[file.pathAbsolute] = ctxFile;
    }

    /**
     * Remove the file from this context. 
     * If the file doesn't exist, the method exits immediately, but does not throw an error.
     * @param file
     * @param emitRemovedEvent - if false, the 'remove-file' event will not be emitted
     */
    public removeFile(file: File) {
        this.isValidated = false;

        let ctxFile = this.files[file.pathAbsolute];
        if (!ctxFile) {
            return;
        }

        //remove the reference to this file
        delete this.files[file.pathAbsolute];
        this.emit('invalidated');
    }

    public validate() {
        //if this context is already validated, no need to revalidate
        if (this.isValidated === true) {
            return;
        }
        //validate our parent before we validate ourself
        if (this.parentContext && this.parentContext.isValidated === false) {
            this.parentContext.validate();
        }
        //clear the context's errors list (we will populate them from this method)
        this._diagnostics = [];
        let callables = this.getCallables();
        //sort the callables by filepath and then method name
        callables = callables.sort((a, b) => {
            return (
                //sort by path
                a.file.pathAbsolute.localeCompare(b.file.pathAbsolute) ||
                //then sort by method name
                a.name.localeCompare(b.name)
            );
        })

        //find duplicate callables
        let callablesByName = {} as { [name: string]: Callable };
        let markedFirstCallableAsDupe = {} as { [name: string]: boolean };
        {
            for (let callable of callables) {
                //skip global callables, because they can be overridden
                //TODO fix this
                // if (callable.file === platformFile) {
                //     continue;
                // }
                let name = callable.name.toLowerCase();

                //new callable, add to list and continue
                if (callablesByName[name] === undefined) {
                    callablesByName[name] = callable;
                    continue;
                } else {
                    //we have encountered a duplicate callable declaration

                    let dupeCallables = [callable];
                    //mark the first callable with this name as a dupe also, if we haven't done so already
                    if (markedFirstCallableAsDupe[name] !== true) {
                        dupeCallables = [callablesByName[name], ...dupeCallables];
                        markedFirstCallableAsDupe[name] = true;
                    }
                    for (let dupeCallable of dupeCallables) {
                        this._diagnostics.push({
                            message: diagnosticMessages.Duplicate_function_implementation_1003.message,
                            code: diagnosticMessages.Duplicate_function_implementation_1003.code,
                            location: Range.create(
                                dupeCallable.nameRange.start.line,
                                dupeCallable.nameRange.start.character,
                                dupeCallable.nameRange.start.line,
                                dupeCallable.nameRange.end.character
                            ),
                            file: callable.file,
                            severity: 'error'
                        });
                    }
                }
            }
        }

        //TODO - don't do this anymore???
        // //add the global callables to the callables lookup
        // for (let globalCallable of globalCallables) {
        //     let name = globalCallable.name.toLowerCase();

        //     let callable = callablesByName[name];
        //     //don't emit errors for overloaded global functions
        //     if (callable && !globalCallables.indexOf(callable)) {
        //         //emit error that this callable shadows a global function
        //         this._diagnostics.push({
        //             message: diagnosticMessages.Duplicate_function_implementation_1003.message,
        //             code: diagnosticMessages.Duplicate_function_implementation_1003.code,
        //             location: Range.create(
        //                 callable.nameRange.start.line,
        //                 callable.nameRange.start.character,
        //                 callable.nameRange.start.line,
        //                 callable.nameRange.end.character
        //             ),
        //             file: callable.file,
        //             severity: 'error'
        //         });
        //     } else {
        //         //add global callable to available list
        //         callablesByName[name] = globalCallable;
        //     }
        // }

        //do many per-file checks
        for (let key in this.files) {
            let contextFile = this.files[key];

            //validate all expression calls
            for (let expCall of contextFile.file.expressionCalls) {
                let knownCallable = callablesByName[expCall.name.toLowerCase()]

                //detect calls to unknown functions
                if (!knownCallable) {
                    this._diagnostics.push({
                        message: util.stringFormat(diagnosticMessages.Cannot_find_function_name_1001.message, expCall.name),
                        code: diagnosticMessages.Cannot_find_function_name_1001.code,
                        location: Range.create(
                            expCall.lineIndex,
                            expCall.columnIndexBegin,
                            expCall.lineIndex,
                            expCall.columnIndexEnd
                        ),
                        file: contextFile.file,
                        severity: 'error'
                    });
                    continue;
                }

                //detect incorrect number of parameters
                {
                    //get min/max parameter count for callable
                    let minParams = 0;
                    let maxParams = 0;
                    for (let param of knownCallable.params) {
                        maxParams++;
                        //optional parameters must come last, so we can assume that minParams won't increase once we hit
                        //the first isOptional
                        if (param.isOptional === false) {
                            minParams++;
                        }
                    }
                    let expCallArgCount = expCall.args.length;
                    if (expCall.args.length > maxParams || expCall.args.length < minParams) {
                        let minMaxParamsText = minParams === maxParams ? maxParams : minParams + '-' + maxParams;
                        this._diagnostics.push({
                            message: util.stringFormat(diagnosticMessages.Expected_a_arguments_but_got_b_1002.message, minMaxParamsText, expCallArgCount),
                            code: diagnosticMessages.Expected_a_arguments_but_got_b_1002.code,
                            location: Range.create(
                                expCall.lineIndex,
                                expCall.columnIndexBegin,
                                expCall.lineIndex,
                                Number.MAX_VALUE
                            ),
                            //TODO detect end of expression call
                            file: contextFile.file,
                            severity: 'error'
                        });
                    }
                }
            }

            //if this is an xml file, validate its script imports
            if (contextFile.file instanceof XmlFile) {
                let file = contextFile.file as XmlFile;
                //verify every script import
                for (let scriptImport of file.scriptImports) {
                    let referencedFile = this.getFileByRelativePath(scriptImport.pkgPath);
                    //if we can't find the file
                    if (!referencedFile) {
                        this._diagnostics.push({
                            message: diagnosticMessages.Referenced_file_does_not_exist_1004.message,
                            code: diagnosticMessages.Referenced_file_does_not_exist_1004.code,
                            location: Range.create(
                                scriptImport.lineIndex,
                                scriptImport.columnIndexBegin,
                                scriptImport.lineIndex,
                                scriptImport.columnIndexEnd
                            ),
                            file: file,
                            severity: 'error',
                        });
                    }
                }
            }
        }

        this.isValidated = false;
    }

    /**
     * Find the file with the specified relative path
     * @param relativePath 
     */
    private getFileByRelativePath(relativePath: string) {
        for (let key in this.files) {
            if (this.files[key].file.pkgPath === relativePath) {
                return this.files[key];
            }
        }
    }

    /**
     * Determine if the context already has this file in its files list
     * @param file 
     */
    public hasFile(file: BrsFile | XmlFile) {
        if (this.files[file.pathAbsolute]) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Get all callables as completionItems
     */
    public getCallablesAsCompletions() {
        let completions = [] as CompletionItem[];
        let callables = this.getCallables();
        for (let callable of callables) {
            completions.push({
                label: callable.name,
                kind: CompletionItemKind.Function,
                detail: callable.shortDescription,
                documentation: callable.documentation ? { kind: 'markdown', value: callable.documentation } : undefined
            });
        }
        return completions;
    }
}

class ContextFile {
    constructor(
        public file: BrsFile | XmlFile) {
    }
}