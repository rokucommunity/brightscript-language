import { File } from './File';
import { Diagnostic, Callable } from './interfaces';
import { EventEmitter } from 'events';
import { globalCallables, globalFile } from './GlobalCallables';
import util from './util';
import { diagnosticMessages } from './DiagnosticMessages';

/**
 * A class to keep track of all declarations within a given context (like global scope, component scope)
 */
export class Context {
    constructor(
        public name: string,
        private matcher: (file: File) => boolean | void
    ) {
        this.callables = [...this.callables, ...globalCallables];
    }

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
    public get diagnostics(): Diagnostic[] {
        let diagnosticList = [this._diagnostics];
        for (let filePath in this.files) {
            let ctxFile = this.files[filePath];
            diagnosticList.push(ctxFile.file.diagnostics);
        }
        let result = Array.prototype.concat.apply([], diagnosticList);
        return result;
    }

    private _diagnostics = [] as Diagnostic[];

    /**
     * A list of context-global subs/functions found in all files in this context. 
     */
    public callables = [] as Callable[];

    public emitter = new EventEmitter();

    public on(eventName: 'add-error', callback: (error: Diagnostic) => void);
    public on(eventName: 'remove-error', callback: (error: Diagnostic) => void);
    public on(eventName: string, callback: (data: any) => void) {
        this.emitter.on(eventName, callback);
        return () => {
            this.emitter.removeListener(eventName, callback);
        }
    }

    /**
     * Add a file to the program.
     * @param filePath 
     * @param fileContents 
     */
    public addFile(file: File) {
        if (this.files[file.pathAbsolute]) {
            throw new Error(`File is already loaded in this context. Perhaps you meant to call reloadFile: ${file.pathAbsolute} `);
        }

        let ctxFile = new ContextFile(file);

        //add callables
        this.callables = [...this.callables, ...file.callables];

        //keep a reference to this file
        this.files[file.pathAbsolute] = ctxFile;
    }

    /**
     * Remove the file from this context. 
     * If the file doesn't exist, the method exits immediately, but does not throw an error.
     * @param file
     */
    public removeFile(file: File) {
        let ctxFile = this.files[file.pathAbsolute];
        if (!ctxFile) {
            return;
        }

        //remove all callables from this file from this
        for (let callable of ctxFile.file.callables) {
            let idx = this.callables.indexOf(callable);
            if (idx > -1) {
                this.callables.splice(idx, 1);
            }
        }

        //remove all errors for this file from this
        this._diagnostics = this._diagnostics.filter((error) => {
            return error.file !== file;
        });
        //remove the reference to this file
        delete this.files[file.pathAbsolute];
    }

    public validate() {
        //clear the context's errors list (we will populate them from this method)
        this._diagnostics = [];
        //sort the callables by filepath and then method name
        this.callables = this.callables.sort((a, b) => {
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
            for (let callable of this.callables) {
                //skip global callables, because they can be overridden
                if (callable.file === globalFile) {
                    continue;
                }
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
                        let error = {
                            message: `Duplicate ${dupeCallable.type} implementation`,
                            columnIndexBegin: dupeCallable.columnIndexBegin,
                            columnIndexEnd: dupeCallable.columnIndexEnd,
                            lineIndex: dupeCallable.lineIndex,
                            filePath: dupeCallable.file.pathAbsolute,
                            file: callable.file,
                            severity: 'error'
                        } as Diagnostic;
                        this._diagnostics.push(error);
                    }

                }
            }
        }

        //add the global callables to the callables lookup
        for (let globalCallable of globalCallables) {
            let name = globalCallable.name.toLowerCase();

            let callable = callablesByName[name];
            //don't emit errors for overloaded global functions
            if (callable && !globalCallables.indexOf(callable)) {
                //emit error that this callable shadows a global function
                this._diagnostics.push({
                    message: diagnosticMessages.Duplicate_function_implementation_1003,
                    columnIndexBegin: callable.columnIndexBegin,
                    columnIndexEnd: callable.columnIndexEnd,
                    lineIndex: callable.lineIndex,
                    file: callable.file,
                    severity: 'error'
                });
            } else {
                //add global callable to available list
                callablesByName[name] = globalCallable;
            }
        }

        //validate all expression calls
        {
            for (let key in this.files) {
                let contextFile = this.files[key];
                for (let expCall of contextFile.file.expressionCalls) {
                    let knownCallable = callablesByName[expCall.name.toLowerCase()]

                    //detect calls to unknown functions
                    if (!knownCallable) {
                        this._diagnostics.push({
                            message: util.stringFormat(diagnosticMessages.Cannot_find_function_name_1001, expCall.name),
                            columnIndexBegin: expCall.columnIndexBegin,
                            columnIndexEnd: expCall.columnIndexEnd,
                            lineIndex: expCall.lineIndex,
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
                                message: util.stringFormat(diagnosticMessages.Expected_a_arguments_but_got_b_1002, minMaxParamsText, expCallArgCount),
                                columnIndexBegin: expCall.columnIndexBegin,
                                //TODO detect end of expression call
                                columnIndexEnd: Number.MAX_VALUE,
                                lineIndex: expCall.lineIndex,
                                file: contextFile.file,
                                severity: 'error'
                            });
                        }
                    }
                }
            }
        }
    }
}

class ContextFile {
    constructor(
        public file: File) {
    }
}