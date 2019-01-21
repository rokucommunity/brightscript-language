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


describe('BRSProgram', () => {
    it.only('constructs', async () => {
        let program = new BRSProgram();
        await program.addFile('source/main.brs', `sub DoSomething()\n end sub\n sub DoSomething()\n end sub`)
        await program.validate();
        expect(program.errors.length).to.equal(1);
    });
});