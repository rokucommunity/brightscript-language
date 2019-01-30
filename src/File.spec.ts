import * as path from 'path';
import * as sinonImport from 'sinon';

import { Program } from './Program';
import { File } from './File';
import { expect } from 'chai';
import { CallableArg } from './interfaces';

describe('File', () => {

    let sinon = sinonImport.createSandbox();
    beforeEach(() => {
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {
        it('finds line and column numbers for functions', async () => {
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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

        it('finds and registers duplicate callables', async () => {
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                function DoSomething
                end function            
            `);
            expect(file.diagnostics.length).to.be.greaterThan(0);
            expect(file.diagnostics[0].columnIndexBegin).to.equal(0);
            expect(file.diagnostics[0].columnIndexEnd).to.equal(36);
            expect(file.diagnostics[0].lineIndex).to.equal(1);
            expect(file.diagnostics[0].file.pathAbsolute).to.equal('absolute_path/file.brs');
        });

        //test is not working yet, but will be enabled when brs supports this syntax
        it.skip('supports assigning functions to objects', async () => {
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new File('absolute_path/file.brs', 'relative_path/file.brs');
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

});