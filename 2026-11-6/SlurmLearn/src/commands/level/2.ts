import { Command } from '@oclif/core';
import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import ParserObj from '../../lib/parser.js';

export default class Level2 extends Command {
   static override readonly description = 'Play through level 2 of Slurm Learn';

   public async run(): Promise<void> {
      await this.parse(Level2);
      // Setup:

      const script = `#!/bin/bash
#SBATCH --job-name=find_me
#SBATCH --output=jobOutput.txt

echo "Job 2 executed successfully"

sleep 5000
`;
      await writeFile('job2.sbatch', script, 'utf8');
      // eslint-disable-next-line @typescript-eslint/strict-void-return
      const asyncExec = promisify(exec);
      const jobID = await asyncExec('sbatch --parsable job2.sbatch');

      console.log(jobID);

      // Issue challenge:
      this.log(
         'There is a job running with the name find_me using squeue and the flag --name find then ID of the Job\nuse the command `answer <your answer>` to submit your answer'
      );

      const parser = new ParserObj(
         (x: string) => {
            const out = x.slice(0, -1);
            this.log(out);
            if (out === 'hello') {
               this.log('Well Done!');
               parser.stop();
            }
         },
         (x) => {
            this.log(x);
         },
         (x) => {
            if (x.join(' ') === jobID) {
               this.log(`That is correct the Job ID is ${jobID}`);
               parser.stop();
            }

            this.log('That is not correct the try again');
         }
      );

      await parser.runConsole();

      // Perform any cleanup:
   }
}
