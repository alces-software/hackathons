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
                  label: 'Walk through',
                  value: 'walkThrough'
               },
               {
                  label: 'Level 1',
                  value: '1'
               },
               {
                  label: 'Level 2',
                  value: '2'
               },
               {
                  label: 'Level 3',
                  value: '3'
               },
               {
                  label: 'Level 4',
                  value: '4'
               },
               {
                  label: 'Level 5',
                  value: '5'
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
         } else if (typeof action === 'string' && /^[1-5]$/v.test(action)) {
            console.clear();
            await this.config.runCommand(`level:${action}`);
         }
      }
   }
}
