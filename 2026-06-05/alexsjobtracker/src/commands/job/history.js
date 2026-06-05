import { Command } from '@oclif/core';
import { readFile } from 'node:fs';
import os from 'node:os';


export default class JobHistory extends Command {
   static description = 'Views your slurm job history';

   async run() {
      await this.parse(JobHistory);

      readFile(`${os.homedir()}/slurmHistory/history`, (err, data) => {
         if (err?.code === 'ENOENT') {
            return this.log("\nYou have no job history to show\n");
         }

         if (data) {
            return this.log(data.toString('utf8'));
         }
      });
   }
}