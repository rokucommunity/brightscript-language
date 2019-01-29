import * as path from 'path';
import * as sinonImport from 'sinon';

import { Program } from './Program';
import { File } from './File';
import { expect } from 'chai';

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
            expect(file.diagnostics[0].filePath).to.equal('absolute_path/file.brs');
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

});