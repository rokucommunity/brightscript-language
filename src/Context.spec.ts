import * as path from 'path';
import * as sinonImport from 'sinon';

import { Program } from './Program';
import { BrsFile } from './files/BrsFile';
import { expect } from 'chai';
import { Context as Context } from './Context';
import { diagnosticMessages } from './DiagnosticMessages';
import util from './util';
import { EventEmitter } from 'events';
let n = path.normalize;

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

    describe('attachProgram', () => {
        it('correctly listens to program events', async () => {
            var context = new Context('some context', (file) => true);

            let file = new BrsFile(n('abs/file.brs'), n('rel/file.brs'));

            //we're only testing events, so make this emitter look like a program
            var program = new EventEmitter();
            (program as any).files = {};

            //attach the program (and therefore to the program's events)
            context.attachProgram(program as any);

            expect(context.hasFile(file)).to.be.false;

            //"add" a file. context should keep it
            program.emit('file-added', file);
            expect(context.hasFile(file)).to.be.true;

            //"remove" a file. context should discard it
            program.emit('file-removed', file);
            expect(context.hasFile(file)).to.be.false;
        });
    });

    describe('attachParentContext', () => {
        it('listens for invalidated events', async () => {
            var parentCtx = new Context('parent', null);
            parentCtx.isValidated = false;

            var childCtx = new Context('child', null);
            childCtx.isValidated = true;

            //attaching child to invalidated parent invalidates child
            childCtx.attachParentContext(parentCtx);
            expect(childCtx.isValidated).to.be.false;

            childCtx.isValidated = true;

            //when parent emits invalidated, child marks as invalidated
            (parentCtx as any).emit('invalidated');
            expect(childCtx.isValidated).to.be.false;
        });
    });

    describe('addFile', () => {
        it('picks up new callables', async () => {
            //we have global callables, so get that initial number
            let originalLength = context.getCallables().length;
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function

                 function DoA()
                     print "A"
                 end function
            `);
            context.addOrReplaceFile(file);
            expect(context.getCallables().length).to.equal(originalLength + 2);
        });
    });

    describe('removeFile', () => {
        it('removes callables from list', async () => {
            let initCallableCount = context.getCallables().length;
            //add the file
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function
            `);
            context.addOrReplaceFile(file);
            expect(context.getCallables().length).to.equal(initCallableCount + 1);

            //remove the file
            context.removeFile(file);
            expect(context.getCallables().length).to.equal(initCallableCount);
        });
    });

    describe('validate', () => {
        it('detects duplicate callables', async () => {
            expect(context.getDiagnostics().length).to.equal(0);
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function

                 function DoA()
                     print "A"
                 end function
            `);
            context.addOrReplaceFile(file);
            expect(
                context.getDiagnostics().length
            ).to.equal(0);
            //validate the context
            context.validate();
            //we should have the "DoA declared more than once" error twice (one for each function named "DoA")
            expect(context.getDiagnostics().length).to.equal(2);
        });

        it('detects calls to unknown callables', async () => {
            expect(context.getDiagnostics().length).to.equal(0);
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    DoB()
                end function
            `);
            context.addOrReplaceFile(file);
            expect(context.getDiagnostics().length).to.equal(0);
            //validate the context
            context.validate();
            //we should have the "DoA declared more than once" error twice (one for each function named "DoA")
            expect(context.getDiagnostics().length).to.equal(1);
            expect(context.getDiagnostics()[0]).to.deep.include({
                message: util.stringFormat(diagnosticMessages.Cannot_find_function_name_1001.message, 'DoB'),
                code: diagnosticMessages.Cannot_find_function_name_1001.code
            });
        });

        it('recognizes known callables', async () => {
            expect(context.getDiagnostics().length).to.equal(0);
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    DoB()
                end function
                function DoB()
                    DoC()
                end function
            `);
            context.addOrReplaceFile(file);
            expect(context.getDiagnostics().length).to.equal(0);
            //validate the context
            context.validate();
            expect(context.getDiagnostics().length).to.equal(1);
            expect(context.getDiagnostics()[0]).to.deep.include({
                message: util.stringFormat(diagnosticMessages.Cannot_find_function_name_1001.message, 'DoC'),
                code: diagnosticMessages.Cannot_find_function_name_1001.code
            });
        });

        //We don't currently support someObj.callSomething() format, so don't throw errors on those
        it('does not fail on object callables', async () => {
            expect(context.getDiagnostics().length).to.equal(0);
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoB()
                    m.doSomething()
                end function
            `);
            context.addOrReplaceFile(file);
            //validate the context
            context.validate();
            //shouldn't have any errors
            expect(context.getDiagnostics().length).to.equal(0);
        });

        it('detects calling functions with too many parameters', async () => {
            //sanity check
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a()
                end sub
                sub b()
                    a(1)
                end sub
            `);
            context.addOrReplaceFile(file);
            context.validate();
            //should have an error
            expect(context.getDiagnostics().length).to.equal(1);
            expect(context.getDiagnostics()[0]).to.deep.include({
                message: util.stringFormat(diagnosticMessages.Expected_a_arguments_but_got_b_1002.message, 0, 1),
                code: diagnosticMessages.Expected_a_arguments_but_got_b_1002.code
            });
        });

        it('detects calling functions with too many parameters', async () => {
            //sanity check
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a(name)
                end sub
                sub b()
                    a()
                end sub
            `);
            context.addOrReplaceFile(file);
            context.validate();
            //should have an error
            expect(context.getDiagnostics().length).to.equal(1);
            expect(context.getDiagnostics()[0]).to.deep.include({
                message: util.stringFormat(diagnosticMessages.Expected_a_arguments_but_got_b_1002.message, 1, 0),
                code: diagnosticMessages.Expected_a_arguments_but_got_b_1002.code
            });
        });

        it('allows skipping optional parameter', async () => {
            //sanity check
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a(name="Bob")
                end sub
                sub b()
                    a()
                end sub
            `);
            context.addOrReplaceFile(file);
            context.validate();
            //should have an error
            expect(context.getDiagnostics().length).to.equal(0);
        });

        it('shows expected parameter range in error message', async () => {
            //sanity check
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a(age, name="Bob")
                end sub
                sub b()
                    a()
                end sub
            `);
            context.addOrReplaceFile(file);
            context.validate();
            //should have an error
            expect(context.getDiagnostics().length).to.equal(1);
            expect(context.getDiagnostics()[0]).to.deep.include({
                message: util.stringFormat(diagnosticMessages.Expected_a_arguments_but_got_b_1002.message, '1-2', 0),
                code: diagnosticMessages.Expected_a_arguments_but_got_b_1002.code
            });
        });

        it('handles expressions as arguments to a function', async () => {
            //sanity check
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a(age, name="Bob")
                end sub
                sub b()
                    a("cat" + "dog" + "mouse")
                end sub
            `);
            context.addOrReplaceFile(file);
            context.validate();
            //should have an error
            expect(context.getDiagnostics().length).to.equal(0);
        });

        it('Catches extra arguments for expressions as arguments to a function', async () => {
            //sanity check
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub a(age)
                end sub
                sub b()
                    a(m.lib.movies[0], 1)
                end sub
            `);
            context.addOrReplaceFile(file);
            context.validate();
            //should have an error
            expect(context.getDiagnostics().length).to.equal(1);
            expect(context.getDiagnostics()[0]).to.deep.include({
                message: util.stringFormat(diagnosticMessages.Expected_a_arguments_but_got_b_1002.message, 1, 2),
                code: diagnosticMessages.Expected_a_arguments_but_got_b_1002.code
            });
        });
    });

    describe('inheritance', () => {
        it('inherits callables from parent', () => {
            var program = new Program({ rootDir });
            //erase the platform context so our tests are more stable
            program.platformContext = new Context('platform', null);

            let parentFile = new BrsFile('parentFile.brs', 'parentFile.brs');
            parentFile.callables.push(<any>{
                name: 'parentFunction'
            });
            var parentContext = new Context('parent', null);
            parentContext.attachProgram(program);
            parentContext.addOrReplaceFile(parentFile);

            var childContext = new Context('child', null);
            childContext.attachProgram(program);
            expect(childContext.getCallables()).to.be.lengthOf(0);

            childContext.attachParentContext(parentContext);

            //now that we attached the parent, the child should recognize the parent's callables
            expect(childContext.getCallables()).to.be.lengthOf(1);
            expect(childContext.getCallables()[0].name).to.equal('parentFunction');

            //removes parent callables when parent is detached
            childContext.detachParent();
            expect(childContext.getCallables()).to.be.lengthOf(0);
        });
    });
});