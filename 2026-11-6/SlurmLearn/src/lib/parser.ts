import { ux } from '@oclif/core';
import { exec, type ExecException, execSync } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { promisify } from 'node:util';

type StrCallback = (x: string) => void;
type ArrayCallback = (x: string[]) => void;
export type HandoffHandler = (command: string) => boolean;

// eslint-disable-next-line @typescript-eslint/strict-void-return
const execAsync = promisify(exec);

export default class ParserObj {
   private readonly canHandoff: HandoffHandler | undefined;
   private readonly onAnswer: ArrayCallback | undefined;
   private readonly onStderr: StrCallback;
   private readonly onStdout: StrCallback;
   private rl: Interface | undefined;
   private stopped = false;

   constructor(
      onStdout: StrCallback,
      onStderr: StrCallback,
      onAnswer?: ArrayCallback,
      canHandoff?: HandoffHandler
   ) {
      this.onStdout = onStdout;
      this.onStderr = onStderr;
      this.onAnswer = onAnswer;
      this.canHandoff = canHandoff;
   }

   private get prompt(): string {
      return (
         [
            ux.colorize('green', '[explorer@SlurmLearn'),
            ux.colorize('blue', '~'),
            ux.colorize('green', ']'),
            ux.colorize('bold', '$')
         ].join(' ') + ' '
      );
   }

   async runConsole(answer?: string): Promise<void> {
      this.stopped = false;

      const rl = createInterface({
         historySize: 100,
         input: process.stdin,
         output: process.stdout,
         terminal: true
      });

      this.rl = rl;

      rl.setPrompt(this.prompt);
      rl.prompt();

      // Set when a command is handed to the real terminal (e.g. nano) instead of being captured
      let rawCommand: string | undefined;

      try {
         for await (const line of rl) {
            if (this.stopped) break;

            const [command, ...args] = line.trim().split(' ');

            if (command === 'exit') {
               break;
            }

            if (command === 'answer' && this.onAnswer !== undefined) {
               this.onAnswer(args);
               continue;
            }

            if (command) {
               if (this.canHandoff?.(line.trim())) {
                  rawCommand = line.trim();
                  break;
               }

               await this.execute(line.trim());
            }

            // Don't display another prompt if stopped
            if (this.stopped) break;

            rl.setPrompt(this.prompt);
            rl.prompt();
         }
      } finally {
         rl.close();
         this.rl = undefined;
      }

      if (rawCommand !== undefined && !this.stopped) {
         // Hand the whole terminal over to the command (e.g. nano) until it exits
         try {
            execSync(rawCommand, { stdio: 'inherit' });
         } catch {
            // Non-zero exit or missing binary: just continue once it returns
         }

         await this.runConsole();
      }
   }

   // Stop the console
   stop(): void {
      this.stopped = true;
      this.rl?.close();
   }

   private async execute(command: string): Promise<void> {
      try {
         const { stderr, stdout } = await execAsync(command);

         if (stdout) {
            this.onStdout(stdout);
         }

         if (stderr) {
            this.onStderr(stderr);
         }
      } catch (error: unknown) {
         const execError = error as ExecException;

         if (execError.stdout) {
            this.onStdout(execError.stdout);
         }

         if (execError.stderr) {
            this.onStderr(execError.stderr);
         }
      }
   }
}
