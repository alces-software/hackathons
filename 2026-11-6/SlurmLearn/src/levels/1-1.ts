import ParserObj from '../lib/parser.js';

export default async function level_1_1(log: (message: string) => void) {
   // Setup stuff here:

   // Issue challenge:
   log('Run a command that prints "hello" to the console');

   const parser = new ParserObj(
      (x: string) => {
         const out = x.slice(0, -1);
         log(out);
         if (out === 'hello') {
            log('Well Done!');
            parser.stop();
         }
      },
      (x) => {
         log(x);
      }
   );

   await parser.runConsole();

   // Perform any cleanup:
}
