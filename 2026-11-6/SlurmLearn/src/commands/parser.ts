import { Args, Command, Flags } from '@oclif/core';

import ParserObj from '../lib/parser.js';

export default class Parser extends Command {
   static override args = {
      file: Args.string({ description: 'file to read' })
   };

   static override description = 'describe the command here';
   static override examples = ['<%= config.bin %> <%= command.id %>'];

   static override flags = {
      // flag with no value (-f, --force)
      force: Flags.boolean({ char: 'f' }),
      // flag with a value (-n, --name=VALUE)
      name: Flags.string({ char: 'n', description: 'name to print' })
   };

   public async run(): Promise<void> {
      const parser = new ParserObj(
         (x: string) => {
            console.log(x);
         },
         (x) => {
            console.log(x);
         }
      );
   }
}
