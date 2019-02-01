import * as path from 'path';
import * as sinonImport from 'sinon';

import { Program } from '../Program';
import { BrsFile } from './BrsFile';
import { expect, assert } from 'chai';
import { CallableArg, FileReference } from '../interfaces';
import { XmlFile } from './XmlFile';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import util from '../util';
let n = path.normalize;

describe('XmlFile', () => {

    let sinon = sinonImport.createSandbox();
    beforeEach(() => {
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {
        it('finds script imports', async () => {
            let file = new XmlFile('abspath/components/cmp1.xml', 'components/cmp1.xml', null);
            await file.parse(`<script type="text/brightscript" uri="pkg:/components/cmp1.brs" />`)
            expect(file.scriptImports.length).to.equal(1);
            expect(file.scriptImports[0]).to.deep.include(<FileReference>{
                sourceFile: file,
                text: 'pkg:/components/cmp1.brs',
                lineIndex: 0,
                columnIndexBegin: 38,
                columnIndexEnd: 62,
                pkgPath: `components${path.sep}cmp1.brs`
            });
        });

        it('throws an error if the file has already been parsed', async () => {
            let file = new XmlFile('abspath', 'relpath', null);
            file.parse(`'a comment`);
            try {
                await file.parse(`'a new comment`);
                assert.fail(null, null, 'Should have thrown an exception, but did not');
            } catch (e) {
                //test passes
            }
        });

        it('loads file contents from disk when necessary', async () => {
            let stub = sinon.stub(util, 'getFileContents').returns(Promise.resolve(''));
            expect(stub.called).to.be.false;

            let file = new XmlFile('abspath', 'relpath', null);
            file.parse();
            expect(stub.called).to.be.true;

        });

        it('resolves relative paths', async () => {
            let file = new XmlFile('abspath/components/cmp1.xml', 'components/cmp1.xml', null);
            await file.parse(`<script type="text/brightscript" uri="cmp1.brs" />`)
            expect(file.scriptImports.length).to.equal(1);
            expect(file.scriptImports[0]).to.deep.include(<FileReference>{
                text: 'cmp1.brs',
                pkgPath: `components${path.sep}cmp1.brs`
            });
        });

        it('finds correct position for empty uri in script tag', async () => {
            let file = new XmlFile('abspath/components/cmp1.xml', 'components/cmp1.xml', null);
            await file.parse(`<script type="text/brightscript" uri="" />`)
            expect(file.scriptImports.length).to.equal(1);
            expect(file.scriptImports[0]).to.deep.include({
                lineIndex: 0,
                columnIndexBegin: 38,
                columnIndexEnd: 38,
            });
        });
    });

    describe('doesReferenceFile', () => {
        it('compares case insensitive', () => {
            let xmlFile = new XmlFile('absolute', 'relative', null);
            xmlFile.scriptImports.push({
                pkgPath: `components${path.sep}HeroGrid.brs`,
                text: '',
                lineIndex: 1,
                sourceFile: xmlFile
            });
            let brsFile = new BrsFile('absolute', `components${path.sep}HEROGRID.brs`);
            expect(xmlFile.doesReferenceFile(brsFile)).to.be.true;
        });
    });

    describe('getCompletions', () => {
        it('formats completion paths with proper slashes', async () => {
            let scriptPath = n('C:/app/components/component1/component1.brs');
            let program = {
                files: {
                }
            };
            program.files[scriptPath] = new BrsFile(scriptPath, n('components/component1/component1.brs'));

            let xmlFile = new XmlFile('component.xml', 'relative', <any>program);
            xmlFile.scriptImports.push({
                pkgPath: ``,
                text: '',
                lineIndex: 1,
                columnIndexBegin: 1,
                columnIndexEnd: 1,
                sourceFile: xmlFile
            });

            expect(xmlFile.getCompletions(1, 1)[0]).to.include({
                label: 'components/component1/component1.brs',
                kind: CompletionItemKind.File
            });

            expect(xmlFile.getCompletions(1, 1)[1]).to.include(<CompletionItem>{
                label: 'pkg:/components/component1/component1.brs',
                kind: CompletionItemKind.File
            });
        });

        it('returns empty set when out of range', async () => {
            let file = new XmlFile('abs', 'rel', null);
            await file.parse('');
            expect(file.getCompletions(99, 99)).to.be.empty;
        });
    });
});