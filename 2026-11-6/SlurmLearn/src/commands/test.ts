import { Command } from '@oclif/core';

import level_1_1 from '../levels/1-1.js';

export default class Test extends Command {
   static override description = 'describe the command here';
   static override examples = ['<%= config.bin %> <%= command.id %>'];

   public async run(): Promise<void> {
      await this.parse(Test);

      await level_1_1(this.log.bind(this));
   }
}
