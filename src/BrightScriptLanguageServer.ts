import * as chokidar from 'chokidar';
import * as path from 'path';
import * as rokuDeploy from 'roku-deploy';

import { clear, log } from './util';
import { Watcher } from './Watcher';
import * as util from './util';

/**
 * A language server that can be used to parse BrightScript files and generate a zip folder
 */
export class BrightScriptLanguageServer {
    constructor(
    ) {
    }

    private options: BRSConfig;
    private isRunning = false;
    private watcher: Watcher

    public async run(options: BRSConfig) {
        if (this.isRunning) {
            throw new Error('Server is already running');
        }
        options = await this.setOptions(options);
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
        if (this.options.noPackage === false || this.options.deploy) {
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

    public async setOptions(options: BRSConfig) {
        this.options = await this.normalizeConfig(options);
        this.options = await this.loadDefaultOptionsIfMissing();

        // //if a watcher is already running, change the files it is waching
        if (this.watcher) {
            throw new Error('Not implemented');

            // //get the original source paths
            // let oldSrcGlobs = this.getSourcePaths(this.options);
            // //unwatch all original sources
            // this.fsWatcher.unwatch(oldSrcGlobs);

            // let newSrcGlobs = this.getSourcePaths(options);
            // //watch all of the new sources
            // this.fsWatcher.add(newSrcGlobs);
        }
        return this.options;
    }

    /**
     * Given a BRSConfig object, normalize all values and resolve all "extends" and "project" settings
     * @param options 
     * @param parentProjectPaths an array of parent project paths. Used to detect and prevent circular dependencies
     */
    public async normalizeConfig(originalConfig: BRSConfig, parentProjectPaths?: string[]) {
        let result = <BRSConfig>{};

        if (!originalConfig) {
            originalConfig = <any>{};
        }
        let cwd = process.cwd();

        //load 'project' and 'extends' files (should only be one or the other in any given call, but logic is identical)
        for (let projectPath of [originalConfig.project, originalConfig.extends]) {
            parentProjectPaths = parentProjectPaths ? parentProjectPaths : [];
            if (projectPath) {
                projectPath = path.resolve(projectPath);
                if (parentProjectPaths && parentProjectPaths.indexOf(projectPath) > -1) {
                    parentProjectPaths.push(projectPath);
                    parentProjectPaths.reverse();
                    throw new Error('Circular dependency detected: "' + parentProjectPaths.join('" => ') + '"')
                }
                //load the project file
                let projectFileContents = await util.getFileContents(projectPath);
                let projectConfig = JSON.parse(projectFileContents);

                //set working directory to the location of the project file
                process.chdir(path.dirname(projectPath));

                //normalize config (and resolve any inheritance)
                projectConfig = await this.normalizeConfig(projectConfig, [...parentProjectPaths, projectPath]);

                result = Object.assign(result, projectConfig);

                //restore working directory
                process.chdir(cwd);
            }
        }

        //extend the base with the provided config values
        result = Object.assign(result, originalConfig);

        //use default files glob if not specified (all roku-like files at root of current directory)
        if (!result.files) {
            let opts = rokuDeploy.getOptions();
            result.files = opts.files;
        }

        //default to out/package.zip
        if (!result.outFile) {
            result.outFile = path.join(process.cwd(), 'out', 'package.zip');
        }
        result.outFile = path.resolve(result.outFile);

        //default to current working directory
        if (!result.rootDir) {
            result.rootDir = process.cwd();
        }
        result.rootDir = path.resolve(result.rootDir);

        //default to NOT watching
        if (result.watch !== true) {
            result.watch = false;
        }

        //use the default roku username. This can't currently be changed, but maybe it will be eventually, so build it in now.
        if (!result.username) {
            result.username = 'rokudev';
        }

        //coerce deploy into a boolean, default to false
        if (result.deploy !== true) {
            result.deploy = false;
        }

        //should always create zip unless told NOT to do so
        if (result.noPackage !== true) {
            result.noPackage = false;
        }

        return result;
    }

    public async loadDefaultOptionsIfMissing() {
        //if we don't have options, look for the default brsconfig.json file
        if (!this.options) {
            if (await util.fileExists('brsconfig.json')) {
                this.options = await this.normalizeConfig({ project: 'brsconfig.json' });
            } else {
                //use defaults
                this.options = await this.normalizeConfig({});
            }
        }
        return this.options;
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
    noPackage?: boolean;
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