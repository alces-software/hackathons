/* eslint-disable no-await-in-loop */
import { cancel, CANCEL_SYMBOL, select } from '@clack/prompts';
import { Command } from '@oclif/core';

export default class Menu extends Command {
   public async run(): Promise<void> {
      await this.parse(Menu);

      while (true) {
         console.clear();
         const action = await select({
            message: 'Select the action to perform',
            options: [
               {
                  label: 'Level 1',
                  value: 'level1'
               },
               {
                  label: 'Level 2',
                  value: 'level2'
               },
               {
                  label: 'Level 3',
                  value: 'level3'
               },
               {
                  label: 'Level 4',
                  value: 'level4'
               },
               {
                  label: 'Level 5',
                  value: 'level5'
               },
               {
                  label: 'Exit',
                  value: 'exit'
               }
            ]
         });

         if (action === CANCEL_SYMBOL || (typeof action === 'string' && action === 'exit')) {
            cancel('Exiting main menu');
            this.exit(0);
         } else if (typeof action === 'string' && /^level[1-5]$/v.test(action)) {
            console.clear();
            await this.config.runCommand('test');
         }
      }
   }
}
