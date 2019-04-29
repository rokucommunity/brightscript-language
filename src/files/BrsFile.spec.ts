import { assert, expect } from 'chai';
import * as sinonImport from 'sinon';
import { Position, Range } from 'vscode-languageserver';

import { diagnosticMessages } from '../DiagnosticMessages';
import { Assignment, Callable, CallableArg, CommentFlag, Diagnostic } from '../interfaces';
import { Program } from '../Program';
import { BooleanType } from '../types/BooleanType';
import { DynamicType } from '../types/DynamicType';
import { FunctionType } from '../types/FunctionType';
import { IntegerType } from '../types/IntegerType';
import { ObjectType } from '../types/ObjectType';
import { StringType } from '../types/StringType';
import { BrsFile } from './BrsFile';

let sinon = sinonImport.createSandbox();
describe('BrsFile', () => {
    let rootDir = process.cwd();
    let program: Program;
    let file: BrsFile;
    let mainPath = `${rootDir}/source/main.brs`;
    beforeEach(() => {
        program = new Program({ rootDir: rootDir });
        file = new BrsFile('abs', 'rel', program);
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('comment flags', () => {
        describe('brs:disable-next-line', () => {
            it('works for all', async () => {
                let file: BrsFile = (await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                    sub Main()
                        'brs:disable-next-line
                        name = "bob
                    end sub
                `) as any);
                expect(file.commentFlags[0]).to.exist;
                expect(file.commentFlags[0]).to.deep.include({
                    codes: null,
                    range: Range.create(2, 24, 2, 46),
                    affectedRange: Range.create(3, 0, 3, 35)
                } as CommentFlag);
                await program.validate();
                //the "unterminated string" error should be filtered out
                expect(program.getDiagnostics()).to.be.lengthOf(0);
            });

            it('works for specific codes', async () => {
                let file: BrsFile = (await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                    sub Main()
                        'brs:disable-next-line: 1000, 1001
                        name = "bob
                    end sub
                `) as any);
                expect(file.commentFlags[0]).to.exist;
                expect(file.commentFlags[0]).to.deep.include({
                    codes: [1000, 1001],
                    range: Range.create(2, 24, 2, 58),
                    affectedRange: Range.create(3, 0, 3, 35)
                } as CommentFlag);
                //the "unterminated string" error should be filtered out
                expect(program.getDiagnostics()).to.be.lengthOf(0);
            });

            it('adds diagnostics for unknown diagnostic codes', async () => {
                await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                    sub main()
                        print "hi" 'brs:disable-line: 123456 999999   aaaab
                    end sub
                `);

                await program.validate();

                expect(program.getDiagnostics()).to.be.lengthOf(3);
                expect(program.getDiagnostics()[0]).to.deep.include({
                    location: Range.create(2, 54, 2, 60)
                } as Diagnostic);
                expect(program.getDiagnostics()[1]).to.deep.include({
                    location: Range.create(2, 61, 2, 67)
                } as Diagnostic);
                expect(program.getDiagnostics()[2]).to.deep.include({
                    location: Range.create(2, 70, 2, 75)
                } as Diagnostic);
            });

        });

        describe('brs:disable-line', () => {
            it('works for all', async () => {
                let file: BrsFile = (await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                    sub Main()
                        name = "bob 'brs:disable-line
                    end sub
                `) as any);
                expect(file.commentFlags[0]).to.exist;
                expect(file.commentFlags[0]).to.deep.include({
                    codes: null,
                    range: Range.create(2, 36, 2, 53),
                    affectedRange: Range.create(2, 0, 2, 36)
                } as CommentFlag);
                await program.validate();
                //the "unterminated string" error should be filtered out
                expect(program.getDiagnostics()).to.be.lengthOf(0);
            });

            it('works for specific codes', async () => {
                await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                    sub main()
                        'should not have any errors
                        DoSomething(1) 'brs:disable-line:1002
                        'should have an error because the param-count error is not being suppressed
                        DoSomething(1) 'brs:disable-line:1000
                    end sub
                    sub DoSomething()
                    end sub
                `);

                await program.validate();

                expect(program.getDiagnostics()).to.be.lengthOf(1);
                expect(program.getDiagnostics()[0]).to.deep.include({
                    location: Range.create(5, 24, 5, 35)
                } as Diagnostic);
            });

            it('handles the erraneous `stop` keyword', async () => {
                //the current version of BRS causes parse errors after the `parse` keyword, showing error in comments
                //the program should ignore all diagnostics found in brs:* comment lines EXCEPT
                //for the diagnostics about using unknown error codes
                await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                    sub main()
                        stop 'brs:disable-line
                        print "need a valid line to fix stop error"
                    end sub
                `);
                await program.validate();
                expect(program.getDiagnostics()).to.be.lengthOf(0);
            });
        });
    });

    describe('parse', () => {
        it('does not lose function scopes when mismatched end sub', async () => {
            await file.parse(`
                sub main()
                    sayHi()
                end function

                sub sayHi()
                    print "hello world"
                end sub
            `);
            expect(file.functionScopes).to.be.lengthOf(2);
        });

        it('does not lose sub scope when mismatched end function', async () => {
            await file.parse(`
                function main()
                    sayHi()
                end sub

                sub sayHi()
                    print "hello world"
                end sub
            `);
            expect(file.functionScopes).to.be.lengthOf(2);
        });

        it('does not error with boolean in RHS of set statement', async () => {
            await file.parse(`
                sub main()
                    foo = {
                        bar: false
                    }
                    foo.bar = true and false or 3 > 4
                end sub
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it('does not error with boolean in RHS of set statement', async () => {
            await file.parse(`
                sub main()
                    m = {
                        isTrue: false
                    }
                    m.isTrue = true = true
                    m.isTrue = m.isTrue = true
                    m.isTrue = m.isTrue = m.isTrue
                end sub
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it('supports type designators', async () => {
            await file.parse(`
                sub main()
                  name$ = "bob"
                  age% = 1
                  height! = 5.5
                  salary# = 9.87654321
                end sub
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it('supports multiple spaces between two-word keywords', async () => {
            await file.parse(`
                sub main()
                    if true then
                        print "true"
                    else    if true then
                        print "also true"
                    end if
                end sub
            `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

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
        it('supports bitshift assignment operators', async () => {
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
        it('supports bitshift assignment operators on objects', async () => {
            await file.parse(`
                    function Main()
                        m.x = 1
                        m.x <<= 1
                        m.x >>= 1
                        print m.x
                    end function
                `);
            expect(file.getDiagnostics()).to.be.lengthOf(0);
        });

        it.skip('supports bitshift assignment operators on object properties accessed by array syntax', async () => {
            await file.parse(`
                    function Main()
                        m.x = 1
                        'm['x'] << 1
                        'm['x'] >> 1
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

        it('supports colons as separators in associative array properties', async () => {
            await file.parse(`
                sub Main()
                    obj = {x:0 : y: 1}
                end sub
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
                    DoB("a")
                end function
                function DoB(a as string)
                    DoC()
                end function
            `);
            expect(file.functionCalls.length).to.equal(2);

            expect(file.functionCalls[0].range).to.eql(Range.create(2, 20, 2, 28));
            expect(file.functionCalls[0].nameRange).to.eql(Range.create(2, 20, 2, 23));

            expect(file.functionCalls[1].range).to.eql(Range.create(5, 20, 5, 25));
            expect(file.functionCalls[1].nameRange).to.eql(Range.create(5, 20, 5, 23));
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
            expect(outerScope.assignments).to.be.lengthOf(2);

            let innerScope = file.getFunctionScopeAtPosition(Position.create(4, 10));
            expect(innerScope.assignments).to.be.lengthOf(1);
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
            expect(file.functionScopes[0].assignments).to.be.length(1);
            expect(file.functionScopes[0].assignments[0]).to.deep.include(<Assignment>{
                name: 'sayHi'
            });
            expect(file.functionScopes[0].assignments[0].nameRange.start.line).to.equal(2);

            expect(file.functionScopes[0].assignments[0].incomingType).instanceof(FunctionType);

            expect(file.functionScopes[1].assignments).to.be.length(1);

            expect(file.functionScopes[1].assignments[0]).to.deep.include(<Assignment>{
                name: 'age'
            });
            expect(file.functionScopes[1].assignments[0].nameRange.start.line).to.equal(3);
            expect(file.functionScopes[1].assignments[0].incomingType).instanceof(IntegerType);

            expect(file.functionScopes[2].assignments).to.be.length(1);
            expect(file.functionScopes[2].assignments[0]).to.deep.include(<Assignment>{
                name: 'name'
            });
            expect(file.functionScopes[2].assignments[0].nameRange.start.line).to.equal(7);
            expect(file.functionScopes[2].assignments[0].incomingType).instanceof(StringType);
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
            expect(scope.assignments[0]).to.exist;
            expect(scope.assignments[0].name).to.equal('theLength');
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

            expect(file.functionScopes[0].assignments).to.be.length(1);
            expect(file.functionScopes[0].assignments[0]).to.deep.include(<Assignment>{
                name: 'myName'
            });
            expect(file.functionScopes[0].assignments[0].nameRange.start.line).to.equal(2);
            expect(file.functionScopes[0].assignments[0].incomingType).instanceof(StringType);
        });

        it('finds variable type from other variable', async () => {
            await file.parse(`
                sub Main()
                   name = "bob"
                   nameCopy = name
                end sub
            `);

            expect(file.functionScopes[0].assignments).to.be.length(2);
            expect(file.functionScopes[0].assignments[1]).to.deep.include(<Assignment>{
                name: 'nameCopy'
            });
            expect(file.functionScopes[0].assignments[1].nameRange.start.line).to.equal(3);
            expect(file.functionScopes[0].assignments[1].incomingType).instanceof(StringType);
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

    describe('strict mode', () => {
        it('catches unknown property access', async () => {
            await program.addOrReplaceFile(mainPath, `
                sub Main()
                    person = {
                        name: "bob"
                    }
                    person.age = 12 'error because person does not have age property
                end sub
            `);
            await program.validate();
            expect(program.getDiagnostics()).to.be.lengthOf(1);
            expect(program.getDiagnostics()[0].code).to.equal(diagnosticMessages.Property_does_not_exist_on_type_1017('', new DynamicType()).code);
        });

        it('var being initialized as "invalid" is given type "dynamic"', async () => {
            const file = await program.addOrReplaceFile(mainPath, `
                sub Main()
                    runtime = invalid
                    runtime = "cat"
                end sub
            `);
            await program.validate();
            const scope = file.getFunctionScopeAtPosition(Position.create(2, 0));
            expect(scope.assignments[0].incomingType).to.be.instanceof(DynamicType);
        });

        it('catches basic local assignment type mismatches', async () => {
            program.options.strictTypeChecking = true;
            await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub Main()
                    name = "cat"
                    name = 12
                end sub
            `);
            await program.validate();
            expect(program.getDiagnostics()).to.be.lengthOf(1);
            expect(program.getDiagnostics()[0].code).to.equal(diagnosticMessages.Type_a_is_not_assignable_to_type_b_1016('', '').code);
        });
    });

    describe('object literals', () => {
        it('type is determined', async () => {
            let file = await program.addOrReplaceFile(`${rootDir}/source/main.brs`, `
                sub main()
                    person = {
                        name: "bob",
                        age: 12,
                        isAlive: true
                    }
                end sub
            `);
            let scope = file.getFunctionScopeAtPosition(Position.create(2, 0));
            let person = scope.assignments[0];
            let foundType = person.incomingType as ObjectType;
            expect(foundType).to.be.instanceof(ObjectType);
            expect(foundType.getProperty('name')).to.exist;
            expect(foundType.getProperty('name').type).to.be.instanceof(StringType);
            expect(foundType.getProperty('age')).to.exist;
            expect(foundType.getProperty('age').type).to.be.instanceof(IntegerType);
            expect(foundType.getProperty('isAlive')).to.exist;
            expect(foundType.getProperty('isAlive').type).to.be.instanceof(BooleanType);
        });
    });

    describe('getCompletions', () => {
        it('detects when completing next to a period', async () => {
            let file = await program.addOrReplaceFile(mainPath, `
                sub main()
                    person = {
                        name: "bob",
                        age: 12,
                        isAlive: true
                    }
                    person.
                end sub
            `);
            //right after the period of person
            let completionResult = file.getCompletions(Position.create(7, 27));
            let completions = completionResult.completions;
            expect(completions.length).to.equal(3);
            expect(completions[0].label).to.equal('name');
            expect(completions[1].label).to.equal('age');
            expect(completions[2].label).to.equal('isAlive');
        });
    });
});
