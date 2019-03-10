import { assert, expect } from 'chai';
import * as sinonImport from 'sinon';
import { CompletionItemKind, Position, Range } from 'vscode-languageserver';

import { Callable, CallableArg, Diagnostic, VariableDeclaration } from '../interfaces';
import { Program } from '../Program';
import { BooleanType } from '../types/BooleanType';
import { DynamicType } from '../types/DynamicType';
import { FunctionType } from '../types/FunctionType';
import { IntegerType } from '../types/IntegerType';
import { StringType } from '../types/StringType';
import { BrsFile } from './BrsFile';

let sinon = sinonImport.createSandbox();
describe('BrsFile', () => {
    let rootDir = process.cwd();
    let program: Program;
    let file: BrsFile;
    beforeEach(() => {
        program = new Program({ rootDir: rootDir });
        file = new BrsFile('abs', 'rel', program);
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {
        it('does not error with `stop` as object key', async () => {
            await file.parse(`
                function GetObject()
                    obj = {
                        stop: function() as void

                        end function
                    }
                    return obj
                end function
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it('does not error with `run` as object key', async () => {
            await file.parse(`
                function GetObject()
                    obj = {
                        run: function() as void

                        end function
                    }
                    return obj
                end function
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it('supports assignment operators', async () => {
            await file.parse(`
                function Main()
                    x = 1
                    x += 1
                    x += 2
                    x -= 1
                    x /= 2
                    x = 9
                    x \\= 2
                    x *= 3.0
                    x -= 1
                    print x
                end function
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it('supports `then` as object property', async () => {
            await file.parse(`
                function Main()
                    promise = {
                        then: sub()
                        end sub
                    }
                    promise.then()
                end function
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it('supports function as parameter type', async () => {
            await file.parse(`
                sub Main()
                    doWork = function(callback as function)
                    end function
                end sub
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it.skip('supports writing numbers with decimal but no trailing digit', async () => {
            await file.parse(`
                function Main()
                    x = 3.
                    print x
                end function
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it('supports assignment operators against object properties', async () => {
            await file.parse(`
                function Main()
                    m.age = 1

                    m.age += 1
                    m.age -= 1
                    m.age *= 1
                    m.age /= 1
                    m.age \\= 1

                    m["age"] += 1
                    m["age"] -= 1
                    m["age"] *= 1
                    m["age"] /= 1
                    m["age"] \\= 1

                    print m.age
                end function
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        //skipped until `brs` supports this
        it.skip('supports bitshift assignment operators', async () => {
            await file.parse(`
                function Main()
                    x = 1
                    x <<= 8
                    x >>= 4
                    print x
                end function
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        //skipped until `brs` supports this
        it.skip('supports bitshift assignment operators on objects', async () => {
            await file.parse(`
                    function Main()
                        m.x = 1
                        m.x <<= 1
                        m.x >>= 1
                        m['x'] << 1
                        m['x'] >> 1
                        print m.x
                    end function
                `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it.skip('supports weird period AA accessor', async () => {
            await file.parse(`
                function Main()
                    m._uuid = "123"
                    print m.["_uuid"]
                end function
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it.skip('supports library imports', async () => {
            await file.parse(`
                Library "v30/bslCore.brs"
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

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
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
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
            let file = new BrsFile('abspath', 'relpath', program);
            await file.parse(`'a comment`);
            try {
                await file.parse(`'a new comment`);
                assert.fail(null, null, 'Should have thrown an exception, but did not');
            } catch (e) {
                //test passes
            }
        });

        it('finds and registers duplicate callables', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
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
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
            await file.parse(`
                function DoA()
                    DoB()
                end function
                function DoB()
                     DoC()
                end function
            `);
            expect(file.functionCalls.length).to.equal(2);

            expect(file.functionCalls[0].nameRange).to.eql(Range.create(2, 20, 2, 23));

            expect(file.functionCalls[1].nameRange).to.eql(Range.create(5, 21, 5, 24));
        });

        it('sanitizes brs errors', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
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
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
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
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
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
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
            await file.parse(`
                sub Sum()
                    print "hello world"
                end sub
            `);
            let callable = file.callables[0];
            expect(callable.bodyRange).to.eql(Range.create(2, 0, 3, 16));
        });

        it('finds correct body range even with inner function', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
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
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
            await file.parse(`
                function Sum(a, b, c)

                end function
            `);
            let callable = file.callables[0];
            expect(callable.params[0]).to.deep.include({
                name: 'a',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[0].type).instanceof(DynamicType);

            expect(callable.params[1]).to.deep.include({
                name: 'b',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[1].type).instanceof(DynamicType);

            expect(callable.params[2]).to.deep.include({
                name: 'c',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[2].type).instanceof(DynamicType);
        });

        it('finds optional parameters', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
            await file.parse(`
                function Sum(a=2)

                end function
            `);
            let callable = file.callables[0];
            expect(callable.params[0]).to.deep.include({
                name: 'a',
                isOptional: true,
                isRestArgument: false
            });
            expect(callable.params[0].type).instanceof(DynamicType);
        });

        it('finds parameter types', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
            await file.parse(`
                function Sum(a, b as integer, c as string)

                end function
            `);
            let callable = file.callables[0];
            expect(callable.params[0]).to.deep.include({
                name: 'a',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[0].type).instanceof(DynamicType);

            expect(callable.params[1]).to.deep.include({
                name: 'b',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[1].type).instanceof(IntegerType);

            expect(callable.params[2]).to.deep.include({
                name: 'c',
                isOptional: false,
                isRestArgument: false
            });
            expect(callable.params[2].type).instanceof(StringType);
        });
    });

    describe('findCallableInvocations', () => {
        it('finds arguments with literal values', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
            await file.parse(`
                function Sum()
                    DoSomething("name", 12, true)
                end function
            `);
            expect(file.functionCalls.length).to.equal(1);
            let args = file.functionCalls[0].args;
            expect(args.length).to.equal(3);
            expect(args[0]).deep.include(<CallableArg>{
                type: new StringType(),
                text: '"name"'
            });
            expect(args[1]).deep.include(<CallableArg>{
                type: new IntegerType(),
                text: '12'
            });
            expect(args[2]).deep.include(<CallableArg>{
                type: new BooleanType(),
                text: 'true'
            });
        });

        it('finds arguments with variable values', async () => {
            let file = new BrsFile('absolute_path/file.brs', 'relative_path/file.brs', program);
            await file.parse(`
                function Sum()
                    count = 1
                    name = "John"
                    isAlive = true
                    DoSomething(count, name, isAlive)
                end function
            `);
            expect(file.functionCalls.length).to.equal(1);
            expect(file.functionCalls[0].args[0]).deep.include(<CallableArg>{
                type: new DynamicType(),
                text: 'count'
            });
            expect(file.functionCalls[0].args[1]).deep.include(<CallableArg>{
                type: new DynamicType(),
                text: 'name'
            });
            expect(file.functionCalls[0].args[2]).deep.include(<CallableArg>{
                type: new DynamicType(),
                text: 'isAlive'
            });
        });
    });

    describe('standardizeLexParserErrors', () => {
        it('properly maps the location to a Range', () => {
            let file = new BrsFile('', '', program);
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
            let file = new BrsFile('absolute', 'relative', program);
            await file.parse('name = "Bob"');
            expect(file.callables.length).to.equal(0);
        });

        it('finds return type', async () => {
            let file = new BrsFile('absolute', 'relative', program);
            await file.parse(`
                function DoSomething() as string
                end function
            `);
            expect(file.callables[0]).to.deep.include(<Partial<Callable>>{
                file: file,
                nameRange: Range.create(1, 25, 1, 36),
                name: 'DoSomething',
                params: []
            });
            expect(file.callables[0].type.returnType).instanceof(StringType);
        });
    });

    describe('createFunctionScopes', async () => {
        it('creates range properly', async () => {
            await file.parse(`
                sub Main()
                    name = 'bob"
                end sub
            `);
            expect(file.functionScopes[0].range).to.eql(Range.create(1, 16, 3, 23));
        });

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

        it('outer function does not capture inner statements', async () => {
            await file.parse(`
                sub Main()
                    name = "john"
                    sayHi = sub()
                        age = 12
                    end sub
                end sub
            `);
            let outerScope = file.getFunctionScopeAtPosition(Position.create(2, 25));
            expect(outerScope.variableDeclarations).to.be.lengthOf(2);

            let innerScope = file.getFunctionScopeAtPosition(Position.create(4, 10));
            expect(innerScope.variableDeclarations).to.be.lengthOf(1);
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
            expect(file.functionScopes[0].variableDeclarations[0]).to.deep.include(<VariableDeclaration>{
                lineIndex: 2,
                name: 'sayHi'
            });
            expect(file.functionScopes[0].variableDeclarations[0].type).instanceof(FunctionType);

            expect(file.functionScopes[1].variableDeclarations).to.be.length(1);
            expect(file.functionScopes[1].variableDeclarations[0]).to.deep.include(<VariableDeclaration>{
                lineIndex: 3,
                name: 'age'
            });
            expect(file.functionScopes[1].variableDeclarations[0].type).instanceof(IntegerType);

            expect(file.functionScopes[2].variableDeclarations).to.be.length(1);
            expect(file.functionScopes[2].variableDeclarations[0]).to.deep.include(<VariableDeclaration>{
                lineIndex: 7,
                name: 'name'
            });
            expect(file.functionScopes[2].variableDeclarations[0].type).instanceof(StringType);
        });

        it('finds variable declarations inside of if statements', async () => {
            await file.parse(`
                sub Main()
                    if true then
                        theLength = 1
                    end if
                end sub
            `);
            let scope = file.getFunctionScopeAtPosition(Position.create(3, 0));
            expect(scope.variableDeclarations[0]).to.exist;
            expect(scope.variableDeclarations[0].name).to.equal('theLength');
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
            expect(file.functionScopes[0].variableDeclarations[0]).to.deep.include(<VariableDeclaration>{
                lineIndex: 2,
                name: 'myName'
            });
            expect(file.functionScopes[0].variableDeclarations[0].type).instanceof(StringType);
        });

        it('finds variable type from other variable', async () => {
            await file.parse(`
                sub Main()
                   name = "bob"
                   nameCopy = name
                end sub
            `);

            expect(file.functionScopes[0].variableDeclarations).to.be.length(2);
            expect(file.functionScopes[0].variableDeclarations[1]).to.deep.include(<VariableDeclaration>{
                lineIndex: 3,
                name: 'nameCopy'
            });
            expect(file.functionScopes[0].variableDeclarations[1].type).instanceof(StringType);
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
            let completions = file.getCompletions(Position.create(3, 26));
            expect(completions).to.be.lengthOf(1);
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
            let completions = file.getCompletions(Position.create(3, 26));
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

    describe('getHover', () => {
        it('works for param types', async () => {
            let file = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub DoSomething(name as string)
                    name = 1
                    sayMyName = function(name as string)
                    end function
                end sub
            `);

            //hover over the `name = 1` line
            let hover = file.getHover(Position.create(2, 24));
            expect(hover).to.exist;
            expect(hover.range).to.eql(Range.create(2, 20, 2, 24));

            //hover over the `name` parameter declaration
            hover = file.getHover(Position.create(1, 34));
            expect(hover).to.exist;
            expect(hover.range).to.eql(Range.create(1, 32, 1, 36));
        });

        //ignore this for now...it's not a huge deal
        it.skip('does not match on keywords or data types', async () => {
            let file = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main(name as string)
                end sub
                sub as()
                end sub
            `);
            //hover over the `as`
            expect(file.getHover(Position.create(1, 31))).not.to.exist;
            //hover over the `string`
            expect(file.getHover(Position.create(1, 36))).not.to.exist;
        });

        it('finds declared function', async () => {
            let file = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                function Main(count = 1)
                    firstName = "bob"
                    age = 21
                    shoeSize = 10
                end function
            `);

            let hover = file.getHover(Position.create(1, 28));
            expect(hover).to.exist;

            expect(hover.range).to.eql(Range.create(1, 25, 1, 29));
            expect(hover.contents).to.equal('function Main(count? as dynamic) as dynamic');
        });

        it('finds variable function hover in same scope', async () => {
            let file = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    sayMyName = sub(name as string)
                    end sub

                    sayMyName()
                end sub
            `);

            let hover = file.getHover(Position.create(5, 24));

            expect(hover.range).to.eql(Range.create(5, 20, 5, 29));
            expect(hover.contents).to.equal('sub sayMyName(name as string) as void');
        });

        it('finds function hover in file scope', async () => {
            let file = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    sayMyName()
                end sub

                sub sayMyName()

                end sub
            `);

            let hover = file.getHover(Position.create(2, 25));

            expect(hover.range).to.eql(Range.create(2, 20, 2, 29));
            expect(hover.contents).to.equal('sub sayMyName() as void');
        });

        it('finds function hover in context scope', async () => {
            let rootDir = process.cwd();
            let program = new Program({
                rootDir: rootDir
            });

            let mainFile = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    sayMyName()
                end sub
            `);

            await program.addOrReplaceFile(`${rootDir}/source/lib.brs`, `
                sub sayMyName(name as string)

                end sub
            `);

            let hover = mainFile.getHover(Position.create(2, 25));
            expect(hover).to.exist;

            expect(hover.range).to.eql(Range.create(2, 20, 2, 29));
            expect(hover.contents).to.equal('sub sayMyName(name as string) as void');
        });

        it('handles mixed case `then` partions of conditionals', async () => {
            let mainFile = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    if true then
                        print "works"
                    end if
                end sub
            `);

            expect(mainFile.getDiagnostics()).to.be.lengthOf(0);
            mainFile = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    if true Then
                        print "works"
                    end if
                end sub
            `);
            expect(mainFile.getDiagnostics()).to.be.lengthOf(0);

            mainFile = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    if true THEN
                        print "works"
                    end if
                end sub
            `);
            expect(mainFile.getDiagnostics()).to.be.lengthOf(0);
        });
    });
});
