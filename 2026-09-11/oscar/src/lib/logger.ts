import { appendFileSync } from 'node:fs';

export function debug(...args: unknown[]) {
   appendFileSync('./debug.log', args.map(String).join(' ') + '\n');
}
