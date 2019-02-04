import * as path from 'path';
import * as sinonImport from 'sinon';

import { expect, assert } from 'chai';
import { Program } from './Program';
import { Diagnostic } from './interfaces';
import { diagnosticMessages } from './DiagnosticMessages';
import { CompletionItemKind, Position } from 'vscode-languageserver';

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
            await program.loadOrReloadFile('source/lib.brs', 'function main()\n    print "hello world"\nend function');
            // await program.reloadFile('source/lib.brs', `'this is a comment`);
            //if we made it to here, nothing exploded, so the test passes
        });

        it('adds files in the source folder to the global context', async () => {
            expect(program.contexts['global']).to.exist;
            //no files in global context
            expect(Object.keys(program.contexts['global'].files).length).to.equal(0);

            let mainPath = path.normalize(`${rootDir}/source/main.brs`);
            //add a new source file
            await program.loadOrReloadFile(mainPath, '');
            //file should be in global context now
            expect(program.contexts['global'].files[mainPath]).to.exist;

            //add an unreferenced file from the components folder
            await program.loadOrReloadFile(`${rootDir}/components/component1/component1.brs`, '');
            //global context should have the same number of files
            expect(program.contexts['global'].files[mainPath]).to.exist;
            expect(program.contexts['global'].files[`${rootDir}/components/component1/component1.brs`]).not.to.exist;
        });

        it('normalizes file paths', async () => {
            let filePath = `${rootDir}/source\\main.brs`
            await program.loadOrReloadFile(filePath, '')
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
        it('catches duplicate methods in single file', async () => {
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.errors.length).to.equal(2);
            expect(program.errors[0].message.indexOf('Duplicate sub declaration'))
        });

        it('catches duplicate methods across multiple files', async () => {
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
            `);
            await program.loadOrReloadFile(`${rootDir}/source/lib.brs`, `
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.errors.length).to.equal(2);
            expect(program.errors[0].message.indexOf('Duplicate sub declaration'))
        });

        it('maintains correct callables list', async () => {
            let initialCallableCount = program.contexts['global'].callables.length;
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
            `);
            expect(program.contexts['global'].callables.length).equals(initialCallableCount + 2);
            //set the file contents again (resetting the wasProcessed flag)
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
                `);
            expect(program.contexts['global'].callables.length).equals(initialCallableCount + 2);
            program.removeFile(`${rootDir}/source/main.brs`);
            expect(program.contexts['global'].callables.length).equals(initialCallableCount);
        });

        it('resets errors on revalidate', async () => {
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.errors.length).to.equal(2);
            //set the file contents again (resetting the wasProcessed flag)
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.errors.length).to.equal(2);

            //load in a valid file, the errors should go to zero
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub DoSomething()
                end sub
            `);
            await program.validate();
            expect(program.errors.length).to.equal(0);
        });

        it('identifies invocation of unknown callable', async () => {
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    name = "Hello"
                    DoSomething(name) ' call a function that doesn't exist
                end sub
            `);

            await program.validate();
            expect(program.errors.length).to.equal(1);
            expect(program.errors[0].message.toLowerCase().indexOf('cannot find name')).to.equal(0);
        });

        it('detects methods from another file in a subdirectory', async () => {
            await program.loadOrReloadFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    DoSomething()
                end sub
            `);
            await program.loadOrReloadFile(`${rootDir}/source/ui/lib.brs`, `
                function DoSomething()
                    print "hello world"
                end function
            `);
            await program.validate();
            expect(program.errors.length).to.equal(0);
        });
    });

    describe('hasFile', () => {
        it('recognizes when it has a file loaded', async () => {
            expect(program.hasFile('file1.brs')).to.be.false;
            await program.loadOrReloadFile('file1.brs', `'comment`);
            expect(program.hasFile('file1.brs')).to.be.true;
        });
    });

    describe('loadOrReloadFile', async () => {
        it('creates a new context for every added component xml', async () => {
            //we have global callables, so get that initial number
            await program.loadOrReloadFile(`${rootDir}/components/component1.xml`, '');
            expect(program.contexts).to.have.property(`components${path.sep}component1.xml`);

            await program.loadOrReloadFile(`${rootDir}/components/component1.xml`, '');
            await program.loadOrReloadFile(`${rootDir}/components/component2.xml`, '');
            expect(program.contexts).to.have.property(`components${path.sep}component1.xml`);
            expect(program.contexts).to.have.property(`components${path.sep}component2.xml`);
        });

        it('includes referenced files in xml contexts', async () => {
            let xmlPath = path.resolve(`${rootDir}/components/component1.xml`);
            await program.loadOrReloadFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);
            let brsPath = path.resolve(`${rootDir}/components/component1.brs`);
            await program.loadOrReloadFile(brsPath, '');

            let context = program.contexts[`components${path.sep}component1.xml`];
            expect(context.files[xmlPath].file.pkgPath).to.equal(`components${path.sep}component1.xml`);
            expect(context.files[brsPath].file.pkgPath).to.equal(`components${path.sep}component1.brs`);
        });

        it('adds xml file to files map', async () => {
            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            await program.loadOrReloadFile(xmlPath, '');
            expect(program.files[xmlPath]).to.exist;
        });

        it('detects missing script reference', async () => {
            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            await program.loadOrReloadFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);
            await program.validate();
            expect(program.errors.length).to.equal(1);
            expect(program.errors[0]).to.deep.include(<Diagnostic>{
                file: program.files[xmlPath],
                lineIndex: 3,
                columnIndexBegin: 58,
                columnIndexEnd: 88,
                message: diagnosticMessages.Referenced_file_does_not_exist_1004.message,
                code: diagnosticMessages.Referenced_file_does_not_exist_1004.code,
                severity: 'error'
            });
        });
    });

    describe('reloadFile', () => {
        it('picks up new files in a context when an xml file is loaded', async () => {
            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            await program.loadOrReloadFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);
            await program.validate();
            expect(program.errors[0]).to.deep.include(<Diagnostic>{
                message: diagnosticMessages.Referenced_file_does_not_exist_1004.message
            });

            //add the file, the error should go away
            let brsPath = path.normalize(`${rootDir}/components/component1.brs`);
            await program.loadOrReloadFile(brsPath, '');
            program.validate();
            expect(program.errors).to.be.empty;

            //add the xml file back in, but change the component brs file name. Should have an error again
            await program.loadOrReloadFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component2.brs" />
                </component>
            `);
            program.validate();
            expect(program.errors[0]).to.deep.include(<Diagnostic>{
                message: diagnosticMessages.Referenced_file_does_not_exist_1004.message
            });
        });

        it('handles when the brs file is added before the component', async () => {
            let brsPath = path.normalize(`${rootDir}/components/component1.brs`);
            let brsFile = await program.loadOrReloadFile(brsPath, '');

            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            let xmlFile = await program.loadOrReloadFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="pkg:/components/component1.brs" />
                </component>
            `);
            await program.validate();
            expect(program.errors).to.be.empty;
            expect(program.contexts[xmlFile.pkgPath].files[brsPath]).to.exist;
        });

        it('reloads referenced fles when xml file changes', async () => {
            let brsPath = path.normalize(`${rootDir}/components/component1.brs`);
            let brsFile = await program.loadOrReloadFile(brsPath, '');

            let xmlPath = path.normalize(`${rootDir}/components/component1.xml`);
            let xmlFile = await program.loadOrReloadFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    
                </component>
            `);
            await program.validate();
            expect(program.errors).to.be.empty;
            expect(program.contexts[xmlFile.pkgPath].files[brsPath]).not.to.exist;

            //reload the xml file contents, adding a new script reference.
            xmlFile = await program.loadOrReloadFile(xmlPath, `
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
            let xmlFile = await program.loadOrReloadFile(xmlPath, `
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="HeroScene" extends="Scene" >');
                    <script type="text/brightscript" uri="" />
                </component>
            `);
            let brsPath = path.normalize(`${rootDir}/components/component1.brs`);
            await program.loadOrReloadFile(brsPath, '');
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
});