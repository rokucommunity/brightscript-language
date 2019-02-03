import * as path from 'path';
import * as sinonImport from 'sinon';
let sinon = sinonImport.createSandbox();

import { Program } from '../Program';
import { BrsFile } from './BrsFile';
import { expect, assert } from 'chai';
import { CallableArg, Diagnostic, Callable, ExpressionCall } from '../interfaces';
import util from '../util';

describe('BrsFile', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {
        it('finds line and column numbers for functions', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function

                 function DoB()
                     print "B"
                 end function
            `);
            expect(file.callables[0].name).to.equal('DoA');
            expect(file.callables[0].lineIndex).to.equal(1);
            expect(file.callables[0].columnIndexBegin).to.equal(25)
            expect(file.callables[0].columnIndexEnd).to.equal(28)

            expect(file.callables[1].name).to.equal('DoB');
            expect(file.callables[1].lineIndex).to.equal(5);
            expect(file.callables[1].columnIndexBegin).to.equal(26)
            expect(file.callables[1].columnIndexEnd).to.equal(29)
        });

        it('throws an error if the file has already been parsed', async () => {
            let file = new BrsFile('abspath', 'relpath');
            file.parse(`'a comment`);
            try {
                await file.parse(`'a new comment`);
                assert.fail(null, null, 'Should have thrown an exception, but did not');
            } catch (e) {
                //test passes
            }
        });

        it('loads file contents from disk when necessary', async () => {
            let stub = sinon.stub(util, 'getFileContents').returns(Promise.resolve(''));
            expect(stub.called).to.be.false;

            let file = new BrsFile('abspath', 'relpath');
            file.parse();
            expect(stub.called).to.be.true;

        });

        it('finds and registers duplicate callables', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    print "A"
                end function

                 function DoA()
                     print "A"
                 end function
            `);
            expect(file.callables.length).to.equal(2);
            expect(file.callables[0].name).to.equal('DoA');
            expect(file.callables[0].lineIndex).to.equal(1);

            expect(file.callables[1].name).to.equal('DoA');
            expect(file.callables[1].lineIndex).to.equal(5);
        });

        it('finds function call line and column numbers', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoA()
                    DoB()
                end function
                function DoB()
                     DoC()
                end function
            `);
            expect(file.expressionCalls.length).to.equal(2);

            expect(file.expressionCalls[0].lineIndex).to.equal(2);
            expect(file.expressionCalls[0].columnIndexBegin).to.equal(20);
            expect(file.expressionCalls[0].columnIndexEnd).to.equal(23);

            expect(file.expressionCalls[1].lineIndex).to.equal(5);
            expect(file.expressionCalls[1].columnIndexBegin).to.equal(21);
            expect(file.expressionCalls[1].columnIndexEnd).to.equal(24);
        });

        it('sanitizes brs errors', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoSomething
                end function            
            `);
            expect(file.diagnostics.length).to.be.greaterThan(0);
            expect(file.diagnostics[0]).to.deep.include({
                lineIndex: 1,
                columnIndexBegin: 0,
                columnIndexEnd: Number.MAX_VALUE,
                file: file
            });
        });

        it.skip('supports using the `next` keyword in a for loop', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub countit()
                    for each num in [1,2,3]
                        print num
                    next
                end sub
            `);
            expect(file.diagnostics).to.be.empty;
        });

        //test is not working yet, but will be enabled when brs supports this syntax
        it('supports assigning functions to objects', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function main()
                    o = CreateObject("roAssociativeArray")
                    o.sayHello = sub()
                        print "hello"
                    end sub
                end function
            `);
            expect(file.diagnostics.length).to.equal(0);
        });
    });

    describe('findCallables', () => {
        it('finds callable parameters', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function Sum(a, b, c)
                    
                end function
            `);
            let callable = file.callables[0];
            expect(callable.params[0]).to.deep.include({
                name: 'a',
                type: 'dynamic',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[1]).to.deep.include({
                name: 'b',
                type: 'dynamic',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[2]).to.deep.include({
                name: 'c',
                type: 'dynamic',
                isOptional: false,
                isRestArgument: false
            });
        });

        it('finds optional parameters', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function Sum(a=2)
                    
                end function
            `);
            let callable = file.callables[0];
            expect(callable.params[0]).to.deep.include({
                name: 'a',
                type: 'dynamic',
                isOptional: true,
                isRestArgument: false
            });
        });

        it('finds parameter types', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function Sum(a, b as integer, c as string)
                    
                end function
            `);
            let callable = file.callables[0];
            expect(callable.params[0]).to.deep.include({
                name: 'a',
                type: 'dynamic',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[1]).to.deep.include({
                name: 'b',
                type: 'integer',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[2]).to.deep.include({
                name: 'c',
                type: 'string',
                isOptional: false,
                isRestArgument: false
            });
        });
    });

    describe('findCallableInvocations', () => {
        it('finds arguments with literal values', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function Sum()
                    DoSomething("name", 12, true)
                end function
            `);
            expect(file.expressionCalls.length).to.equal(1);
            let args = file.expressionCalls[0].args;
            expect(args.length).to.equal(3);
            expect(args[0]).deep.include(<CallableArg>{
                type: 'string',
                text: '"name"'
            });
            expect(args[1]).deep.include(<CallableArg>{
                type: 'integer',
                text: '12'
            });
            expect(args[2]).deep.include(<CallableArg>{
                type: 'boolean',
                text: 'true'
            });
        });

        it('finds arguments with variable values', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function Sum()
                    count = 1
                    name = "John"
                    isAlive = true
                    DoSomething(count, name, isAlive)
                end function
            `);
            expect(file.expressionCalls.length).to.equal(1);
            expect(file.expressionCalls[0].args[0]).deep.include(<CallableArg>{
                type: 'dynamic',
                text: 'count'
            });
            expect(file.expressionCalls[0].args[1]).deep.include(<CallableArg>{
                type: 'dynamic',
                text: 'name'
            });
            expect(file.expressionCalls[0].args[2]).deep.include(<CallableArg>{
                type: 'dynamic',
                text: 'isAlive'
            });
        });
    });

    describe('standardizeLexParserErrors', () => {
        it('still works if no line number was detected in the message', () => {
            let file = new BrsFile('', '');
            expect(file.standardizeLexParseErrors([{
                message: 'some lex error',
                stack: ''
            }], [])).to.eql([<Diagnostic>{
                code: 1000,
                message: 'some lex error',
                lineIndex: 0,
                columnIndexBegin: 0,
                columnIndexEnd: Number.MAX_VALUE,
                file: file,
                severity: 'error'
            }]);
        });
    });

    describe('findCallables', () => {
        //this test is to help with code coverage
        it('skips top-level statements', async () => {
            let file = new BrsFile('absolute', 'relative');
            await file.parse('name = "Bob"');
            expect(file.callables.length).to.equal(0);
        });

        it(`falls back to defaults when the regex doesn't find a match on the line`, async () => {
            let file = new BrsFile('absolute', 'relative');
            await file.parse('function DoSomething()\nend function');
            (file as any).findCallables(['asdf']);
            expect(file.callables[0]).to.deep.include(<Callable>{
                file: file,
                lineIndex: 0,
                columnIndexBegin: 0,
                columnIndexEnd: 3,
                returnType: 'dynamic',
                type: 'function',
                name: 'DoSomething',
                params: []
            });
        });

        it(`finds return type from regex`, async () => {
            let file = new BrsFile('absolute', 'relative');
            await file.parse('function DoSomething() as string\nend function');
            (file as any).findCallables(['function DoSomething() as string\nend function']);
            expect(file.callables[0]).to.deep.include(<Callable>{
                file: file,
                lineIndex: 0,
                columnIndexBegin: 9,
                columnIndexEnd: 20,
                returnType: 'string',
                type: 'function',
                name: 'DoSomething',
                params: []
            });
        });
    });

    describe('getCompletions', () => {
        it('returns empty set when out of range', async () => {
            let file = new BrsFile('abs', 'rel');
            await file.parse('');
            expect(file.getCompletions(99, 99)).to.be.empty;
        });
    });

    describe('findCallableInvocations', () => {
        /**
         * There's always a chance the regex is incorrect. 
         * So ensure the code falls back to full line if regex does not find a match
         */
        it('handles not finding a regex match from the line', async () => {
            let file = new BrsFile('abs', 'rel');
            await file.parse(`
                function Main()
                    Wait(10)
                end function
            `);
            file.expressionCalls = [];
            //send an unknown line (not sure how this would happen.)
            (file as any).findCallableInvocations([
                '',
                'function Main()',
                '   Nada(10)',
                'end function'
            ]);
            expect(file.expressionCalls[0]).to.deep.include(<ExpressionCall>{
                args: [{
                    type: 'integer',
                    text: '10'
                }],
                columnIndexBegin: 0,
                columnIndexEnd: Number.MAX_VALUE,
                lineIndex: 2,
                name: 'Wait'
            });
        });

        it('prevents false positives on multiple functions on a line', async () => {
            let file = new BrsFile('abs', 'rel');
            await file.parse(`
                function Main()
                    Wait(10)
                end function
            `);
            file.expressionCalls = [];
            //send an unknown line (not sure how this would happen.)
            (file as any).findCallableInvocations(util.getLines(`
                function Main()
                    SomeCall(DontWait(10), Wait(10))
                end function
            `));
            expect(file.expressionCalls[0]).to.deep.include(<ExpressionCall>{
                columnIndexBegin: 43,
                columnIndexEnd: 47,
                lineIndex: 2,
                name: 'Wait'
            });
        });
    });

});