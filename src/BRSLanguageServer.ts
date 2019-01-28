import * as chokidar from 'chokidar';
import * as path from 'path';
import * as rokuDeploy from 'roku-deploy';
import * as debounce from 'debounce-promise';

import util from './util';
import { Watcher } from './Watcher';
import { BRSProgram } from './BRSProgram';


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

    /**
     * The list of errors found in the program.
     */
    private get errors() {
        return this.program.errors;
    }

    public async run(options: BRSConfig) {
        if (this.isRunning) {
            throw new Error('Server is already running');
        }
        this.options = await util.normalizeConfig(options);

        this.program = new BRSProgram(options);
        //parse every file in the entire project
        await this.loadAllFilesAST();

        if (this.options.watch) {
            util.log('Starting compilation in watch mode...');
            await this.runOnce();
            await this.enableWatchMode();
        } else {
            await this.runOnce();
        }
    }

    public async enableWatchMode() {
        this.watcher = new Watcher(this.options);
        //keep the process alive indefinitely by setting an interval that runs once every 12 days
        setInterval(() => { }, 1 << 30);

        //clear the console
        util.clearConsole();

        let fileObjects = rokuDeploy.normalizeFilesOption(this.options.files ? this.options.files : []);

        //add each set of files to the file watcher
        let fileObjectPromises = fileObjects.map(async (fileObject) => {
            await this.watcher.watch(fileObject.src);
        });

        //wait for all watchers to be ready
        await Promise.all(fileObjectPromises);

        util.log('Watching for file changes...');

        let debouncedRunOnce = debounce(async () => {
            await this.runOnce();
            let errorCount = this.errors.length;
            util.log(`Found ${errorCount} errors. Watching for file changes.`);
        }, 50);
        //on any file watcher event
        this.watcher.on('all', (event: string, path: string) => {
            console.log(event, path);
            if (event === 'add' || event === 'change') {
                this.program.loadOrReloadFile(path);
            } else if (event === 'unlink') {
                this.program.removeFile(path);
            }
            //wait for change events to settle, and then execute `run`
            debouncedRunOnce();
        });
    }

    /**
     * A method that is used to cancel a previous run task.
     * Does nothing if previous run has completed or was already canceled
     */
    private cancelLastRun = () => { return Promise.resolve(0); };

    /**
     * Run the entire process exactly one time.
     */
    private runOnce() {
        let cancellationToken = { isCanceled: false };
        let isCompleted = false;
        //wait for the previous run to complete
        let runPromise = this.cancelLastRun().then(() => {
            //start the new run
            return this._runOnce(cancellationToken);
        }).then((result) => {
            this.logErrors();
            //track if the run completed
            isCompleted = true;
            return result;
        }, (err) => {
            this.logErrors();
            //track if the run completed
            isCompleted = true;
            return Promise.reject(err);
        });

        //a function used to cancel this run
        this.cancelLastRun = () => {
            cancellationToken.isCanceled = true;
            return runPromise;
        };
        return runPromise;
    }

    private logErrors() {
        let errors = this.errors;
        for (let error of this.errors) {
            console.log(error.message);
        }
    }

    /**
     * Run the process once, allowing cancelability.
     * NOTE: This should only be called by `runOnce`.
     * @param cancellationToken
     */
    private async _runOnce(cancellationToken: { isCanceled: any }) {
        //maybe cancel?
        if (cancellationToken.isCanceled === true) { return -1; }

        //validate program
        let errorCount = await this.validateProject();

        //maybe cancel?
        if (cancellationToken.isCanceled === true) { return -1; }

        if (errorCount > 0) {
            return errorCount;
        }

        //create the deployment package
        await this.createPackageIfEnabled();

        //maybe cancel?
        if (cancellationToken.isCanceled === true) { return -1; }

        //deploy the package
        await this.deployPackageIfEnabled();

        return 0;
    }

    private async createPackageIfEnabled() {
        //create the zip file if configured to do so
        if (this.options.skipPackage === false || this.options.deploy) {
            util.log(`Creating package at ${this.options.outFile}`);
            await rokuDeploy.createPackage({
                ...this.options,
                outDir: path.dirname(this.options.outFile),
                outFile: path.basename(this.options.outFile)
            });
        }
    }

    private async deployPackageIfEnabled() {
        //deploy the project if configured to do so
        if (this.options.deploy) {
            util.log(`Deploying package to ${this.options.host}}`);
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
            if (['.bs', '.brs'].indexOf(fileExtension) > -1) {
                this.program.loadOrReloadFile(file.src);
            }
        }));
        return errorCount;
    }

    /**
     * Scan every file and resolve all variable references.
     * If no errors were encountered, return true. Otherwise return false.
     */
    private async validateProject() {
        util.log('Validating project');
        let errorCount = 0;
        return errorCount;
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