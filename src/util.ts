import * as moment from 'moment';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { BRSConfig } from './BRSLanguageServer';
import * as rokuDeploy from 'roku-deploy';

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

/**
 * Make the path absolute, and replace all separators with the current OS's separators
 * @param filePath 
 */
export function normalizeFilePath(filePath: string) {
    return path.normalize(path.resolve(filePath));
}

/**
 * Find the path to the config file. 
 * If the config file path doesn't exist
 * @param configFilePath 
 */
export async function getConfigFilePath(cwd?: string) {
    cwd = cwd ? cwd : process.cwd();
    let configPath = path.join(cwd, 'brsconfig.json');
    //find the nearest config file path
    for (let i = 0; i < 100; i++) {
        if (await fileExists(configPath)) {
            return configPath;
        } else {
            let parentDirPath = path.dirname(path.dirname(configPath))
            configPath = path.join(parentDirPath, 'brsconfig.json');
        }
    }
}

/**
 * Load the contents of a config file. 
 * If the file extends another config, this will load the base config as well. 
 * @param configFilePath 
 * @param parentProjectPaths 
 */
export async function loadConfigFile(configFilePath: string, parentProjectPaths?: string[]) {
    let result = {} as BRSConfig;

    let cwd = process.cwd();

    if (configFilePath) {
        //keep track of the inheritance chain
        parentProjectPaths = parentProjectPaths ? parentProjectPaths : [];
        configFilePath = path.resolve(configFilePath);
        if (parentProjectPaths && parentProjectPaths.indexOf(configFilePath) > -1) {
            parentProjectPaths.push(configFilePath);
            parentProjectPaths.reverse();
            throw new Error('Circular dependency detected: "' + parentProjectPaths.join('" => ') + '"')
        }
        //load the project file
        let projectFileContents = await getFileContents(configFilePath);
        let projectConfig = JSON.parse(projectFileContents);

        //set working directory to the location of the project file
        process.chdir(path.dirname(configFilePath));

        //normalize config (and resolve any inheritance)
        projectConfig = await loadConfigFile(projectConfig, [...parentProjectPaths, configFilePath]);

        result = Object.assign(result, projectConfig);

        //restore working directory
        process.chdir(cwd);
    }
}

function getDefaultConfig() {
    let options = {
        deploy: false,
        //use default options from rokuDeploy
        files: rokuDeploy.getOptions().files,
        skipPackage: false,
        outFile: 'out/package.zip',
        username: 'rokudev',
        watch: false
    } as BRSConfig;
    return options;
}

/**
 * Given a BRSConfig object, start with defaults,
 * merge with brsconfig.json and the provided options.
 * @param config 
 */
export async function normalizeConfig(config: BRSConfig) {
    let result = getDefaultConfig();

    //if no options were provided, try to find a brsconfig.json file
    if (!config || !config.project) {
        result.project = await getConfigFilePath();
    }
    if (result.project) {
        let configFile = await loadConfigFile(result.project);
        result = Object.assign(result, configFile);
    }

    //override the defaults with the specified options
    result = Object.assign(result, config);

    //sanitize the options
    if (result.cwd && !result.rootDir) {
        result.rootDir = result.cwd;
    }

    return result;
}