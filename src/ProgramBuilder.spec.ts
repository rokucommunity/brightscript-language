import * as path from 'path';
import * as sinonImport from 'sinon';
let sinon = sinonImport.createSandbox();

import { ProgramBuilder } from './ProgramBuilder';
import { expect, assert } from 'chai';
import util from './util';
import { Program } from './Program';


beforeEach(() => {
});
afterEach(() => {
    sinon.restore();
});

describe('ProgramBuilder', () => {
    let builder: ProgramBuilder;
    let b: any;
    let vfs = {};
    let vfsStub;
    let rootConfigPath = path.join(process.cwd(), 'brsconfig.json');
    let rootConfigDir = path.dirname(rootConfigPath);
    beforeEach(() => {
        builder = new ProgramBuilder();
        b = builder;
        vfs = {};
        vfsStub = sinon.stub(util, 'getFileContents').callsFake((filePath) => {
            if (vfs[filePath]) {
                return vfs[filePath];
            } else {
                throw new Error('Cannot find file ' + filePath);
            }
        });
    })

    describe('loadAllFilesAST', () => {
        it.only('loads .bs, .brs, .xml files', async () => {
            sinon.stub(b, 'getFilePaths').returns(Promise.resolve([{
                src: 'file.brs',
                dest: 'file.brs'
            }, {
                src: 'file.bs',
                dest: 'file.bs'
            }, {
                src: 'file.xml',
                dest: 'file.xml'
            }]));

            b.program = {
                loadOrReloadFile: () => { }
            };
            let stub = sinon.stub(b.program, 'loadOrReloadFile');
            await b.loadAllFilesAST()
            expect(stub.getCalls()).to.be.lengthOf(3);
        });
    });
});