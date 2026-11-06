import { Command } from '@oclif/core';

import ParserObj from '../../lib/parser.js';
import { writeFile } from 'node:fs/promises';
export default class Level_1 extends Command {
   static override description = 'Play through level 1 of Slurm Learn';

   public async run(): Promise<void> {
      await this.parse(Level_1);
      // Setup:

      const script = `#!/bin/bash
#SBATCH --job-name=firstJob
#SBATCH --output=jobOutput.txt

echo "Job 1 executed successfully"
`;
      await writeFile('/job1.sbatch', script, 'utf8');

      // Issue challenge:
      this.log(
         'There is a job file in this directory. Find it using "ls" and run it using sbatch <filename>'
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
         }
      );

      await parser.runConsole();

      // Perform any cleanup:
   }
}
