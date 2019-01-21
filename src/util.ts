import * as moment from 'moment';
import * as fsExtra from 'fs-extra';

export function log(...args) {
    let timestamp = `[${moment().format('hh:mm:ss A')}]`;
    console.log.apply(console.log, [timestamp, ...args]);
}
export function clear() {
    process.stdout.write('\x1B[2J\x1B[0f');
}

/**
 * Determine if the file exists
 * @param filePath
 */
export function fileExists(filePath: string) {
    return new Promise((resolve, reject) => {
        fsExtra.exists(filePath, resolve);
    });
}

/**
 * Load a file from disc into a string
 * @param filePath 
 */
export async function getFileContents(filePath: string) {
    return (await fsExtra.readFile(filePath)).toString();
}