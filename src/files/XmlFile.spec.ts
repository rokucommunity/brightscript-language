import * as path from 'path';
import * as sinonImport from 'sinon';

import { Program } from '../Program';
import { BrsFile } from './BrsFile';
import { expect, assert } from 'chai';
import { CallableArg, FileReference, Diagnostic } from '../interfaces';
import { XmlFile } from './XmlFile';
import { CompletionItem, CompletionItemKind, Position } from 'vscode-languageserver';
import util from '../util';
import { diagnosticMessages } from '../DiagnosticMessages';
let n = path.normalize;

describe('XmlFile', () => {

    let sinon = sinonImport.createSandbox();
    beforeEach(() => {
    });
    afterEach(() => {
        sinon.restore();
    });

    describe('parse', () => {

        it('finds component names', async () => {
            let file = new XmlFile('abs', 'rel', null);
            await file.parse(`
                <?xml version="1.0" encoding="utf-8" ?>
                <component name="ChildScene" extends="ParentScene">
                <script type="text/brightscript" uri="ChildScene.brs" />
                </component>
            `);
            expect(file.parentComponentName).to.equal('ParentScene');
            expect(file.componentName).to.equal('ChildScene');
        });

        it('Adds error when no component is declared in xml', async () => {
            let file = new XmlFile('abs', 'rel', null);
            await file.parse(`<script type="text/brightscript" uri="ChildScene.brs" />`);
            expect(file.diagnostics).to.be.lengthOf(1);
            expect(file.diagnostics[0].message).to.equal(diagnosticMessages.Xml_component_missing_component_declaration.message);
        });

        it('adds error when component does not declare a name', async () => {
            let file = new XmlFile('abs', 'rel', null);
            await file.parse(`
                <?xml version="1.0" encoding="utf-8" ?>
                <component extends="ParentScene">
                <script type="text/brightscript" uri="ChildScene.brs" />
                </component>
            `);
            expect(file.diagnostics).to.be.lengthOf(1);
            expect(file.diagnostics[0]).to.deep.include(<Diagnostic>{
                message: diagnosticMessages.Component_missing_name_attribute.message,
                lineIndex: 2,
                columnIndexBegin: 16,
                columnIndexEnd: 26
            });
        });

        it('catches xml parse errors', async () => {
            let file = new XmlFile('abs', 'rel', null);
            await file.parse(`
                <?xml version="1.0" encoding="utf-8" ?>
                <component 1extends="ParentScene">
                </component>
            `);
            expect(file.diagnostics).to.be.lengthOf(1);
            expect(file.diagnostics[0]).to.deep.include(<Diagnostic>{
                code: diagnosticMessages.Xml_parse_error.code,
                lineIndex: 2,
                columnIndexBegin: 27,
                columnIndexEnd: 27
            });
        });

        it('emits add-script-imports event', async () => {
            let deferred = util.defer();
            let file = new XmlFile('abs', 'rel', null);

            //the test passes when the event is emitted
            file.on('add-script-imports', deferred.resolve);

            await file.parse(`
                <?xml version="1.0" encoding="utf-8" ?>
                <component extends="ParentScene">
                <script type="text/brightscript" uri="ChildScene.brs" />
                </component>
            `);

            await deferred.promise;
        });

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

            expect(xmlFile.getCompletions(Position.create(1, 1))[0]).to.include({
                label: 'components/component1/component1.brs',
                kind: CompletionItemKind.File
            });

            expect(xmlFile.getCompletions(Position.create(1, 1))[1]).to.include(<CompletionItem>{
                label: 'pkg:/components/component1/component1.brs',
                kind: CompletionItemKind.File
            });
        });

        it('returns empty set when out of range', async () => {
            let file = new XmlFile('abs', 'rel', null);
            await file.parse('');
            expect(file.getCompletions(Position.create(99, 99))).to.be.empty;
        });
    });

    describe('attachParent', () => {
        it('properly fetches script imports for inheritance', () => {
            let parent = new XmlFile('abs/parent.xml', 'rel/parent.xml', null);
            parent.scriptImports.push({
                columnIndexBegin: 0,
                columnIndexEnd: 0,
                lineIndex: 0,
                pkgPath: 'script1.brs',
                sourceFile: parent,
                text: ''
            });

            let child = new XmlFile('abs/child.xml', 'rel/child.xml', null);
            expect(child.scriptImports).to.be.lengthOf(0);
            child.attachParent(parent);

            let grandchild = new XmlFile('abs/grandchild.xml', 'rel/grandchild.xml', null);
            grandchild.attachParent(child);

            //should get parent's existing script
            expect(child.scriptImports).to.be.lengthOf(1);
            //should get grandparent's existing script
            expect(grandchild.scriptImports).to.be.lengthOf(1);

            //add a new script to the parent
            (parent as any).addScriptImports([{
                columnIndexBegin: 0,
                columnIndexEnd: 0,
                lineIndex: 0,
                pkgPath: 'script2.brs',
                sourceFile: parent,
                text: ''
            }]);

            //child should have parent script
            expect(child.scriptImports).to.be.lengthOf(2);
            //grandchild should have parent script
            expect(grandchild.scriptImports).to.be.lengthOf(2);

            //add script to child
            (child as any).addScriptImports([{
                columnIndexBegin: 0,
                columnIndexEnd: 0,
                lineIndex: 0,
                pkgPath: 'script3.brs',
                sourceFile: parent,
                text: ''
            }]);

            expect(parent.scriptImports).to.be.lengthOf(2);
            expect(child.scriptImports).to.be.lengthOf(3);
            expect(grandchild.scriptImports).to.be.lengthOf(3);
        });

        it('properly fetches script imports with out-of-order attached files', () => {
            let parent = new XmlFile('abs/parent.xml', 'rel/parent.xml', null);
            parent.scriptImports.push({
                columnIndexBegin: 0,
                columnIndexEnd: 0,
                lineIndex: 0,
                pkgPath: 'script1.brs',
                sourceFile: parent,
                text: ''
            });

            let child = new XmlFile('abs/child.xml', 'rel/child.xml', null);
            expect(child.scriptImports).to.be.lengthOf(0);

            let grandchild = new XmlFile('abs/grandchild.xml', 'rel/grandchild.xml', null);
            grandchild.attachParent(child);

            //attach the child to the parent AFTER the grandchild attached to the child
            child.attachParent(parent);

            //should get parent's existing script
            expect(child.scriptImports).to.be.lengthOf(1);
            //should get grandparent's existing script
            expect(grandchild.scriptImports).to.be.lengthOf(1);

            //add a new script to the parent
            (parent as any).addScriptImports([{
                columnIndexBegin: 0,
                columnIndexEnd: 0,
                lineIndex: 0,
                pkgPath: 'script2.brs',
                sourceFile: parent,
                text: ''
            }]);

            //child should have parent script
            expect(child.scriptImports).to.be.lengthOf(2);
            //grandchild should have parent script
            expect(grandchild.scriptImports).to.be.lengthOf(2);

            //add script to child
            (child as any).addScriptImports([{
                columnIndexBegin: 0,
                columnIndexEnd: 0,
                lineIndex: 0,
                pkgPath: 'script3.brs',
                sourceFile: parent,
                text: ''
            }]);

            expect(parent.scriptImports).to.be.lengthOf(2);
            expect(child.scriptImports).to.be.lengthOf(3);
            expect(grandchild.scriptImports).to.be.lengthOf(3);
        });
    });

    describe('reset', () => {
        it('tells children to remove parent scripts', async () => {
            let parent = new XmlFile('abs/parent.xml', 'rel/parent.xml', null);
            parent.scriptImports.push(<any>{
                pkgPath: 'script1.brs',
                sourceFile: parent
            });

            let child = new XmlFile('abs/child.xml', 'rel/child.xml', null);
            child.attachParent(parent);
            expect(child.scriptImports).to.be.lengthOf(1);

            parent.reset();
            expect(child.scriptImports).to.be.lengthOf(0);
        });
    });

});