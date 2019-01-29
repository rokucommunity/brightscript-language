import * as path from 'path';
import * as sinonImport from 'sinon';

import { BRSProgram } from './BRSProgram';
import { BRSFile } from './BRSFile';
import { expect } from 'chai';
import { BRSContext } from './BRSContext';

describe('BRSContext', () => {
    let sinon = sinonImport.createSandbox();
    let rootDir = 'C:/projects/RokuApp';
    let context: BRSContext;
    beforeEach(() => {
        context = new BRSContext('root', () => { });
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('addFile', () => {
        it('picks up new callables', async () => {
            //we have global callables, so get that initial number
            let originalLength = context.callables.length;
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function

                 function DoA()
                     print "A"
                 end function
            `);
            context.addFile(file);
            expect(context.callables.length).to.equal(originalLength + 2);
        });
    });

    describe('removeFile', () => {
        it('removes callables from list', async () => {
            let initCallableCount = context.callables.length;
            //add the file
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function
            `);
            context.addFile(file);
            expect(context.callables.length).to.equal(initCallableCount + 1);

            //remove the file
            context.removeFile(file);
            expect(context.callables.length).to.equal(initCallableCount);
        });
    });

    describe('validate', () => {
        it('detects duplicate callables', async () => {
            expect(context.diagnostics.length).to.equal(0);
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function

                 function DoA()
                     print "A"
                 end function
            `);
            context.addFile(file);
            expect(context.diagnostics.length).to.equal(0);
            //validate the context
            context.validate();
            //we should have the "DoA declared more than once" error twice (one for each function named "DoA")
            expect(context.diagnostics.length).to.equal(2);
        });

        it('detects calls to unknown callables', async () => {
            expect(context.diagnostics.length).to.equal(0);
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    DoB()
                end function
            `);
            context.addFile(file);
            expect(context.diagnostics.length).to.equal(0);
            //validate the context
            context.validate();
            //we should have the "DoA declared more than once" error twice (one for each function named "DoA")
            expect(context.diagnostics.length).to.equal(1);
            expect(context.diagnostics[0].message).equals(`Cannot find name 'DoB'`);
        });

        it('recognizes known callables', async () => {
            expect(context.diagnostics.length).to.equal(0);
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    DoB()
                end function
                function DoB()
                    DoC()
                end function
            `);
            context.addFile(file);
            expect(context.diagnostics.length).to.equal(0);
            //validate the context
            context.validate();
            //we should have the "DoA declared more than once" error twice (one for each function named "DoA")
            expect(context.diagnostics.length).to.equal(1);
            expect(context.diagnostics[0].message).equals(`Cannot find name 'DoC'`);
        });

        //We don't currently support someObj.callSomething() format, so don't throw errors on those
        it('does not fail on object callables', async () => {
            expect(context.diagnostics.length).to.equal(0);
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoB()
                    m.doSomething()
                end function
            `);
            context.addFile(file);
            //validate the context
            context.validate();
            //shouldn't have any errors
            expect(context.diagnostics.length).to.equal(0);
        });

        it('recognizes global functions', async () => {
            expect(context.diagnostics.length).to.equal(0);
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoB()
                    abs(1.5)
                end function
            `);
            context.addFile(file);
            //validate the context
            context.validate();
            //shouldn't have any errors
            expect(context.diagnostics.length).to.equal(0);
        });
    });
});