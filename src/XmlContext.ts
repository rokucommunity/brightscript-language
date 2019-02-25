import { Context } from './Context';
import { XmlFile } from './files/XmlFile';
import { Program } from './Program';
import { BrsFile } from './files/BrsFile';
import { diagnosticMessages } from './DiagnosticMessages';
import { FileReference } from './interfaces';
import { Range } from 'vscode-languageserver';
import util from './util';

export class XmlContext extends Context {
    constructor(xmlFile: XmlFile) {
        super(xmlFile.pkgPath, (file) => {
            return this.xmlFile.doesReferenceFile(file);
        });
        this.xmlFile = xmlFile;
        this.xmlFileHandles = [
            //when the xml file gets a parent added, link to that parent's context
            this.xmlFile.on('attach-parent', (parent: XmlFile) => {
                this.handleXmlFileParentAttach(parent);
            }),

            //when xml file detaches its parent, remove the context link
            this.xmlFile.on('detach-parent', () => {
                this.detachParent();
            }),
        ];

        //if the xml file already has a parent attached, attach our context to that parent xml's context
        if (this.xmlFile.parent) {
            this.handleXmlFileParentAttach(this.xmlFile.parent);
        }
    }

    public attachProgram(program: Program) {
        super.attachProgram(program);

        //if the xml file has an unresolved parent, look for its parent on every file add
        this.programHandles.push(
            this.program.on('file-added', (file) => {
                this.addParentIfMatch(file);
            })
        );

        //detach xml file's parent if it's removed from the program
        this.programHandles.push(
            this.program.on('file-removed', this.onProgramFileRemove.bind(this))
        );

        //try finding and attaching the parent component
        for (let key in this.program.files) {
            this.addParentIfMatch(this.program.files[key]);
        }

        //if the xml file already has a parent xml file, attach it
        if (this.xmlFile.parent && this.xmlFile.parent !== (this.program.platformContext as any)) {
            this.handleXmlFileParentAttach(this.xmlFile.parent);
        }
    }

    /**
     * Event handler for when the attached program removes a file
     * @param file 
     */
    private onProgramFileRemove(file: BrsFile | XmlFile) {
        if (
            //incoming file is an xml file
            file instanceof XmlFile &&
            //incoming file has a component name
            file.componentName &&
            //this xml file has a parent
            this.xmlFile.parentComponentName &&
            //incoming file has same name as parent
            file.componentName.toLowerCase() === this.xmlFile.parentComponentName.toLowerCase()
        ) {
            this.isValidated = false;
            this.xmlFile.detachParent();

            //disconnect the context link
            this.detachParent();
        }
    }

    private handleXmlFileParentAttach(file: XmlFile) {
        var parentContext = this.program.contexts[file.pkgPath];
        if (parentContext) {
            this.attachParentContext(parentContext);
        }
    }

    private addParentIfMatch(file: BrsFile | XmlFile) {
        if (
            //xml file has no parent
            !this.xmlFile.parent &&
            //xml file WANTS a parent
            this.xmlFile.parentComponentName &&
            //incoming file is an xml file
            file instanceof XmlFile &&
            //xml file's name matches the desired parent name
            file.componentName === this.xmlFile.parentComponentName
        ) {
            this.isValidated = false;
            this.xmlFile.attachParent(file);
        }
    }

    public validate() {
        if (this.isValidated === false) {
            super.validate();

            //detect when the child imports a script that its ancestor also imports
            this.diagnosticDetectDuplicateAncestorScriptImports();

            //detect script imports to files that are not loaded in this context
            this.diagnosticValidateScriptImportPaths();
        }
    }

    /**
     * Detect when a child has imported a script that an ancestor also imported
     */
    private diagnosticDetectDuplicateAncestorScriptImports() {
        if (this.xmlFile.parent) {
            //build a lookup of pkg paths -> FileReference so we can more easily look up collisions 
            var parentScriptImports = this.xmlFile.parent.getAllScriptImports();
            var lookup = {} as { [pkgPath: string]: FileReference };
            for (let parentScriptImport of parentScriptImports) {
                //keep the first occurance of a pkgPath. Parent imports are first in the array
                if (!lookup[parentScriptImport.pkgPath]) {
                    lookup[parentScriptImport.pkgPath] = parentScriptImport;
                }
            }

            //add warning for every import this file shares with an ancestor
            for (let scriptImport of this.xmlFile.ownScriptImports) {
                let ancestorScriptImport = lookup[scriptImport.pkgPath];
                if (ancestorScriptImport) {
                    let ancestorComponentName = (ancestorScriptImport.sourceFile as XmlFile).componentName;
                    this._diagnostics.push({
                        severity: 'warning',
                        file: this.xmlFile,
                        location: Range.create(scriptImport.lineIndex, scriptImport.columnIndexBegin, scriptImport.lineIndex, scriptImport.columnIndexEnd),
                        code: diagnosticMessages.Unnecessary_script_import_in_child_from_parent_1009.code,
                        message: util.stringFormat(diagnosticMessages.Unnecessary_script_import_in_child_from_parent_1009.message, ancestorComponentName)
                    });
                }
            }

        }
    }

    /**
     * Verify that all of the scripts ipmorted by 
     */
    private diagnosticValidateScriptImportPaths() {
        //verify every script import
        for (let scriptImport of this.xmlFile.ownScriptImports) {
            let referencedFile = this.getFileByRelativePath(scriptImport.pkgPath);
            //if we can't find the file
            if (!referencedFile) {
                this._diagnostics.push({
                    message: diagnosticMessages.Referenced_file_does_not_exist_1004.message,
                    code: diagnosticMessages.Referenced_file_does_not_exist_1004.code,
                    location: Range.create(
                        scriptImport.lineIndex,
                        scriptImport.columnIndexBegin,
                        scriptImport.lineIndex,
                        scriptImport.columnIndexEnd
                    ),
                    file: this.xmlFile,
                    severity: 'error',
                });
            } else {
                //if the script import path is not identical in case to the actual path, add a warning
                if (scriptImport.pkgPath !== referencedFile.file.pkgPath) {
                    this._diagnostics.push({
                        message: util.stringFormat(
                            diagnosticMessages.Script_import_case_mismatch_1012.message,
                            referencedFile.file.pkgPath
                        ),
                        code: diagnosticMessages.Script_import_case_mismatch_1012.code,
                        location: Range.create(
                            scriptImport.lineIndex,
                            scriptImport.columnIndexBegin,
                            scriptImport.lineIndex,
                            scriptImport.columnIndexEnd
                        ),
                        file: this.xmlFile,
                        severity: 'warning'
                    });
                }
            }
        }
    }


    private xmlFileHandles = [] as (() => void)[];

    private xmlFile: XmlFile;

    public dispose() {
        super.dispose();
        for (var disconnect of this.xmlFileHandles) {
            disconnect();
        }
    }
}