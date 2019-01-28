import * as path from 'path';
import * as sinonImport from 'sinon';

import { BRSProgram } from './BRSProgram';
import { BRSFile } from './BRSFile';
import { expect } from 'chai';

describe('BRSFile', () => {

    let sinon = sinonImport.createSandbox();
    beforeEach(() => {
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {
        it('finds line and column numbers for functions', async () => {
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
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
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
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

        it.only('finds function call line and column numbers', async () => {
            let file = new BRSFile('absolute_path/file.brs', 'relative_path/file.brs');
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
    });

});