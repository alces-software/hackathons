import { cancel, CANCEL_SYMBOL, select } from '@clack/prompts';
import { Command } from '@oclif/core';

export default class Menu extends Command {
   public async run(): Promise<void> {
      await this.parse(Menu);

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
            }
         ]
      });

      switch (action) {
         case 'level1': {
            this.log();
            await this.config.runCommand('test');
            break;
         }

         case 'level2': {
            this.log();
            await this.config.runCommand('test');
            break;
         }

         case 'level3': {
            this.log();
            await this.config.runCommand('test');
            break;
         }

         case 'level4': {
            this.log();
            await this.config.runCommand('test');
            break;
         }

         case 'level5': {
            this.log();
            await this.config.runCommand('test');
            break;
         }

         case CANCEL_SYMBOL: {
            cancel('Exiting main menu');
            this.exit(0);
         }
      }
   }
}
