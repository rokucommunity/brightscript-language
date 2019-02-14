import { Diagnostic, Callable, File } from './interfaces';
import { BrsFile } from './files/BrsFile';
import { Context } from './Context';
import * as path from 'path';
import util from './util';
import { BRSConfig } from './ProgramBuilder';
import { XmlFile } from './files/XmlFile';
import { textChangeRangeIsUnchanged } from 'typescript';
import { Position } from 'vscode-languageserver';
import { XmlContext } from './XmlContext';
import { platformCallables, platformFile } from './platformCallables';
import { EventEmitter } from 'events';

export class Program {
    constructor(
        /**
         * The root directory for this program
         */
        public config: BRSConfig
    ) {
        this.config = util.normalizeConfig(config);

        //normalize the root dir path
        this.rootDir = util.getRootDir(config);

        //create the 'platform' context
        this.platformContext = new Context('platform', (file) => false);
        //add all platform callables
        this.platformContext.addOrReplaceFile(platformFile);
        this.platformFile = platformFile;
        this.platformContext.attachProgram(this);
        //for now, disable validation of this context because the platform files have some duplicate method declarations
        this.platformContext.validate = () => [];
        this.platformContext.isValidated = true;

        //create the "global" context
        var globalContext = new Context('global', (file) => {
            //global context includes every file under the `source` folder
            return file.pkgPath.indexOf(`source${path.sep}`) === 0;
        });
        globalContext.attachProgram(this);
        //the global context inherits from platform context
        globalContext.attachParentContext(this.platformContext);
        this.contexts[globalContext.name] = globalContext;
    }

    /**
     * A context that contains all platform-provided functions.
     * All contexts should directly or indirectly inherit from this context
     */
    public platformContext: Context;
    /**
     * The file that contains all of the platform files
     */
    public platformFile: BrsFile;

    private rootDir: string;

    /**
     * Get the list of errors for the entire program. It's calculated on the fly
     * by walking through every file, so call this sparingly.
     */
    public getDiagnostics() {
        let errorLists = [] as Diagnostic[][];
        for (let contextName in this.contexts) {
            let context = this.contexts[contextName];
            errorLists.push(context.getDiagnostics());
        }
        let result = Array.prototype.concat.apply([], errorLists) as Diagnostic[];

        //if we have a list of error codes to ignore, throw them out
        if (this.config.ignoreErrorCodes.length > 0) {
            result = result.filter(x => this.config.ignoreErrorCodes.indexOf(x.code) === -1);
        }
        return result;
    }

    /**
     * A map of every file loaded into this program
     */
    public files = {} as { [filePath: string]: BrsFile | XmlFile };

    public contexts = {} as { [name: string]: Context };

    /**
     * Determine if the specified file is loaded in this program right now.
     * @param filePath 
     */
    public hasFile(filePath: string) {
        filePath = util.normalizeFilePath(filePath);
        return this.files[filePath] !== undefined;
    }

    /**
     * Add and parse all of the provided files. 
     * Files that are already loaded will be replaced by the latest
     * contents from the file system.
     * @param filePaths 
     */
    public async addOrReplaceFiles(filePaths: string[]) {
        await Promise.all(
            filePaths.map(async (filePath) => {
                await this.addOrReplaceFile(filePath);
            })
        );
    }

    /**
     * Load a file into the program. If that file already exists, it is replaced.
     * If file contents are provided, those are used, Otherwise, the file is loaded from the file system
     * @param pathAbsolute 
     * @param fileContents 
     */
    public async addOrReplaceFile(pathAbsolute: string, fileContents?: string) {
        pathAbsolute = util.normalizeFilePath(pathAbsolute);

        //if the file is already loaded, remove it
        if (this.hasFile(pathAbsolute)) {
            this.removeFile(pathAbsolute);
        }
        let pkgPath = pathAbsolute.replace(this.rootDir + path.sep, '');
        let fileExtension = path.extname(pathAbsolute).toLowerCase();
        let file: BrsFile | XmlFile;

        //get the extension of the file
        if (fileExtension === '.brs' || fileExtension === '.bs') {
            let brsFile = new BrsFile(pathAbsolute, pkgPath);
            await brsFile.parse(fileContents);
            file = brsFile;
        } else if (fileExtension === '.xml') {
            let xmlFile = new XmlFile(pathAbsolute, pkgPath, this);
            await xmlFile.parse(fileContents);
            file = xmlFile;

            //create a new context for this xml file
            var context = new XmlContext(xmlFile);
            //attach this program to the new context
            context.attachProgram(this);

            //if the context doesn't have a parent context, give it the platform context
            if (!context.parentContext) {
                context.parentContext = this.platformContext;
            }

            this.contexts[context.name] = context;
        } else {
            //TODO do we actually need to implement this? Figure out how to handle img paths
            let genericFile = <any>{
                pathAbsolute: pathAbsolute,
                pkgPath: pkgPath,
                wasProcessed: true
            } as File;
            file = <any>genericFile;
        }
        this.files[pathAbsolute] = file;

        //notify all listeners about this file change
        this.emit('file-added', file);

        return file;
    }

