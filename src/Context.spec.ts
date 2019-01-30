import * as path from 'path';
import * as sinonImport from 'sinon';

import { Program } from './Program';
import { File } from './File';
import { expect } from 'chai';
import { Context as Context } from './Context';

describe('Context', () => {
    let sinon = sinonImport.createSandbox();
    let rootDir = 'C:/projects/RokuApp';
    let context: Context;
    beforeEach(() => {
        context = new Context('root', () => { });
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('addFile', () => {
        it('picks up new callables', async () => {
            //we have global callables, so get that initial number
            let originalLength = context.callables.length;
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            expect(context.diagnostics[0].message).equals(`Cannot find name 'DoB'. [1001]`);
        });

        it('recognizes known callables', async () => {
            expect(context.diagnostics.length).to.equal(0);
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            expect(context.diagnostics[0].message).equals(`Cannot find name 'DoC'. [1001]`);
        });

        //We don't currently support someObj.callSomething() format, so don't throw errors on those
        it('does not fail on object callables', async () => {
            expect(context.diagnostics.length).to.equal(0);
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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

        it('detects calling functions with too many parameters', async () => {
            //sanity check
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a()
                end sub
                sub b()
                    a(1)
                end sub
            `);
            context.addFile(file);
            context.validate();
            //should have an error
            expect(context.diagnostics.length).to.equal(1);
            expect(context.diagnostics[0].message).to.equal('Expected 0 arguments, but got 1. [1002]');
        });

        it('detects calling functions with too many parameters', async () => {
            //sanity check
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a(name)
                end sub
                sub b()
                    a()
                end sub
            `);
            context.addFile(file);
            context.validate();
            //should have an error
            expect(context.diagnostics.length).to.equal(1);
            expect(context.diagnostics[0].message).to.equal('Expected 1 arguments, but got 0. [1002]');
        });

        it('allows skipping optional parameter', async () => {
            //sanity check
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a(name="Bob")
                end sub
                sub b()
                    a()
                end sub
            `);
            context.addFile(file);
            context.validate();
            //should have an error
            expect(context.diagnostics.length).to.equal(0);
        });

        it('shows expected parameter range in error message', async () => {
            //sanity check
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a(age, name="Bob")
                end sub
                sub b()
                    a()
                end sub
            `);
            context.addFile(file);
            context.validate();
            //should have an error
            expect(context.diagnostics.length).to.equal(1);
            expect(context.diagnostics[0].message).to.equal('Expected 1-2 arguments, but got 0. [1002]');
        });
    });
});