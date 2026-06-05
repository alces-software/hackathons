/* eslint-disable unicorn/prefer-event-target */
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

class QueueWatcher extends EventEmitter {
   constructor(interval = 1000) {
      super();
      this.interval = interval;
      this.previous = new Map();
   }

   diff(prev, curr) {
      for (const [id, job] of prev) {
         if (!curr.has(id)) {
            this.emit('job:finished', { id, ...job });
         }
      }

      // new or changed jobs
      for (const [id, job] of curr) {
         if (prev.has(id)) {
            const old = prev.get(id);

            if (old.state !== job.state) {
               this.emit('job:stateChange', {
                  from: old.state,
                  id,
                  job,
                  to: job.state
               });

               if (old.state === 'PD' && job.state === 'R') {
                  this.emit('job:started', { id, ...job });
               }

               if (job.state === 'FAILED' || job.state === 'F') {
                  this.emit('job:failed', { id, ...job });
               }
            }
         } else {
            this.emit('job:added', { id, ...job });
         }
      }
   }

   async poll() {
      return new Promise((resolve, reject) => {
         const squeue = spawn('squeue', [
            '-h',
            '-o',
            '%i|%u|%t|%j|%M|%l'
         ]);

         let output = '';
         let error = '';

         squeue.stdout.on('data', chunk => {
            output += chunk;
         });

         squeue.stderr.on('data', chunk => {
            error += chunk;
         });

         squeue.on('close', code => {
            if (code !== 0) {
               reject(new Error(error));
               return;
            }

            const current = new Map();

            for (const line of output.trim().split('\n')) {
               if (!line) continue;

               const [id, user, state, name, elapsed, timeLimit] =
                  line.split('|');

               current.set(id, {
                  elapsed,
                  name,
                  state,
                  timeLimit,
                  timestamp: new Date().toLocaleString('en-GB'),
                  user
               });
            }

            resolve(current);
         });
      });
   }

   start() {
      this.poll();

      this.timer = setInterval(async () => {
         try {
            const current = await this.poll();

            this.diff(this.previous, current);
            this.previous = current;
         } catch (error) {
            this.emit('error', error);
         }
      }, this.interval);
   }

   stop() {
      clearInterval(this.timer);
   }
}

export default QueueWatcher;