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
            expect(context.callables.length).to.equal(0);
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
            expect(context.callables.length).to.equal(2);
        });
    });

    describe('validate', () => {
        it('detects duplicate callables', async () => {
            expect(context.errors.length).to.equal(0);
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
            expect(context.errors.length).to.equal(0);
            //validate the context
            context.validate();
            //we should have the "DoA declared more than once" error twice (one for each function named "DoA")
            expect(context.errors.length).to.equal(2);
        });
    });

});