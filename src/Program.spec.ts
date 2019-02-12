import * as path from 'path';
import * as sinonImport from 'sinon';

import { expect, assert } from 'chai';
import { Program } from './Program';
import { Diagnostic } from './interfaces';
import { diagnosticMessages } from './DiagnosticMessages';
import { CompletionItemKind, Position, Range } from 'vscode-languageserver';
import { XmlFile } from './files/XmlFile';
import util from './util';
import { Context } from './Context';
import { BrsFile } from './files/BrsFile';
let n = path.normalize;

let testProjectsPath = path.join(__dirname, '..', 'testProjects');

let sinon = sinonImport.createSandbox();
let rootDir = 'C:/projects/RokuApp';
let program: Program;
beforeEach(() => {
    program = new Program({ rootDir });
});
afterEach(() => {
    sinon.restore();
});

describe('Program', () => {
    describe('addFile', () => {
        it('works with different cwd', async () => {
            let projectDir = path.join(testProjectsPath, 'project2');
            let program = new Program({ cwd: projectDir });
            await program.addOrReplaceFile('source/lib.brs', 'function main()\n    print "hello world"\nend function');
            // await program.reloadFile('source/lib.brs', `'this is a comment`);
            //if we made it to here, nothing exploded, so the test passes
        });

        it('adds files in the source folder to the global context', async () => {
            expect(program.contexts['global']).to.exist;
            //no files in global context
            expect(Object.keys(program.contexts['global'].files).length).to.equal(0);

            let mainPath = path.normalize(`${rootDir}/source/main.brs`);
            //add a new source file
            await program.addOrReplaceFile(mainPath, '');
            //file should be in global context now
            expect(program.contexts['global'].files[mainPath]).to.exist;

            //add an unreferenced file from the components folder
            await program.addOrReplaceFile(`${rootDir}/components/component1/component1.brs`, '');
            //global context should have the same number of files
            expect(program.contexts['global'].files[mainPath]).to.exist;
            expect(program.contexts['global'].files[`${rootDir}/components/component1/component1.brs`]).not.to.exist;
        });

        it('normalizes file paths', async () => {
            let filePath = `${rootDir}/source\\main.brs`
            await program.addOrReplaceFile(filePath, '')
            expect(program.contexts['global'].files[path.normalize(filePath)]);

            //shouldn't throw an exception because it will find the correct path after normalizing the above path and remove it
            try {
                program.removeFile(filePath);
                //no error
            } catch (e) {
                assert.fail(null, null, 'Should not have thrown exception');
            }
        });

        it('creates a context for every component xml file', () => {
            // let componentPath = path.resolve(`${rootDir}/components/component1.xml`);
            // await program.loadOrReloadFile('components', '')
        });
    });
    describe('validate', () => {
        it('recognizes platform functions', async () => {
            expect(program.getDiagnostics().length).to.equal(0);
            program.addOrReplaceFile('absolute_path/file.brs', `
                function DoB()
                    abs(1.5)
                end function
            `)
            //validate the context
            program.validate();
            //shouldn't have any errors
            expect(program.getDiagnostics().length).to.equal(0);
        });

        it('catches duplicate methods in single file', async () => {
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.getDiagnostics().length).to.equal(2);
            expect(program.getDiagnostics()[0].message.indexOf('Duplicate sub declaration'))
        });

        it('catches duplicate methods across multiple files', async () => {
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
            `);
            await program.addOrReplaceFile(`${rootDir}/source/lib.brs`, `
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.getDiagnostics().length).to.equal(2);
            expect(program.getDiagnostics()[0].message.indexOf('Duplicate sub declaration'))
        });

        it('maintains correct callables list', async () => {
            let initialCallableCount = program.contexts['global'].getCallables().length;
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
            `);
            expect(program.contexts['global'].getCallables().length).equals(initialCallableCount + 2);
            //set the file contents again (resetting the wasProcessed flag)
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
                `);
            expect(program.contexts['global'].getCallables().length).equals(initialCallableCount + 2);
            program.removeFile(`${rootDir}/source/main.brs`);
            expect(program.contexts['global'].getCallables().length).equals(initialCallableCount);
        });

        it('resets errors on revalidate', async () => {
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.getDiagnostics().length).to.equal(2);
            //set the file contents again (resetting the wasProcessed flag)
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.getDiagnostics().length).to.equal(2);

            //load in a valid file, the errors should go to zero
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.getDiagnostics().length).to.equal(0);
        });

        it('identifies invocation of unknown callable', async () => {
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    name = "Hello"
                    DoSomething(name) ' call a function that doesn't exist
                end sub
            `);

            await program.validate();
            expect(program.getDiagnostics().length).to.equal(1);
            expect(program.getDiagnostics()[0].message.toLowerCase().indexOf('cannot find name')).to.equal(0);
        });

        it('detects methods from another file in a subdirectory', async () => {
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    DoSomething()
                end sub
            `);
            await program.addOrReplaceFile(`${rootDir}/source/ui/lib.brs`, `
                function DoSomething()
                    print "hello world"
                end function
            `);
            await program.validate();
            expect(program.getDiagnostics().length).to.equal(0);
        });
    });

    describe('hasFile', () => {
        it('recognizes when it has a file loaded', async () => {
            expect(program.hasFile('file1.brs')).to.be.false;
            await program.addOrReplaceFile('file1.brs', `'comment`);
            expect(program.hasFile('file1.brs')).to.be.true;
        });
    });

    describe('loadOrReloadFile', async () => {
        it('creates a new context for every added component xml', async () => {
            //we have global callables, so get that initial number
            await program.addOrReplaceFile(`${rootDir}/components/component1.xml`, '');
            expect(program.contexts).to.have.property(`components${path.sep}component1.xml`);

            await program.addOrReplaceFile(`${rootDir}/components/component1.xml`, '');
            await program.addOrReplaceFile(`${rootDir}/components/component2.xml`, '');
            expect(program.contexts).to.have.property(`components${path.sep}component1.xml`);
            expect(program.contexts).to.have.property(`components${path.sep}component2.xml`);
        });

        it('includes referenced files in xml contexts', async () => {
            let xmlPath = path.resolve(`${rootDir}/components/component1.xml`);
            await program.addOrReplaceFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);
            let brsPath = path.resolve(`${rootDir}/components/component1.brs`);
            await program.addOrReplaceFile(brsPath, '');

            let context = program.contexts[`components${path.sep}component1.xml`];
            expect(context.files[xmlPath].file.pkgPath).to.equal(`components${path.sep}component1.xml`);
            expect(context.files[brsPath].file.pkgPath).to.equal(`components${path.sep}component1.brs`);
        });

        it('adds xml file to files map', async () => {
            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            await program.addOrReplaceFile(xmlPath, '');
            expect(program.files[xmlPath]).to.exist;
        });

        it('detects missing script reference', async () => {
            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            await program.addOrReplaceFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);
            await program.validate();
            expect(program.getDiagnostics().length).to.equal(1);
            expect(program.getDiagnostics()[0]).to.deep.include(<Diagnostic>{
                file: program.files[xmlPath],
                location: Range.create(3, 58, 3, 88),
                message: diagnosticMessages.Referenced_file_does_not_exist_1004.message,
                code: diagnosticMessages.Referenced_file_does_not_exist_1004.code,
                severity: 'error'
            });
        });
    });

    describe('reloadFile', () => {
        it('picks up new files in a context when an xml file is loaded', async () => {
            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            await program.addOrReplaceFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);
            await program.validate();
            expect(program.getDiagnostics()[0]).to.deep.include(<Diagnostic>{
                message: diagnosticMessages.Referenced_file_does_not_exist_1004.message
            });

            //add the file, the error should go away
            let brsPath = path.normalize(`${rootDir}/components/component1.brs`);
            await program.addOrReplaceFile(brsPath, '');
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;

            //add the xml file back in, but change the component brs file name. Should have an error again
            await program.addOrReplaceFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component2.brs" />
                </component>
            `);
            program.validate();
            expect(program.getDiagnostics()[0]).to.deep.include(<Diagnostic>{
                message: diagnosticMessages.Referenced_file_does_not_exist_1004.message
            });
        });

        it('handles when the brs file is added before the component', async () => {
            let brsPath = path.normalize(`${rootDir}/components/component1.brs`);
            let brsFile = await program.addOrReplaceFile(brsPath, '');

            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            let xmlFile = await program.addOrReplaceFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);
            await program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            expect(program.contexts[xmlFile.pkgPath].files[brsPath]).to.exist;
        });

        it('reloads referenced fles when xml file changes', async () => {
            let brsPath = path.normalize(`${rootDir}/components/component1.brs`);
            let brsFile = await program.addOrReplaceFile(brsPath, '');

            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            let xmlFile = await program.addOrReplaceFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    
                </component>
            `);
            await program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            expect(program.contexts[xmlFile.pkgPath].files[brsPath]).not.to.exist;

            //reload the xml file contents, adding a new script reference.
            xmlFile = await program.addOrReplaceFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);

            expect(program.contexts[xmlFile.pkgPath].files[brsPath]).to.exist;

        });
    });

    describe('getCompletions', () => {
        it('finds all file paths when initiated on xml uri', async () => {
            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            let xmlFile = await program.addOrReplaceFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene">
                    <script type="text/brightscript" uri="" />
                </component>
            `);
            let brsPath = path.normalize(`${rootDir}/components/component1.brs`);
            await program.addOrReplaceFile(brsPath, '');
            let completions = program.getCompletions(xmlPath, Position.create(3, 58));
            expect(completions[0]).to.include({
                kind: CompletionItemKind.File,
                label: 'component1.brs'
            });
            expect(completions[1]).to.include({
                kind: CompletionItemKind.File,
                label: 'pkg:/components/component1.brs'
            });
        });
    });

    describe('xml inheritance', () => {
        it('handles parent-child attach and detach', async () => {
            //create parent component
            let parentFile = await program.addOrReplaceFile(n(`${rootDir}/components/ParentScene.xml`), `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="ParentScene" extends="Scene">
                </component>
            `);

            //create child component
            let childFile = await program.addOrReplaceFile(n(`${rootDir}/components/ChildScene.xml`), `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="ChildScene" extends="ParentScene">
                </component>
            `);

            //the child should have been attached to the parent
            expect((childFile as XmlFile).parent).to.equal(parentFile);

            //change the name of the parent
            parentFile = await program.addOrReplaceFile(n(`${rootDir}/components/ParentScene.xml`), `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="NotParentScene" extends="Scene">
                </component>
            `);

            //the child should no longer have a parent
            expect((childFile as XmlFile).parent).not.to.exist;
        });

        it('provides child components with parent functions', async () => {
            //create parent component
            await program.addOrReplaceFile(n(`${rootDir}/components/ParentScene.xml`), `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="ParentScene" extends="Scene">
                </component>
            `);

            //create child component
            await program.addOrReplaceFile(n(`${rootDir}/components/ChildScene.xml`), `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="ChildScene" extends="ParentScene">
                    <script type="text/brightscript" uri="ChildScene.brs" />
                </component>
            `);
            await program.addOrReplaceFile(`${rootDir}/components/ChildScene.brs`, `
                sub Init()
                    DoParentThing()
                end sub
            `);

            await program.validate();

            //there should be an error when calling DoParentThing, since it doesn't exist on child or parent
            expect(program.getDiagnostics()).to.be.lengthOf(1);
            expect(program.getDiagnostics()[0]).to.deep.include(<Diagnostic>{
                message: util.stringFormat(diagnosticMessages.Cannot_find_function_name_1001.message, 'DoParentThing')
            });

            //add the script into the parent
            await program.addOrReplaceFile(n(`${rootDir}/components/ParentScene.xml`), `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="ParentScene" extends="Scene">
                    <script type="text/brightscript" uri="ParentScene.brs" />
                </component>
            `);

            await program.addOrReplaceFile(`${rootDir}/components/ParentScene.brs`, `
                sub DoParentThing()

                end sub
            `);

            await program.validate();
            //the error should be gone because the child now has access to the parent script
            expect(program.getDiagnostics()).to.be.lengthOf(0);
        });
    });
});