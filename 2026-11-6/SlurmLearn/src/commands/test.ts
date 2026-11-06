import { Command } from '@oclif/core';

import ParserObj from '../lib/parser.js';

export default class Test extends Command {
   static override description = 'describe the command here';
   static override examples = ['<%= config.bin %> <%= command.id %>'];

   public async run(): Promise<void> {
      await this.parse(Test);

      this.log('Run a command that prints "hello" to the console');

      const parser = new ParserObj(
         (x: string) => {
            const out = x.slice(0, -1);
            this.log(out);
            if (out === 'hello') {
               this.log('Well Done!');
            }
         },
         (x) => {
            console.log(x);
         }
      );

      await parser.runConsole();
   }
}
