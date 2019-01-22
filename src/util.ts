import * as moment from 'moment';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { BRSConfig } from './BRSLanguageServer';
import * as rokuDeploy from 'roku-deploy';

class Util {
    public log(...args) {
        let timestamp = `[${moment().format('hh:mm:ss A')}]`;
        console.log.apply(console.log, [timestamp, ...args]);
    }
    public clear() {
        process.stdout.write('\x1B[2J\x1B[0f');
    }

    /**
     * Determine if the file exists
     * @param filePath
     */
    public fileExists(filePath: string) {
        return new Promise((resolve, reject) => {
            fsExtra.exists(filePath, resolve);
        });
    }

    /**
     * Load a file from disc into a string
     * @param filePath 
     */
    public async  getFileContents(filePath: string) {
        return (await fsExtra.readFile(filePath)).toString();
    }

    /**
     * Make the path absolute, and replace all separators with the current OS's separators
     * @param filePath 
     */
    public normalizeFilePath(filePath: string) {
        return path.normalize(path.resolve(filePath));
    }

    /**
     * Find the path to the config file. 
     * If the config file path doesn't exist
     * @param configFilePath 
     */
    public async  getConfigFilePath(cwd?: string) {
        cwd = cwd ? cwd : process.cwd();
        let configPath = path.join(cwd, 'brsconfig.json');
        //find the nearest config file path
        for (let i = 0; i < 100; i++) {
            if (await this.fileExists(configPath)) {
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
    public async loadConfigFile(configFilePath: string, parentProjectPaths?: string[]) {
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
            let projectFileContents = await this.getFileContents(configFilePath);
            let projectConfig = JSON.parse(projectFileContents) as BRSConfig;

            //set working directory to the location of the project file
            process.chdir(path.dirname(configFilePath));

            let result: BRSConfig;
            //if the project has a base file, load it
            if (projectConfig && typeof projectConfig.extends === 'string') {
                let baseProjectConfig = await this.loadConfigFile(projectConfig.extends, [...parentProjectPaths, configFilePath]);
                //extend the base config with the current project settings
                result = Object.assign({}, baseProjectConfig, projectConfig);
            } else {
                result = projectConfig;
            }

            //make any paths in the config absolute (relative to the CURRENT config file)
            if (result.outFile) {
                result.outFile = path.resolve(result.outFile);
            }
            if (result.rootDir) {
                result.rootDir = path.resolve(result.rootDir);
            }
            if (result.cwd) {
                result.cwd = path.resolve(result.cwd);
            }

            //restore working directory
            process.chdir(cwd);
            return result;
        }
    }

    getDefaultConfig() {
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
    public async  normalizeConfig(config: BRSConfig) {
        let result = this.getDefaultConfig();

        //if no options were provided, try to find a brsconfig.json file
        if (!config || !config.project) {
            result.project = await this.getConfigFilePath();
        } else {
            //use the config's project link
            result.project = config.project;
        }
        if (result.project) {
            let configFile = await this.loadConfigFile(result.project);
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
}

export default new Util();