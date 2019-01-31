import { FileReference, Diagnostic, Callable, ExpressionCall, File } from '../interfaces';
import util from '../util';
import { timingSafeEqual } from 'crypto';
import * as fsExtra from 'fs-extra';

export class XmlFile {
    constructor(
        public pathAbsolute: string,
        public pathRelative: string
    ) {

    }

    public scriptImports = [] as FileReference[];

    public diagnostics = [] as Diagnostic[];

    //TODO implement the xml CDATA parsing, which would populate this list
    public callables = [] as Callable[];

    //TODO implement the xml CDATA parsing, which would populate this list
    public expressionCalls = [] as ExpressionCall[];

    public reset() {
        this.wasProcessed = false;
        this.scriptImports = [];
        this.diagnostics = [];
        this.callables = [];
        this.expressionCalls = [];
    }

    /**
     * Indicates if this file was processed by the program yet. 
     */
    public wasProcessed = false;

    public async parse(fileContents?: string) {
        if (this.wasProcessed) {
            throw new Error(`File was already processed. Create a new file instead. ${this.pathAbsolute}`);
        }

        //load from disk if file contents are not provided
        if (typeof fileContents !== 'string') {
            fileContents = (await fsExtra.readFile(this.pathAbsolute)).toString();
        }

        //split the text into lines
        let lines = util.getLines(fileContents);

        //find all script imports
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            let line = lines[lineIndex];
            let scriptMatch = /(.*)(<\s*script.*uri\s*=\s*"(.*)".*\/>)/ig.exec(line)
            if (scriptMatch) {
                let leadingJunk = scriptMatch[1];
                let scriptTag = scriptMatch[2];
                let filePath = scriptMatch[3];
                let scriptColumnIndexBegin = leadingJunk.length;
                let columnIndexBegin = line.indexOf(filePath);

                this.scriptImports.push({
                    sourceFile: this,
                    text: filePath,
                    lineIndex: lineIndex,
                    columnIndexBegin: columnIndexBegin,
                    columnIndexEnd: columnIndexBegin + filePath.length,
                    scriptColumnIndexBegin: scriptColumnIndexBegin,
                    scriptColumnIndexEnd: scriptColumnIndexBegin + scriptTag.length,
                    pathRelative: util.getRelativePath(this.pathRelative, filePath)
                });
            }
        }
        this.wasProcessed = true;
    }

    /**
     * Determines if this xml file has a reference to the specified file (or if it's itself)
     * @param file 
     */
    public doesReferenceFile(file: File) {
        if (file === this) {
            return true;
        }
        for (let scriptImport of this.scriptImports) {
            //if the script imports the file
            if (scriptImport.pathRelative.toLowerCase() === file.pathRelative.toLowerCase()) {
                return true;
            }
        }
        //didn't find any script imports for this file
        return false;
    }
}