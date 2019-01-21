import * as moment from 'moment';
export function log(...args) {
    let timestamp = `[${moment().format('hh:mm:ss A')}]`;
    console.log.apply(console.log, [timestamp, ...args]);
}
export function clear() {
    process.stdout.write('\x1B[2J\x1B[0f');
}