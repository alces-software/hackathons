import QueueWatcher from './queue/index.js';

const watcher = new QueueWatcher();

watcher.on('job:added', j => {
   console.log('NEW:', j);
});

watcher.on('job:started', j => {
   console.log('STARTED:', j);
});

watcher.on('job:finished', j => {
   console.log('DONE:', j);
});

watcher.on('job:failed', j => {
   console.log('FAILED:', j);
});

watcher.start();