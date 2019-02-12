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
            this.program.on('file-removed', (file) => {
                debugger;
                if (
                    //xml file has a parent
                    this.xmlFile.parent &&
                    //incoming file IS that parent
                    file === this.xmlFile.parent
                ) {
                    this.isValidated = false;
                    this.xmlFile.detachParent();

                    //disconnect the context link
                    this.detachParent();
                }
            })
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


    private xmlFileHandles = [] as (() => void)[];

    private xmlFile: XmlFile;

    public dispose() {
        super.dispose();
        for (var disconnect of this.xmlFileHandles) {
            disconnect();
        }
    }
}