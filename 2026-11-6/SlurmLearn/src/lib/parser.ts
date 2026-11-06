import { ux } from '@oclif/core';
import { createInterface, type Interface } from 'node:readline';

type StrCallback = (x: string) => void;

export default class ParserObj {
   private readonly onStderr: StrCallback;
   private readonly onStdout: StrCallback;
   private rl!: Interface;

   constructor(onStdout: StrCallback, onStderr: StrCallback) {
      this.onStdout = onStdout;
      this.onStderr = onStderr;
   }

   private get prompt(): string {
      return (
         [
            ux.colorize('green', '[user@project'),
            ux.colorize('blue', '~'),
            ux.colorize('green', ']'),
            ux.colorize('bold', '$')
         ].join(' ') + ' '
      );
   }

   async runConsole(): Promise<void> {
      this.rl = createInterface({
         historySize: 100,
         input: process.stdin,
         output: process.stdout,
         terminal: true
      });

      this.rl.setPrompt(this.prompt);
      this.rl.prompt();

      for await (const line of this.rl) {
         const command = line.trim();

         if (command === 'exit') {
            break;
         }

         if (command) {
            await this.execute(command);
         }

         this.rl.setPrompt(this.prompt);
         this.rl.prompt();
      }
   }

   private async execute(command: string): Promise<void> {
      try {
         const [name, ...args] = command.split(/\s+/v);

         switch (name) {
            case 'help': {
               this.onStdout('Available commands: help, exit');
               break;
            }

            default: {
               this.onStderr(`Unknown command: ${name}`);
            }
         }
      } catch (error) {
         this.onStderr(error instanceof Error ? error.message : String(error));
      }
   }
}
