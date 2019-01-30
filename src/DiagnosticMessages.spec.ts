import { diagnosticMessages } from './DiagnosticMessages';
import { assert } from 'chai';

describe('DiagnosticMessages', () => {
    it('has a unique code for every error', () => {
        let keysByCode = {} as { [code: string]: string };
        let valuesByCode = {}
        let seenValueCodes = {};

        for (let key in diagnosticMessages) {
            let value = diagnosticMessages[key];
            let keyCodeMatch = /_(\d+)/.exec(key);
            if (!keyCodeMatch) {
                assert.fail(null, null, `Key "${key}" does not have a code`);
            }
            let keyCode = keyCodeMatch[1];
            if (keysByCode[keyCode]) {
                assert.fail(null, null, `Key code ${keyCode} from "${key}" is already in use in: "${keysByCode[keyCode]}"`);
            }
            keysByCode[keyCode] = key;

            let valueMatch = /\[(\d+)\]/.exec(value);
            if (!valueMatch) {
                assert.fail(null, null, `Diagnostic message for key "${key}" does not include a code: "${value}"`);
            }
            let valueCode = valueMatch[1];
            if (valueCode !== keyCode) {
                assert.fail(null, null, `Value code ${valueCode} does not match code from key "${key}"`);
            }
        }
    });
});