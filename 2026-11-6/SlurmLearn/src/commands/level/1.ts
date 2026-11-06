import { Command } from '@oclif/core';
import { writeFile } from 'node:fs/promises';

import ParserObj from '../../lib/parser.js';

export default class Level_1 extends Command {
   static override description = 'Play through level 1 of Slurm Learn';

   public async run(): Promise<void> {
      await this.parse(Level_1);
      // Setup:
      let stage = 1;

      const script = `#!/bin/bash
#SBATCH --job-name=firstJob
#SBATCH --output=jobOutput.txt

echo "Job 1 executed successfully"
`;
      await writeFile('job1.sbatch', script, 'utf8');

      // Issue challenge:
      this.log(
         'There is a job file in this directory. Find it using "ls" and run it using sbatch <filename>'
      );

      const parser = new ParserObj(
         (x: string) => {
            const out = x.slice(0, -1);
            this.log(out);

            switch (stage) {
               case 1: {
                  const pattern = /^Submitted batch job <\d+>$/v;

                  const isPattern = pattern.test(out);
                  if (isPattern) {
                     this.log('Well Done!');
                     stage += 1;
                     this.log('Find the output file and cat it');
                  }

                  break;
               }

               case 2: {
                  const isFlag = out === 'Job 1 executed successfully';

                  if (isFlag) {
                     this.log('Well Done');
                     parser.stop();
                  }
               }
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
