import { XmlFile } from './files/XmlFile';
import { XmlContext } from './XmlContext';
import * as path from 'path'; import { Program } from './Program';
import { expect } from 'chai';
;
var n = path.normalize;
let rootDir = 'C:/projects/RokuApp';

describe('XmlContext', () => {
    var xmlFile: XmlFile;
    var context: XmlContext;
    var program: Program;
    let xmlFilePath = n(`${rootDir}/components/component.xml`)
    beforeEach(() => {

        program = new Program({ rootDir });
        xmlFile = new XmlFile(xmlFilePath, n('components/component.xml'), program);
        context = new XmlContext(xmlFile);
        context.attachProgram(program);

        context.parentContext = program.platformContext;
    });
    describe('constructor', () => {
        it('listens for attach/detach parent events', () => {
            var parentXmlFile = new XmlFile(n('${rootDir}/components/parent.xml'), n('components/parent.xml'), program);
            var parentContext = new XmlContext(parentXmlFile);
            program.contexts[parentContext.name] = parentContext;

            //should default to platform context
            expect(context.parentContext).to.equal(program.platformContext);

            //when the xml file attaches an xml parent, the xml context should be notified and find its parent context
            xmlFile.attachParent(parentXmlFile);
            expect(context.parentContext).to.equal(parentContext);

            xmlFile.detachParent();
            expect(context.parentContext).to.equal(program.platformContext);
        });
    });
});