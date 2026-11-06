import { text } from '@clack/prompts';
import { Command } from '@oclif/core';
import { existsSync, readFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';

import ParserObj from '../../lib/parser.js';

/** Directives the user's own script must include before a stage can be completed. */
const REQUIRED_DIRECTIVES: Record<number, string[]> = {
   1: ['job-name', 'output'],
   3: ['job-name', 'output', 'time', 'nodes', 'ntasks', 'mem']
};

// Return a description of the first problem with myJob.sbatch, or undefined when it validates.
const findProblem = (stage: number): string | undefined => {
   if (!existsSync('myJob.sbatch')) {
      return 'there is no myJob.sbatch file yet. Create it with nano';
   }

   const content = readFileSync('myJob.sbatch', 'utf8');
   const directives = new Set<string>();

   for (const line of content.split('\n')) {
      const match = /^#SBATCH\s+--([\w\-]+)/v.exec(line.trim());
      if (match) directives.add(match[1]);
   }

   if (!content.trimStart().startsWith('#!/bin/bash')) {
      return 'the script must start with #!/bin/bash';
   }

   const missing = (REQUIRED_DIRECTIVES[stage] ?? []).filter((d) => !directives.has(d));

   if (missing.length > 0) {
      return `these directives are missing: ${missing.map((d) => `--${d}`).join(', ')}`;
   }

   return undefined;
};

export default class Level3 extends Command {
   static override readonly description = 'Play through level 3 of Slurm Learn';

   public async run(): Promise<void> {
      await this.parse(Level3);
      // Setup: start (almost) clean so the script has to be created from scratch.
      let stage = 1;

      await Promise.all([
         unlink('myJob.sbatch').catch(() => undefined),
         unlink('thirdOutput.txt').catch(() => undefined)
      ]);

      // Issue challenge:
      this.log(
         'Level 3: write your own job script from scratch using the real editor nano.\n' +
            'Type "nano myJob.sbatch" and create a script like:\n\n' +
            '   #!/bin/bash\n' +
            '   #SBATCH --job-name=level3\n' +
            '   #SBATCH --output=thirdOutput.txt\n\n' +
            '   echo "Job 3 executed successfully"\n\n' +
            'Save with Ctrl+O then Enter, exit with Ctrl+X, then submit it: sbatch myJob.sbatch'
      );

      const parser = new ParserObj(
         (x: string) => {
            const out = x.slice(0, -1);
            this.log(out);

            switch (stage) {
               case 1: {
                  const pattern = /^Submitted batch job \d+$/v;

                  if (pattern.test(out)) {
                     const problem = findProblem(stage);

                     if (problem === undefined) {
                        this.log('Well done! That script is ready to run.');
                        stage += 1;
                        this.log('Find the output file and cat it');
                     } else {
                        this.log(`Almost! ${problem}`);
                     }
                  }

                  break;
               }

               case 2: {
                  const isEcho = out === 'Job 3 executed successfully';

                  if (isEcho) {
                     this.log('Well done!');
                     stage += 1;
                     this.log(
                        'Now use nano again to add these directives to myJob.sbatch, then sbatch it:\n' +
                           '   #SBATCH --time=00:01:00\n' +
                           '   #SBATCH --nodes=1\n' +
                           '   #SBATCH --ntasks=1\n' +
                           '   #SBATCH --mem=250M'
                     );
                  }

                  break;
               }

               case 3: {
                  const pattern = /^Submitted batch job \d+$/v;

                  if (pattern.test(out)) {
                     const problem = findProblem(stage);

                     if (problem === undefined) {
                        this.log('Well done! You wrote and ran a fully configured job script.');
                        parser.stop();
                     } else {
                        this.log(`Almost! ${problem}`);
                     }
                  }

                  break;
               }

               default: {
                  break;
               }
            }
         },
         (x) => {
            this.log(x);
         },
         undefined,
         (command: string) => /^nano(\s|$)/v.test(command)
      );

      await parser.runConsole();

      // Perform any cleanup:
      await unlink('myJob.sbatch').catch(() => undefined);
      await unlink('thirdOutput.txt').catch(() => undefined);

      await text({
         message: 'Press enter to continue...',
         placeholder: ' '
      });
   }
}