    private emitter = new EventEmitter();

    public on(name: 'file-added', callback: (file: BrsFile | XmlFile) => void);
    public on(name: 'file-removed', callback: (file: BrsFile | XmlFile) => void);
    public on(name: string, callback: (data: any) => void) {
        this.emitter.on(name, callback);
        return () => {
            this.emitter.removeListener(name, callback);
        }
    }

    protected emit(name: 'file-added', file: BrsFile | XmlFile);
    protected emit(name: 'file-removed', file: BrsFile | XmlFile);
    protected emit(name: string, data?: any) {
        this.emitter.emit(name, data);
    }

    /**
     * Get a lookup of files by their component name
     */
    private getComponentFileLookup() {
        var lookup = {} as { [componentName: string]: XmlFile };
        for (let key in this.files) {
            let file = this.files[key];
            //if this is an xml file, and we were able to compute a component name
            if (file instanceof XmlFile && file.componentName) {
                lookup[file.componentName] = file;
            }
        }
        return lookup;
    }

    private connectComponents() {
        let componentLookup = this.getComponentFileLookup();

        //build a lookup of files by their compoonent names
        //walk through every component in the project
        for (let pathAbsolute in this.files) {
            let file = this.files[pathAbsolute];

            if (file instanceof XmlFile) {
                let parentComponent = componentLookup[file.parentComponentName];

                //if we found the parent, and the parent is DIFFERENT than the previous parent, 
                if (parentComponent && file.parent !== parentComponent) {
                    //attach the parent to its child
                    file.attachParent(parentComponent);
                } else {
                    //no parent component could be found...disconnect any previous parent component
                    file.detachParent();
                }
            }
        }
    }

    /**
     * Get a file with the specified pkg path. 
     * If not found, return undefined
     */
    public getFileByPkgPath(pkgPath: string) {
        for (let filePath in this.files) {
            let file = this.files[filePath];
            if (file.pkgPath === pkgPath) {
                return file;
            }
        }
    }

    /**
     * Remove a set of files from the program
     * @param filePaths 
     */
    public removeFiles(filePaths: string[]) {
        for (let filePath of filePaths) {
            this.removeFile(filePath);
        }
    }

    /**
     * Remove a file from the program
     * @param filePath 
     */
    public removeFile(filePath: string) {
        filePath = path.normalize(filePath);
        let file = this.files[filePath];

        //notify every context of this file removal
        for (let contextName in this.contexts) {
            let context = this.contexts[contextName];
            context.removeFile(file)
        }

        //if there is a context named the same as this file's path, remove it (i.e. xml contexts)
        let context = this.contexts[file.pkgPath];
        if (context) {
            context.dispose();
            delete this.contexts[file.pkgPath];
        }
        //remove the file from the program
        delete this.files[filePath];
        this.emit('file-removed', file);
    }

    /**
     * Traverse the entire project, and validate all contexts
     */
    public async validate() {
        for (let contextName in this.contexts) {
            let context = this.contexts[contextName];
            context.validate();
        }
    }

    /**
     * Get the file at the given path
     * @param pathAbsolute 
     */
    private getFile(pathAbsolute: string) {
        pathAbsolute = path.resolve(pathAbsolute);
        return this.files[pathAbsolute];
    }

    private getContextsForFile(file: XmlFile | BrsFile) {
        let result = [] as Context[];
        for (let key in this.contexts) {
            let context = this.contexts[key];

            if (context.hasFile(file)) {
                result.push(context);
            }
        }
        return result;
    }

    /**
     * Find all available completion items at the given position
     * @param pathAbsolute 
     * @param lineIndex 
     * @param columnIndex 
     */
    public getCompletions(pathAbsolute: string, position: Position) {
        let file = this.getFile(pathAbsolute);
        if (!file) {
            return [];
        }

        //find the contexts for this file (hopefully there's only one)
        let contexts = this.getContextsForFile(file);
        if (contexts.length > 1) {
            //TODO - make the user choose which context to use. 
        }
        let context = contexts[0];

        let fileCompletions = file.getCompletions(position, context);
        let contextCompletions = context.getCallablesAsCompletions();
        return [...fileCompletions, ...contextCompletions];
    }
}