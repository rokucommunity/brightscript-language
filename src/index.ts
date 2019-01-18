import * as chokidar from 'chokidar';
import * as path from 'path';
import * as rokuDeploy from 'roku-deploy';

/**
 * A language server that can be used to parse BrightScript files and generate a zip folder
 */
export class BrightScriptLanguageServer {
    constructor(
        options: BrightScriptLanguageServerOptions
    ) {
        this.setOptions(options);
    }

    private options: BrightScriptLanguageServerOptions;
    private isRunning = false;
    private fsWatcher: chokidar.FSWatcher;

    public setOptions(options) {
        //normalize some options
        options.rootDir = this.options.rootDir ? this.options.rootDir : './';

        this.options = options;
    }

    public run() {
        if (this.isRunning) {
            throw new Error('Server is already running');
        }

        //wire up watch mode
        if (this.options.watch) {
            let srcGlobs = this.getSourcePaths();
            //watch all files found in `files` array, execute every time one changes
            this.fsWatcher = chokidar.watch(srcGlobs, {
                cwd: this.options.rootDir
            });
        }

    }

    private process() {

    }

    /**
     * Get the full list of source paths/globs
     */
    private getSourcePaths() {
        let sources = <string[]>[];
        let files = rokuDeploy.normalizeFilesOption(this.options.files);
        for (let file of files) {
            sources.push.apply(sources, file.src);
        }
        return sources;
    }
}

export interface BrightScriptLanguageServerOptions {
    /**
     * The root directory of your roku project. Defaults to current directory.
     */
    rootDir?: string;
    /**
     * The list of file globs used to find all files for the project
     * If using the {src;dest;} format, you can specify a different destination directory
     * for the matched files in src.
     */
    files: (string | string[] | { src: string | string[]; dest?: string })[];
    /**
     * The path where the output zip file should be placed.
     */
    outFile: string;
    /**
     * If true, the server will keep running and will watch and recompile on every file change
     */
    watch: boolean;
}