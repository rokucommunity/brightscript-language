import { BRSError, BRSCallable } from './interfaces';
import { BRSFile } from './BRSFile';

export class BRSProgram {
    constructor() {

    }

    /**
     * List of errors found on this project
     */
    public errors = <BRSError[]>[];

    /**
     * List of errors found on this project
     */
    public warnings = <BRSError[]>[];

    public files = {} as { [filePath: string]: BRSFile };

    public globalCallables = {} as { [callableName: string]: BRSCallable };

    /**
     * Add and parse all of the provided files
     * @param filePaths 
     */
    public async addFiles(filePaths: string[]) {
        await Promise.all(
            filePaths.map(async (filePath) => {
                await this.addFile(filePath);
            })
        );
    }

    /**
     * Add a file to the program.
     * @param filePath 
     * @param fileContents 
     */
    public async addFile(filePath: string, fileContents?: string) {
        if (this.files[filePath]) {
            throw new Error(`File "${filePath}" is already loaded in the program. Perhaps you meant to call reloadFile`);
        }
        let brsFile = new BRSFile(filePath);
        await brsFile.parse(fileContents);
        this.files[filePath] = brsFile;
    }

    public removeFiles(filePaths: string[]) {
        //TODO
    }

    /**
     * Reloads the file. 
     * This is normally called from a watcher when a file's contents changed on disk or in memory
     * @param filePath 
     */
    public async reloadFile(filePath: string, fileContents?: string) {
        await this.removeFiles([filePath]);
        await this.addFile(filePath, fileContents);
    }

    /**
     * Traverse the entire project, and validate all rules
     */
    public async validate() {
        //get all file paths in alphabetic order so validation is consistent
        let filePaths = Object.keys(this.files).sort();

        //gather up all global methods
        for (let filePath of filePaths) {
            let file = this.files[filePath];
            //skip already-processed files
            if (file.wasProcessed === true) {
                continue;
            }

            let callables = file.getGlobalCallables();
            for (let callable of callables) {
                let preexistingCallable = this.globalCallables[callable.name];
                if (preexistingCallable) {
                    this.errors.push({
                        message: `${callable.type} ${callable.name} is already declared in "${preexistingCallable.file.filePath}" on line ${preexistingCallable.lineIndex + 1}`,
                        columnBeginIndex: callable.columnBeginIndex,
                        columnEndIndex: callable.columnEndIndex,
                        lineIndex: callable.lineIndex,
                        filePath: file.filePath
                    });
                } else {
                    this.globalCallables[callable.name] = callable;
                }
            }

        }
    }
}