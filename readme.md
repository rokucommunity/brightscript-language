# BrightScript

A sort-of compiler and a language server for Roku's BrightScript language. 


Compiler options specified on the command line override those specified in the tsconfig.json file.


# brsconfig.json

## Overview
The presence of a `brsconfig.json` file in a directory indicates that the directory is the root of a BrightScript project. The `brsconfig.json` file specifies the root files and the compiler options required to compile the project. A project is compiled in one of the following ways: 

## Using brsconfig.json

 - By invoking `brsc` with no input files, in which case the compiler searches for the `brsconfig.json` file starting in the current directory and continuing up the parent directory chain.
  - By invoking `brsc` with no input files and a `--project` (or just `-p`) command line option that specifies the path of a directory containing a `brsconfigjson` file, or a path to a valid `.json` file containing the configurations. 


## Configuration inheritance with `extends`

A `brsconfig.json` file can inherit configurations from another file using the `extends` property.

The extends is a top-level property in `tsconfig.json`. `extends`’ value is a string containing a path to another configuration file to inherit from.

The configuration from the base file are loaded first, then overridden by those in the inheriting config file. If a circularity is encountered, we report an error.

The `files` property from the inheriting config file overwrite those from the base config file.

All relative paths found in the configuration file will be resolved relative to the configuration file they originated in.

