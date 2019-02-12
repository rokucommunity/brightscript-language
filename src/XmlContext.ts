import { Context } from './Context';
import { XmlFile } from './files/XmlFile';
import { Program } from './Program';
import { BrsFile } from './files/BrsFile';

export class XmlContext extends Context {
    constructor(xmlFile: XmlFile) {
        super(xmlFile.pkgPath, (file) => {
            return this.xmlFile.doesReferenceFile(file);
        });
        this.xmlFile = xmlFile;
        this.xmlFileHandles = [
            //when the xml file adds script imports to its list, find those files from program and add to context
            this.xmlFile.on('add-script-imports', (scriptImports) => {
                //add every file from the program for these imports
                for (let scriptImport of scriptImports) {
                    var file = this.program.getFileByPkgPath(scriptImport.pkgPath);
                    if (file) {
                        this.addOrReplaceFile(file);
                    }
                }
            }),
            //when the xml file removes script imports, remove those files from context
            this.xmlFile.on('remove-script-imports', scriptImports => {
                for (let scriptImport of scriptImports) {
                    var file = this.program.getFileByPkgPath(scriptImport.pkgPath);
                    if (file) {
                        this.removeFile(file);
                    }
                }
            })
        ];
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
            this.program.on('file-removed', (file) => {
                if (
                    //xml file has a parent
                    this.xmlFile.parent &&
                    //incoming file IS that parent
                    file === this.xmlFile.parent
                ) {
                    this.isValidated = false;
                    this.xmlFile.detachParent();
                }
            })
        );

        //try resolving the parent component
        for (let key in this.program.files) {
            this.addParentIfMatch(this.program.files[key]);
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