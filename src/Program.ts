import { Diagnostic, Callable, File } from './interfaces';
import { BrsFile } from './files/BrsFile';
import { Context } from './Context';
import * as path from 'path';
import util from './util';
import { BRSConfig } from './ProgramBuilder';
import { XmlFile } from './files/XmlFile';
import { textChangeRangeIsUnchanged } from 'typescript';
import { Position } from 'vscode-languageserver';

export class Program {
    constructor(
        /**
         * The root directory for this program
         */
        public config: BRSConfig
    ) {
        this.config = util.normalizeConfig(config);

        //normalize the root dir
        this.rootDir = util.getRootDir(config);

        //create the "global" context
        this.createContext('global', (file) => {
            //global context includes every file under the `source` folder
            return file.pkgPath.indexOf(`source${path.sep}`) === 0;
        });
    }

    private rootDir: string;

    /**
     * Get the list of errors for the entire program. It's calculated on the fly, so
     * call this sparingly.
     */
    public get errors() {
        let errorLists = [this._errors] as Diagnostic[][];
        for (let contextName in this.contexts) {
            let context = this.contexts[contextName];
            errorLists.push(context.diagnostics);
        }
        let result = Array.prototype.concat.apply([], errorLists) as Diagnostic[];
        return result;
    }

    /**
     * List of errors found on this project
     */
    private _errors = [] as Diagnostic[];

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
     * Create a new context. 
     * @param name 
     * @param matcher called on every file operation to deteremine if that file should be included in the context.
     */
    private createContext(name, matcher: (file: File) => boolean | void) {
        let context = new Context(name, matcher);
        //walk over every file to allow the context to include them
        for (let filePath in this.files) {
            let file = this.files[filePath];
            if (context.shouldIncludeFile(file)) {
                context.addFile(this.files[filePath]);
            }
        }
        this.contexts[name] = context;
        return context;
    }

    /**
     * Add and parse all of the provided files
     * @param filePaths 
     */
    public async loadOrReloadFiles(filePaths: string[]) {
        await Promise.all(
            filePaths.map(async (filePath) => {
                await this.loadOrReloadFile(filePath);
            })
        );
    }

    /**
     * Load a file into the program, or replace it of it's already loaded
     * @param filePathAbsolute 
     * @param fileContents 
     */
    public async loadOrReloadFile(filePathAbsolute: string, fileContents?: string) {
        filePathAbsolute = util.normalizeFilePath(filePathAbsolute);
        //if the file is already loaded, remove it first
        if (this.files[filePathAbsolute]) {
            return await this.reloadFile(filePathAbsolute, fileContents);
        } else {
            return await this.loadFile(filePathAbsolute, fileContents);
        }
    }

    private async loadFile(pathAbsolute: string, fileContents?: string) {
        pathAbsolute = util.normalizeFilePath(pathAbsolute);
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
            this.createContext(xmlFile.pkgPath, xmlFile.doesReferenceFile.bind(xmlFile));
            file = xmlFile;
        } else {
            let genericFile = {
                pathAbsolute: pathAbsolute,
                pkgPath: pkgPath,
                wasProcessed: true,
                diagnostics: []
            } as File;
            file = <any>genericFile;
        }
        this.files[pathAbsolute] = file;

        //allow all contexts to add this file if they wish
        this.notifyContexts(file);
        return file;
    }

    private notifyContexts(file: BrsFile | XmlFile) {
        //notify all contexts of this new file
        for (let contextName in this.contexts) {
            let context = this.contexts[contextName];
            if (context.shouldIncludeFile(file) && !context.hasFile(file)) {
                context.addFile(file);
            }
        }
    }

    private async reloadFile(filePath: string, fileContents?: string) {

        filePath = util.normalizeFilePath(filePath);
        let file = this.files[filePath];
        //remove the file from all contexts
        for (let contextName in this.contexts) {
            let context = this.contexts[contextName];
            if (context.hasFile(file)) {
                context.removeFile(file);
            }
        }

        file.reset();
        await file.parse(fileContents);

        //add the file back to interested contexts
        this.notifyContexts(file);

        //if this file is a context (i.e. xml file), clear that context and reload all referenced files
        let context = this.contexts[file.pkgPath];
        if (context) {
            context.clear();
            for (let key in this.files) {
                let file = this.files[key];
                if (context.shouldIncludeFile(file)) {
                    context.addFile(file);
                }
            }
        }
        return file;
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
        if (!file) {
            throw new Error(`File does not exist in project: ${filePath}`);
        }
        //notify every context of this file removal
        for (let contextName in this.contexts) {
            let context = this.contexts[contextName];
            context.removeFile(file)
        }

        //if there is a context named the same as this file's path, remove it
        let context = this.contexts[file.pkgPath];
        if (context) {
            context.clear();
            delete this.contexts[file.pkgPath];
        }
        //remove the file from the program
        delete this.files[filePath];
    }

    /**
     * Traverse the entire project, and validate all rules
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

        return file.getCompletions(position, context);
    }
}