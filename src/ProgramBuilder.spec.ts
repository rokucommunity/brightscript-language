import * as path from 'path';
import * as sinonImport from 'sinon';

import { ProgramBuilder } from './ProgramBuilder';
import { expect, assert } from 'chai';
import util from './util';

let sinon = sinonImport.createSandbox();

beforeEach(() => {
});
afterEach(() => {
    sinon.restore();
});

describe('ProgramBuilder', () => {
    let server: ProgramBuilder;
    let s: any;
    let vfs = {};
    let vfsStub;
    let rootConfigPath = path.join(process.cwd(), 'brsconfig.json');
    let rootConfigDir = path.dirname(rootConfigPath);
    beforeEach(() => {
        server = new ProgramBuilder();
        s = server;
        vfs = {};
        vfsStub = sinon.stub(util, 'getFileContents').callsFake((filePath) => {
            if (vfs[filePath]) {
                return vfs[filePath];
            } else {
                throw new Error('Cannot find file ' + filePath);
            }
        });
    })
});