import { Command } from '@oclif/core';
import { existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';


export default class HistoryClear extends Command {
   static description = 'Views your slurm job log';

   async run() {
      await this.parse(HistoryClear);

      const historyFile = `${os.homedir()}/slurmHistory/history`;

      if (existsSync(historyFile)) {
         unlinkSync(historyFile);
         this.log("\nYou're slurm history file has been deleted\n");
      }
   }
}