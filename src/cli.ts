#!/usr/bin/env node
import * as commandLineArgs from 'command-line-args';
import * as commandLineUsage from 'command-line-usage';
import { BRSLanguageServer } from '.';
let args = [
    { name: 'out-file', type: String, description: 'Path to the zip folder containing the bundled project.' },
    { name: 'project', type: String, description: 'Path to a brsconfig.json project file.' },
    { name: 'root-dir', type: String, description: 'Path to the root of your project files (where the manifest lives). Defaults to current directory.' },
    { name: 'files', type: String, multiple: true, defaultOption: true, description: 'The list of files (or globs) to include in your project. Be sure to wrap these in quotes when using globs.' },
    { name: 'watch', type: Boolean, description: 'Watch input files.' },
    { name: 'noZip', type: Boolean, description: 'Do not create the zip file for the project.' },
    { name: 'deploy', type: Boolean, description: 'Deploy to a Roku device if compilation succeeds. When in watch mode, this will deploy on every change.' },
    { name: 'host', type: String, description: 'The host used when deploying to a Roku.' },
    { name: 'username', type: String, description: 'The username for deploying to a Roku. Defaults to "rokudev".' },
    { name: 'password', type: String, description: 'The password for deploying to a Roku.' },
    { name: 'help', type: Boolean, description: 'View help information.' }
]
const options = commandLineArgs(args, { camelCase: true });
if (options.help) {
    //wire up the help docs 
    const usage = commandLineUsage([{
        header: 'BrightScript',
        content: 'A full suite of tools for the BrightScript language'
    }, {
        header: 'Options',
        optionList: args
    }]);
    console.log(usage);
} else {
    var server = new BRSLanguageServer();
    server.run(<any>options)
        .then(() => {
            var k = 2;
        })
        .catch((error) => {
            console.error(error);
            process.exit(-1);
        });
}