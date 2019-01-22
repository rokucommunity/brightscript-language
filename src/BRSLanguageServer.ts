import * as chokidar from 'chokidar';
import * as path from 'path';
import * as rokuDeploy from 'roku-deploy';
import * as fsExtra from 'fs-extra';

import { clear, log } from './util';
import { Watcher } from './Watcher';
import * as util from './util';
import { BRSProgram } from '.';
import { fstat } from 'fs-extra';

/**
 * A runner class that handles 
 */
export class BRSLanguageServer {
    constructor(
    ) {
    }

    private options: BRSConfig;
    private isRunning = false;
    private watcher: Watcher;
    public program: BRSProgram;

    public async run(options: BRSConfig) {
        if (this.isRunning) {
            throw new Error('Server is already running');
        }
        this.options = await util.normalizeConfig(options);

        this.program = new BRSProgram(options);
        if (this.options.watch) {
            await this.runInWatchMode();
        } else {
            await this.runOnce();
        }
    }

    private async runOnce(cancellationToken?: { cancel: boolean }) {
        //parse every file in the entire project
        let errorCount = await this.loadAllFilesAST();

        if (errorCount > 0) {
            return errorCount;
        }

        //validate program
        errorCount = await this.validateProject();
        if (errorCount > 0) {
            return errorCount;
        }

        await this.createPackage();
        await this.deployPackage();

        return 0;
    }

    public async runInWatchMode() {
        throw new Error('Not implemented');
        this.watcher = new Watcher(this.options);
        //keep the process alive indefinitely by setting an interval that runs once every 12 days
        setInterval(() => { }, 1 << 30);
        clear();

        log('Starting compilation in watch mode...');
        let fileObjects = rokuDeploy.normalizeFilesOption(this.options.files ? this.options.files : []);

        let fileObjectPromises = fileObjects.map(async (fileObject) => {
            await this.watcher.watch(fileObject.src);
        });

        //wait for all watchers to be ready
        await Promise.all(fileObjectPromises);

        this.watcher.on('all', (event: string, path: string) => {
            this.fileChanged(path, <any>event);
        });

        let errorCount = await this._run();
        log(`Found ${errorCount} errors. Watching for file changes.`);
    }

    private async _run() {

    }

    private async createPackage() {
        //create the zip file if configured to do so
        if (this.options.skipPackage === false || this.options.deploy) {
            log(`Creating package at ${this.options.outFile}`);
            await rokuDeploy.createPackage({
                ...this.options,
                outDir: path.dirname(this.options.outFile),
                outFile: path.basename(this.options.outFile)
            });
        }
    }

    private async deployPackage() {
        //deploy the project if configured to do so
        if (this.options.deploy) {
            log(`Deploying package to ${this.options.host}}`);
            await rokuDeploy.publish({
                ...this.options,
                outDir: path.dirname(this.options.outFile),
                outFile: path.basename(this.options.outFile)
            });
        }
    }

    /**
     * Parse and load the AST for every file in the project
     */
    private async loadAllFilesAST() {
        let files = await rokuDeploy.getFilePaths(this.options.files, path.dirname(this.options.outFile), this.options.rootDir);
        let errorCount = 0;
        //parse every file
        await Promise.all(files.map(async (file) => {
            let fileExtension = path.extname(file.src).toLowerCase();

            //only process brightscript files
            if (['bs', 'brs'].indexOf(fileExtension) > -1) {
                // errorCount += await this.loadAST(file);
            }
        }));
        return errorCount;
    }

    /**
     * Scan every file and resolve all variable references. 
     * If no errors were encountered, return true. Otherwise return false.
     */
    private async validateProject() {
        log('Validating project');
        let errorCount = 0;
        return errorCount;
    }

    private pendingChanges = [];
    private fileChangedCallIdx = 0;


    private async fileChanged(filePath: string, mode: 'add' | 'change' | 'unlink') {
        this.pendingChanges.push({ file: filePath, mode: mode });

        //the parsing happens synchronously, so we should do that work immediately
        if (mode === 'add' || mode === 'change') {
            // this.loadAST(newFilePath);
        } else if (mode === 'unlink') {
            //delete the ADT and file data, then rerun 
        }
        this.fileChangedCallIdx++
        let callIdx = this.fileChangedCallIdx;
        let tryAbort = () => {
            if (callIdx !== this.fileChangedCallIdx) {
                throw new Error('Killing current compilation')
            }
        };

        setTimeout(() => {
            (async () => {
                tryAbort();
                clear();
                log('File change detected. Starting incremental compilation...');
                //now that the ADT and files are up-to-date, revalidate the project
                let errorCount = await this.validateProject();

                tryAbort();

                if (errorCount === 0) {
                    await this.createPackage();

                    //abort if changed
                    tryAbort();

                    await this.deployPackage();
                }
            })().catch((err) => { });
        }, 50);
    }
}

export interface BRSConfig {
    /**
     * A path to a project file. This is really only passed in from the command line, and should not be present in brsconfig.json files
     */
    project?: string;
    /**
     * Relative or absolute path to another brsconfig.json file that this file should import and then override
     */
    extends?: string;
    /**
     * Override the current working directory.
     */
    cwd?: string;
    /**
     * The root directory of your roku project. Defaults to current directory.
     */
    rootDir?: string;
    /**
     * The list of file globs used to find all files for the project
     * If using the {src;dest;} format, you can specify a different destination directory
     * for the matched files in src.
     */
    files?: (string | string[] | { src: string | string[]; dest?: string })[];
    /**
     * The path where the output zip file should be placed.
     * @default "./out/package.zip"
     */
    outFile?: string;
    /**
     * Prevents the zip file from being created. This has no effect if deploy is true.
     */
    skipPackage?: boolean;
    /**
     * If true, the server will keep running and will watch and recompile on every file change
     * @default false
     */
    watch?: boolean;

    /**
     * If true, after a success buld, the project will be deployed to the roku specified in host
     */
    deploy?: boolean;

    /**
     * The host of the Roku that this project will deploy to
     */
    host?: string;

    /**
     * The username to use when deploying to a Roku device
     */
    username?: string;
    /**
     * The password to use when deploying to a Roku device
     */
    password?: string;
}