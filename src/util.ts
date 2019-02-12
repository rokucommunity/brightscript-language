import * as moment from 'moment';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { BRSConfig } from './ProgramBuilder';
import * as rokuDeploy from 'roku-deploy';
import { ValueKind, BRSType } from './interfaces';
import * as xml2js from 'xml2js';
import { Range, Position } from 'vscode-languageserver';
import * as brs from 'brs';

class Util {
    public log(...args) {
        let timestamp = `[${moment().format('hh:mm:ss A')}]`;
        console.log.apply(console.log, [timestamp, ...args]);
    }
    public clearConsole() {
        //TODO
        // process.stdout.write('\x1B[2J\x1B[0f');
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

    /**
     * Given a BRSConfig object, start with defaults,
     * merge with brsconfig.json and the provided options.
     * @param config
     */
    public async normalizeAndResolveConfig(config: BRSConfig) {
        let result = this.normalizeConfig({});

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

        return result;
    }

    /**
     * Set defaults for any missing items
     * @param config 
     */
    public normalizeConfig(config: BRSConfig) {
        config = config ? config : {} as BRSConfig;
        config.deploy = config.deploy === true ? true : false;
        //use default options from rokuDeploy
        config.files = config.files ? config.files : rokuDeploy.getOptions().files;
        config.skipPackage = config.skipPackage === true ? true : false;
        config.outFile = config.outFile ? config.outFile : 'out/package.zip';
        config.username = config.username ? config.username : 'rokudev';
        config.watch = config.watch === true ? true : false;
        return config;
    }

    /**
     * Get the root directory from options.
     * Falls back to options.cwd.
     * Falls back to process.cwd
     * @param options
     */
    public getRootDir(options: BRSConfig) {
        let originalProcessCwd = process.cwd();

        let cwd = options.cwd;
        cwd = cwd ? cwd : process.cwd();
        let rootDir = options.rootDir ? options.rootDir : cwd;

        process.chdir(cwd);

        rootDir = path.resolve(rootDir);

        process.chdir(originalProcessCwd);

        return rootDir;
    }

    /**
     * Format a string with placeholders replaced by argument indexes
     * @param subject 
     * @param params 
     */
    public stringFormat(subject: string, ...args) {
        return subject.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined' ? args[number] : match;
        });
    }

    public valueKindToString(kind: ValueKind): BRSType {
        switch (kind) {
            case ValueKind.Boolean: return 'boolean';
            case ValueKind.Callable: return 'function';
            case ValueKind.Double: return 'double';
            case ValueKind.Dynamic: return 'dynamic';
            case ValueKind.Float: return 'float';
            case ValueKind.Int32: return 'integer';
            case ValueKind.Int64: return 'longinteger';
            case ValueKind.Invalid: return 'invalid';
            case ValueKind.Object: return 'object';
            case ValueKind.String: return 'string';
            case ValueKind.Uninitialized: return 'uninitialized';
            case ValueKind.Void: return 'void';
        }
    }

    /**
     * Convert a 1-indexed brs Location to a 0-indexed vscode range
     * @param location 
     */
    public locationToRange(location: brs.lexer.Location) {
        return Range.create(
            location.start.line - 1,
            location.start.column - 1,
            location.end.line - 1,
            location.end.column - 1
        );
    }

    /**
     * Compute the range of a function's body
     * @param func
     */
    public getBodyRangeForFunc(func: brs.parser.Expr.Function) {
        return Range.create(
            //func body begins at start of line after its declaration
            func.location.start.line,
            0,
            //func body ends right before the `end function|sub` line
            func.end.location.start.line - 1,
            func.end.location.start.column - 1
        );
    }

    /**
     * Split a file by newline characters (LF or CRLF)
     * @param text
     */
    public getLines(text: string) {
        return text.split(/\r?\n/);
    }

    /**
     * Given an absollute path to a source file, and a target path,
     * compute the pkg path for the target relative to the source file's location
     * @param containingFilePathAbsolute 
     * @param targetPath 
     */
    public getPkgPathFromTarget(containingFilePathAbsolute: string, targetPath: string) {
        //if the target starts with 'pkg:', it's an absolute path. Return as is
        if (targetPath.indexOf('pkg:/') === 0) {
            targetPath = targetPath.substring(5);
            if (targetPath === '') {
                return null;
            } else {
                return path.normalize(targetPath);
            }
        }
        if (targetPath === 'pkg:') {
            return null;
        }

        //remove the filename
        let containingFolder = path.normalize(path.dirname(containingFilePathAbsolute));
        //start with the containing folder, split by slash
        let result = containingFolder.split(path.sep);

        //split on slash
        let targetParts = path.normalize(targetPath).split(path.sep);

        for (let part of targetParts) {
            if (part === '' || part === '.') {
                //do nothing, it means current directory
                continue;
            }
            if (part === '..') {
                //go up one directory
                result.pop();
            } else {
                result.push(part);
            }
        }
        return result.join(path.sep);
    }

    /**
     * Compute the relative path from the source file to the target file
     * @param pkgSourcePathAbsolute  - the absolute path to the source relative to the package location
     * @param pkgTargetPathAbsolute  - the absolute path ro the target relative to the package location
     */
    public getRelativePath(pkgSourcePathAbsolute: string, pkgTargetPathAbsolute: string) {
        pkgSourcePathAbsolute = path.normalize(pkgSourcePathAbsolute);
        pkgTargetPathAbsolute = path.normalize(pkgTargetPathAbsolute);

        //break by path separator
        let sourceParts = pkgSourcePathAbsolute.split(path.sep);
        let targetParts = pkgTargetPathAbsolute.split(path.sep);

        let commonParts = [] as string[];
        //find their common root
        for (let i = 0; i < targetParts.length; i++) {
            if (targetParts[i].toLowerCase() === sourceParts[i].toLowerCase()) {
                commonParts.push(targetParts[i]);
            } else {
                //we found a non-matching part...so no more commonalities past this point
                break;
            }
        }

        //throw out the common parts from both sets
        sourceParts.splice(0, commonParts.length);
        targetParts.splice(0, commonParts.length);

        //throw out the filename part of source
        sourceParts.splice(sourceParts.length - 1, 1);
        //start out by adding updir paths for each remaining source part
        let resultParts = sourceParts.map(x => '..');

        //now add every target part
        resultParts = [...resultParts, ...targetParts];
        return path.join.apply(path, resultParts);
    }

    /**
     * Find all properties in an object that match the predicate. 
     * @param obj 
     * @param predicate 
     * @param parentKey 
     */
    public findAllDeep<T>(obj: any, predicate: (value: any) => boolean | undefined, parentKey?: string) {
        let result = [] as { key: string; value: T }[];

        //base case. If this object maches, keep it as a result
        if (predicate(obj) === true) {
            result.push({
                key: parentKey,
                value: obj
            });
        }

        //look through all children
        if (obj instanceof Object) {
            for (let key in obj) {
                let value = obj[key];
                let fullKey = parentKey ? parentKey + '.' + key : key;
                if (typeof value === 'object') {
                    result = [...result, ...this.findAllDeep<T>(value, predicate, fullKey)];
                }
            }
        }
        return result;
    }

    /**
     * Test if `position` is in `range`. If the position is at the edges, will return true.
     * Adapted from core vscode 
     * @param range 
     * @param position 
     */
    public rangeContains(range: Range, position: Position) {
        if (position.line < range.start.line || position.line > range.end.line) {
            return false;
        }
        if (position.line === range.start.line && position.character < range.start.character) {
            return false;
        }
        if (position.line === range.end.line && position.character > range.end.character) {
            return false;
        }
        return true;
    }

    /**
     * Parse an xml file and get back a javascript object containing its results
     * @param text
     */
    public parseXml(text: string) {
        return new Promise<any>((resolve, reject) => {
            xml2js.parseString(text, function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    public propertyCount(object: Object) {
        var count = 0;
        for (let key in object) {
            if (object.hasOwnProperty(key)) {
                count++;
            }
        }
        return count;
    }

    public defer<T>() {
        let resolve: (value?: T | PromiseLike<T>) => void;
        let reject: (reason?: any) => void;
        let promise = new Promise<T>((resolveValue, rejectValue) => {
            resolve = resolveValue;
            reject = rejectValue;
        });
        return {
            promise: promise,
            resolve: resolve,
            reject: reject
        };
    }

}

export default new Util();