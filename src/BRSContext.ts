import { BRSFile } from './BRSFile';
import { BRSError, BRSCallable } from './interfaces';
import { EventEmitter } from 'events';

/**
 * A class to keep track of all declarations within a given context (like global scope, component scope)
 */
export class BRSContext {
    constructor(
        public name: string,
        private matcher: (file: BRSFile) => boolean | void
    ) {

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
    public get errors() {
        let errorLists = [this._errors];
        for (let filePath in this.files) {
            let ctxFile = this.files[filePath];
            errorLists.push(ctxFile.file.errors);
        }
        let result = Array.prototype.concat.apply([], errorLists);
        return result;
    }

    private _errors = [] as BRSError[];

    /**
     * A list of context-global subs/functions found in all files in this context. 
     */
    public callables = [] as BRSCallable[];

    public emitter = new EventEmitter();

    public on(eventName: 'add-error', callback: (error: BRSError) => void);
    public on(eventName: 'remove-error', callback: (error: BRSError) => void);
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
        //remove the reference to this file
        delete this.files[file.pathAbsolute];
    }

    public validate() {
        //clear the context's errors list (we will populate them from this method)
        this._errors = [];
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
        {
            for (let callable of this.callables) {
                let name = callable.name.toLowerCase();

                //new callable, add to list and continue
                if (!callablesByName[name]) {
                    callablesByName[name] = callable;
                    continue;
                }

                let error = {
                    message: `Duplicate ${callable.type} declaration "${callable.name}"`,
                    columnBeginIndex: callable.columnBeginIndex,
                    columnEndIndex: callable.columnEndIndex,
                    lineIndex: callable.lineIndex,
                    filePath: callable.file.pathAbsolute,
                    severity: 'error'
                } as BRSError;
                this._errors.push(error);
            }
        }

        //validate all expression calls
        {
            for (let key in this.files) {
                let contextFile = this.files[key];
                for (let expCall of contextFile.file.expressionCalls) {
                    let knownCallable = callablesByName[expCall.name]
                    if (!knownCallable) {
                        let error = {
                            message: `Cannot find name '${expCall.name}'`,
                            columnBeginIndex: expCall.columnBeginIndex,
                            columnEndIndex: expCall.columnEndIndex,
                            lineIndex: expCall.lineIndex,
                            filePath: contextFile.file.pathAbsolute,
                            severity: 'error'
                        } as BRSError;
                        this._errors.push(error);
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