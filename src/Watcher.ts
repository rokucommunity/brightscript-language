import * as chokidar from 'chokidar';
import { BRSConfig } from './ProgramBuilder';
import { watch } from 'fs';

/**
 * There are some bugs with chokidar, so this attempts to mitigate them
 */
export class Watcher {
    constructor(
        private options: BRSConfig
    ) {

    }

    private watchers = <chokidar.FSWatcher[]>[];

    /**
     * Watch the paths or globs
     * @param paths 
     */
    public async watch(paths: string | string[]) {
        let watcher = chokidar.watch(paths, {
            cwd: this.options.rootDir,
            ignoreInitial: false,
            awaitWriteFinish: {
                stabilityThreshold: 200,
                pollInterval: 100
            }
        });
        this.watchers.push(watcher);

        //wait for this watcher to be ready
        await new Promise((resolve, reject) => {
            //If 'ready' takes too long, throw an exception so we at least know what's wrong
            let timer = setTimeout(() => {
                reject(new Error(`FSWatcher never emitted 'ready' event while watching ${JSON.stringify(paths)}. There is a bug in chokidar preventing watching non-existant directories, so verify every watched folder exists.`));
            }, 2000);

            watcher.on('ready', () => {
                resolve();
                clearTimeout(timer);
            });
        });

        return () => {
            //unwatch all paths
            watcher.unwatch(paths);
            //close the watcher
            watcher.close();
            //remove the watcher from our list
            this.watchers.splice(this.watchers.indexOf(watcher), 1);
        };
    }

    /**
     * Be notified of all events
     * @param event 
     * @param callback 
     */
    public on(event: 'all', callback: (event, path, details) => void) {
        let watchers = [...this.watchers];
        for (let watcher of watchers) {
            watcher.on(event, cb);
        }

        function cb(event, path, details) {
            callback(event, path, details);
        }

        //a disconnect function
        return () => {
            for (let watcher of watchers) {
                watcher.removeListener('all', cb);
            }
        };
    }
}