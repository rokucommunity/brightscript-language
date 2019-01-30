import * as path from 'path';
import * as sinonImport from 'sinon';

import { Program } from '../Program';
import { BrsFile } from './BrsFile';
import { expect } from 'chai';
import { CallableArg } from '../interfaces';
import { XmlFile } from './XmlFile';

describe('XmlFile', () => {

    let sinon = sinonImport.createSandbox();
    beforeEach(() => {
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {
        it('finds script imports', async () => {
            let file = new XmlFile('abspath/components/cmp1.xml', 'components/cmp1.xml');
            await file.parse(`<script type="text/brightscript" uri="pkg:/components/cmp1.brs" />`)
            expect(file.scriptImports.length).to.equal(1);
            expect(file.scriptImports[0]).to.deep.include({
                sourceFile: file,
                text: 'pkg:/components/cmp1.brs',
                lineIndex: 0,
                columnIndexBegin: 38,
                columnIndexEnd: 62,
                scriptColumnIndexBegin: 0,
                scriptColumnIndexEnd: 66,
                pkgPath: 'pkg:/components/cmp1.brs'
            });
        });

        it('resolves relative paths', async () => {
            let file = new XmlFile('abspath/components/cmp1.xml', 'components/cmp1.xml');
            await file.parse(`<script type="text/brightscript" uri="cmp1.brs" />`)
            expect(file.scriptImports.length).to.equal(1);
            expect(file.scriptImports[0]).to.deep.include({
                text: 'cmp1.brs',
                pkgPath: 'pkg:/components/cmp1.brs'
            });
        });
    });
});