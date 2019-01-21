import * as path from 'path';
import * as sinonImport from 'sinon';

import { BrightScriptLanguageServer } from './BrightScriptLanguageServer';
import { expect, assert } from 'chai';
import { BRSProgram } from './BRSProgram';

let sinon = sinonImport.createSandbox();

beforeEach(() => {
});
afterEach(() => {
    sinon.restore();
});


describe.only('BRSProgram', () => {
    it('catches duplicate SUB declarations', async () => {
        let program = new BRSProgram();
        await program.addFile('source/main.brs', `
            sub DoSomething()
            end sub
            
            sub DoSomething()
            end sub
        `);
        await program.validate();
        expect(program.errors.length).to.equal(1);
    });

    it('catches duplicate FUNCTION declarations', async () => {
        let program = new BRSProgram();
        await program.addFile('source/main.brs', `
            function DoSomething()
                return 1
            end function
            
            function DoSomething()
                return 1
            end function
        `);
    
        await program.validate();
        expect(program.errors.length).to.equal(1);
    });
});