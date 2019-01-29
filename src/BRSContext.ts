import { BRSFile } from './BRSFile';
import { BRSError as BRSDiagnostic, BRSCallable } from './interfaces';
import { EventEmitter } from 'events';
import { globalCallables, globalFile } from './GlobalCallables';

/**
 * A class to keep track of all declarations within a given context (like global scope, component scope)
 */
export class BRSContext {
    constructor(
        public name: string,
        private matcher: (file: BRSFile) => boolean | void
    ) {
        this.callables = [...this.callables, ...globalCallables];
    }

    /**
     * Determine if this file should 
     * @param filePath 
     */
    public shouldIncludeFile(file: BRSFile) {
        return this.matcher(file) === true ? true : false;
    }

    public files = {} as { [filePath: string]: ContextFile };

    /**
     * Get the list of errors for this context. It's calculated on the fly, so
     * call this sparingly.
     */
    public get diagnostics(): BRSDiagnostic[] {
        let diagnosticList = [this._diagnostics];
        for (let filePath in this.files) {
            let ctxFile = this.files[filePath];
            diagnosticList.push(ctxFile.file.diagnostics);
        }
        let result = Array.prototype.concat.apply([], diagnosticList);
        return result;
    }

    private _diagnostics = [] as BRSDiagnostic[];

    /**
     * A list of context-global subs/functions found in all files in this context. 
     */
    public callables = [] as BRSCallable[];

    public emitter = new EventEmitter();

    public on(eventName: 'add-error', callback: (error: BRSDiagnostic) => void);
    public on(eventName: 'remove-error', callback: (error: BRSDiagnostic) => void);
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
    public addFile(file: BRSFile) {
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
    public removeFile(file: BRSFile) {
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
        let callablesByName = {} as { [name: string]: BRSCallable };
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
                            type: 'error'
                        } as BRSDiagnostic;
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
                //emit warning that this callable shadows a global function
                this._diagnostics.push({
                    message: `Duplicate ${callable.type} implementation`,
                    columnIndexBegin: callable.columnIndexBegin,
                    columnIndexEnd: callable.columnIndexEnd,
                    lineIndex: callable.lineIndex,
                    filePath: callable.file.pathAbsolute,
                    file: callable.file,
                    type: 'warning'
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
                    if (!knownCallable) {
                        let error = {
                            message: `Cannot find name '${expCall.name}'`,
                            columnIndexBegin: expCall.columnIndexBegin,
                            columnIndexEnd: expCall.columnIndexEnd,
                            lineIndex: expCall.lineIndex,
                            filePath: contextFile.file.pathAbsolute,
                            type: 'error'
                        } as BRSDiagnostic;
                        this._diagnostics.push(error);
                    }
                }
            }
        }
    }
}

class ContextFile {
    constructor(
        public file: BRSFile) {
    }
}