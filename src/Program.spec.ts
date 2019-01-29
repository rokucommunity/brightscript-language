import * as path from 'path';
import * as sinonImport from 'sinon';

import { expect, assert } from 'chai';
import { Program } from './Program';

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
    });

    describe('hasFile', ()=>{
        it('recognizes when it has a file loaded', async ()=>{
            expect(program.hasFile('file1.brs')).to.be.false;
            await program.loadOrReloadFile('file1.brs', `'comment`);
            expect(program.hasFile('file1.brs')).to.be.true;
        });
    });
});