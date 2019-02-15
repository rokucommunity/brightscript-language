import * as sinonImport from 'sinon';
let sinon = sinonImport.createSandbox();

import { BrsFile } from './BrsFile';
import { expect, assert } from 'chai';
import { CallableArg, Diagnostic, Callable, ExpressionCall, VariableDeclaration } from '../interfaces';
import util from '../util';
import { Range, Position, CompletionItemKind } from 'vscode-languageserver';

describe('BrsFile', () => {
    let file: BrsFile;
    beforeEach(() => {
        file = new BrsFile('abs', 'rel');
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {
        it('succeeds when finding variables with "sub" in them', async () => {
            await file.parse(`
                function DoSomething()
                    return value.subType()
                end function
            `);
            expect(file.callables[0]).to.deep.include({
                bodyRange: Range.create(2, 0, 3, 16),
                file: file,
                nameRange: Range.create(1, 25, 1, 36)
            });
        });

        it('succeeds when finding variables with the word "function" in them', async () => {
            await file.parse(`
                function Test()
                    typeCheckFunction = RBS_CMN_GetFunction(invalid, methodName)
                end function
            `);
        });

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
            expect(file.callables[0].nameRange).to.eql(Range.create(1, 25, 1, 28));

            expect(file.callables[1].name).to.equal('DoB');
            expect(file.callables[1].nameRange).to.eql(Range.create(5, 26, 5, 29));
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
            expect(file.callables[0].nameRange.start.line).to.equal(1);

            expect(file.callables[1].name).to.equal('DoA');
            expect(file.callables[1].nameRange.start.line).to.equal(5);
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
            expect(file.getDiagnostics().length).to.be.greaterThan(0);
            expect(file.getDiagnostics()[0]).to.deep.include({
                file: file
            });
            expect(file.getDiagnostics()[0].location.start.line).to.equal(1);
        });

        it('supports using the `next` keyword in a for loop', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub countit()
                    for each num in [1,2,3]
                        print num
                    next
                end sub
            `);
            console.error(file.getDiagnostics());
            expect(file.getDiagnostics()).to.be.empty;
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
            expect(file.getDiagnostics().length).to.equal(0);
        });
    });

    describe('findCallables', () => {
        it('finds body range', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub Sum()
                    print "hello world"
                end sub
            `);
            let callable = file.callables[0];
            expect(callable.bodyRange).to.eql(Range.create(2, 0, 3, 16));
        });

        it('finds correct body range even with inner function', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs');
            await file.parse(`
                sub Sum()
                    sayHi = sub()
                        print "Hi"
                    end sub
                    sayHi()
                end sub
            `);
            let callable = file.callables[0];
            expect(callable.bodyRange).to.eql(Range.create(2, 0, 6, 16));
        });

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
        it('properly maps the location to a Range', () => {
            let file = new BrsFile('', '');
            expect(file.standardizeLexParseErrors([<any>{
                location: {
                    start: {
                        column: 0,
                        line: 1
                    }, end: {
                        column: 4,
                        line: 2
                    },
                    file: ''
                },
                message: 'some lex error',
                stack: ''
            }], [])).to.eql([<Diagnostic>{
                code: 1000,
                message: 'some lex error',
                location: Range.create(0, 0, 1, 4),
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

        it(`finds return type from regex`, async () => {
            let file = new BrsFile('absolute', 'relative');
            await file.parse(`
                function DoSomething() as string
                end function
            `);
            expect(file.callables[0]).to.deep.include(<Callable>{
                file: file,
                //there's a bug in the brs code computing function line numbers. TODO enable this when the bug is fixed
                // nameRange: Range.create(1, 25, 0, 36),
                returnType: 'string',
                type: 'function',
                name: 'DoSomething',
                params: []
            });
        });
    });

    describe('createFunctionScopes', async () => {
        it('creates scopes for parent and child functions', async () => {
            await file.parse(`
                sub Main()
                    sayHi = sub()
                        print "hi"
                    end sub

                    scheduleJob(sub()
                        print "job completed"
                    end sub)
                end sub
            `);
            expect(file.functionScopes).to.length(3);
        });

        it('finds variables declared in function scopes', async () => {
            await file.parse(`
                sub Main()
                    sayHi = sub()
                        age = 12
                    end sub

                    scheduleJob(sub()
                        name = "bob"
                    end sub)
                end sub
            `);
            expect(file.functionScopes[0].variableDeclarations).to.be.length(1);
            expect(file.functionScopes[0].variableDeclarations[0]).to.eql(<VariableDeclaration>{
                lineIndex: 2,
                name: 'sayHi',
                type: 'function'
            });

            expect(file.functionScopes[1].variableDeclarations).to.be.length(1);
            expect(file.functionScopes[1].variableDeclarations[0]).to.eql(<VariableDeclaration>{
                lineIndex: 3,
                name: 'age',
                type: 'integer'
            });

            expect(file.functionScopes[2].variableDeclarations).to.be.length(1);
            expect(file.functionScopes[2].variableDeclarations[0]).to.eql(<VariableDeclaration>{
                lineIndex: 7,
                name: 'name',
                type: 'string'
            });
        });

        it('finds value from global return', async () => {
            await file.parse(`
                sub Main()
                   myName = GetName()
                end sub

                function GetName() as string
                    return "bob"
                end function
            `);

            expect(file.functionScopes[0].variableDeclarations).to.be.length(1);
            expect(file.functionScopes[0].variableDeclarations[0]).to.eql(<VariableDeclaration>{
                lineIndex: 2,
                name: 'myName',
                type: 'string'
            });
        });

        it('finds variable type from other variable', async () => {
            await file.parse(`
                sub Main()
                   name = "bob"
                   nameCopy = name
                end sub
            `);

            expect(file.functionScopes[0].variableDeclarations).to.be.length(2);
            expect(file.functionScopes[0].variableDeclarations[1]).to.eql(<VariableDeclaration>{
                lineIndex: 3,
                name: 'nameCopy',
                type: 'string'
            });
        });

        it('sets proper range for functions', async () => {
            await file.parse(`
                sub Main()
                    getName = function()
                        return "bob"
                    end function
                end sub
            `);

            expect(file.functionScopes).to.be.length(2);
            expect(file.functionScopes[0].bodyRange).to.eql(Range.create(2, 0, 5, 16));
            expect(file.functionScopes[1].bodyRange).to.eql(Range.create(3, 0, 4, 20));

        });
    });

    describe('getCompletions', () => {
        it('returns empty set when out of range', async () => {
            await file.parse('');
            expect(file.getCompletions(Position.create(99, 99))).to.be.empty;
        });

        it('finds only variables declared above', async () => {
            await file.parse(`
                sub Main()
                    firstName = "bob"
                    age = 21
                    shoeSize = 10
                end sub
            `);
            let completions = file.getCompletions(Position.create(3, 26))
            expect(completions).to.be.lengthOf(1)
            expect(completions[0]).to.deep.include({
                kind: CompletionItemKind.Variable,
                label: 'firstName'
            });
        });

        it('finds parameters', async () => {
            await file.parse(`
                sub Main(count = 1)
                    firstName = "bob"
                    age = 21
                    shoeSize = 10
                end sub
            `);
            let completions = file.getCompletions(Position.create(3, 26))
            expect(completions).to.be.lengthOf(2);
            expect(completions[0]).to.deep.include({
                kind: CompletionItemKind.Variable,
                label: 'count'
            });
            expect(completions[1]).to.deep.include({
                kind: CompletionItemKind.Variable,
                label: 'firstName'
            });
        });
    });
});