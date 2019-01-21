import * as path from 'path';
import * as sinonImport from 'sinon';

import { BrightScriptLanguageServer } from './BrightScriptLanguageServer';
import { expect, assert } from 'chai';

let sinon = sinonImport.createSandbox();

beforeEach(() => {
});
afterEach(() => {
    sinon.restore();
});

describe('BrightScriptLanguageServer', () => {
    let server: BrightScriptLanguageServer;
    let s: any;
    let vfs = {};
    let vfsStub;
    let rootConfigPath = path.join(process.cwd(), 'brsconfig.json');
    let rootConfigDir = path.dirname(rootConfigPath);
    beforeEach(() => {
        server = new BrightScriptLanguageServer();
        s = server;
        vfs = {};
        vfsStub = sinon.stub(server, 'getFileContents').callsFake((filePath) => {
            if (vfs[filePath]) {
                return vfs[filePath];
            } else {
                throw new Error('Cannot find file ' + filePath);
            }
        });
    })
    describe('normalizeConfig', () => {
        it('loads project from disc', async () => {
            vfs[rootConfigPath] = `{"outFile": "customOutDir/pkg.zip"}`;
            let config = await server.normalizeConfig({ project: rootConfigPath })
            expect(config.outFile).to.equal(path.join(path.dirname(rootConfigPath), 'customOutDir', 'pkg.zip'))
        });

        it('loads project from disc and extends it', async () => {
            //the extends file
            let extendsConfigPath = path.join(rootConfigDir, 'testProject', 'base_brsconfig.json')
            vfs[extendsConfigPath] = `{
                "outFile": "customOutDir/pkg1.zip",
                "rootDir": "core"
            }`;

            //the project file
            vfs[rootConfigPath] = `{
                "extends": "testProject/base_brsconfig.json",
                "watch": true
            }`;

            let config = await server.normalizeConfig({ project: rootConfigPath })

            expect(config.outFile).to.equal(path.join(rootConfigDir, 'testProject', 'customOutDir', 'pkg1.zip'))
            expect(config.rootDir).to.equal(path.join(rootConfigDir, 'testProject', 'core'));
            expect(config.watch).to.equal(true)
        });

        it('catches circular dependencies', async () => {
            vfs[rootConfigPath] = `{
                "extends": "brsconfig2.json"
            }`;
            vfs[path.join(rootConfigDir, 'brsconfig2.json')] = `{
                "extends": "brsconfig.json"
            }`

            try {
                await server.normalizeConfig({ project: rootConfigPath })
                assert.fail('An exception should have occurred');
            } catch (e) {
                expect(e.message).to.contain('Circular dependency');
                //the test passed
            }
        });

        it('properly handles default for watch', async () => {
            let config = await server.normalizeConfig({ watch: true });
            expect(config.watch).to.be.true;
        });
    });
});