# BrightScript

A language server for Roku's BrightScript language.

[![Build Status](https://travis-ci.org/TwitchBronBron/brightscript.svg?branch=master)](https://travis-ci.org/TwitchBronBron/brightscript)
[![codecov](https://codecov.io/gh/TwitchBronBron/brightscript/branch/master/graph/badge.svg)](https://codecov.io/gh/TwitchBronBron/brightscript)

 **Disclaimer:** This is currently a **work in progress**. Use at your own risk, but feel free to raise any issues you may find. 

## Installation

Since this is a work in progress, there is not yet an npm package. However, you can install directly from github using `npm` by running the following command:

```bash
npm install -g github:twitchbronbron/brightscript
```

or, lock in a specific commit:

```bash
npm install -g "github:twitchbronbron/brightscript#98cc399"
```

The installation instructions will be updaed once the project reaches a more stable point.

## Usage

### Basic Usage

If your project structure exactly matches Roku's, and you run the command from the root of your project, then you can do the following: 

```bash
brsc 
```

That's it! It will find all files in your brightscript project, check for syntax and static analysis errors, and if there were no errors, it will produce a zip at `./out/project.zip`

### Advanced Usage

If you need to configure `brsc`, you can do so in two ways: 

1. Using command line arguments. 
    This tool can be fully configured using command line arguments. To see a full list, run `brsc --help` in your terminal.
2. Using a `brsconfig.json` file. See [the available options](#brsconfig.json-options) below. 
    By default, `brsc` looks for a `brsconfig.json` file at the same directory that `brsc` is executed. If you want to store your `brsconfig.json` file somewhere else, then you should provide the `--project` argument and specify the path to your `brsconfig.json` file. 

### Examples

1. Your project resides in a subdirectory of your workspace folder. 

    ```bash
    brsc --root-dir ./rokuSourceFiles
    ```
2. Run the compiler in watch mode

    ```bash
    brsc --watch
    ```

3. Run the compiler in watch mode, and redeploy to the roku on every change
    ```bash
    brsc --watch --deploy --host 192.168.1.10 --password secret_password
    ```
4. Use a brsconfig.json file not located at cwd
    ```bash
    brsc --project ./some_folder/brsconfig.json
    ```
## brsconfig.json

### Overview
The presence of a `brsconfig.json` file in a directory indicates that the directory is the root of a BrightScript project. The `brsconfig.json` file specifies the root files and the compiler options required to compile the project.

### Configuration inheritance with `extends`

A `brsconfig.json` file can inherit configurations from another file using the `extends` property.

The extends is a top-level property in `brsconfig.json`. `extends`’ value is a string containing a path to another configuration file to inherit from.

The configuration from the base file are loaded first, then overridden by those in the inheriting config file. If a circularity is encountered, we report an error.

The `files` property from the inheriting config file overwrite those from the base config file.

All relative paths found in the configuration file will be resolved relative to the configuration file they originated in.


### brsconfig.json options

These are the options available in the `brsconfig.json` file. 

 - **project**: `string` - A path to a project file. This is really only passed in from the command line, and should not be present in `brsconfig.json` files

 - **extends**: `string` - Relative or absolute path to another `brsconfig.json` file that this `brsconfig.json` file should import and then override

 - **cwd**: `string` - Override the current working directory

 - **rootDir**: `string` - The root directory of your roku project. Defaults to current directory

 - **files**: ` (string | string[] | { src: string | string[]; dest?: string })[]` - The list file globs used to find all files for the project. If using the {src;dest;} format, you can specify a different destination directory for the matched files in src. 

 - **outFile**: `string` -  The path (including filename) where the output file should be placed (defaults to `"./out/[WORKSPACE_FOLDER_NAME].zip"`).
 
 - **skipPackage**: `boolean` - Prevents the zip file from being created. This has no effect if deploy is true. 

 - **watch**: `boolean` -  If true, the server will keep running and will watch and recompile on every file change.

 - **deploy**: `boolean` -  If true, after a success buld, the project will be deployed to the roku specified in host

 - **host**: `string` -  The host of the Roku that this project will deploy to

 - **username**: `string` - the username to use when deploying to a Roku device.

 - **password**: `string` - The password to use when deploying to a roku device.

 - **ignoreErrorCodes**: `number[]` - A list of error codes that the compiler should NOT emit, even if encountered. 

 - **emitFullPaths**: `boolean` -  Emit full paths to files when printing diagnostics to the console. Defaults to false

## Language Server Protocol

This project also contributes a class that aligns with Microsoft's [Language Server Protocol](https://microsoft.github.io/language-server-protocol/), which makes it easy to integrate `brightscript` with any IDE that supports the protocol. We won't go into more detail here, but you can use the `LanguageServer` class from this project to integrate into your IDE. The [vscode-brightscript-language](https://github.com/twitchbronbron/vscode-brightscript-language) extension uses this LanguageServer class for Visual Studio Code support. 