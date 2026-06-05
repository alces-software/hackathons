import { Command } from '@oclif/core';
import { exec } from 'node:child_process';
import { mkdirSync, readFile, writeFile, writeFileSync } from 'node:fs';
import os from 'node:os';

import QueueWatcher from '../../services/queue/index.js';

/**
 * @param {object} job
 * @param {string} message 
 */
function handleMessage(job, message) {
  const historyFile = `/home/${job.user}/slurmHistory/history`;
  const motdFile = `/tmp/messages/${job.user}-MOTD`;
  const commandMessageFile = `/tmp/messages/${job.user}`;

  exec(`who | awk -v user="${job.user}" '$1==user {print "/dev/"$2}'`, (err, stdout) => {
    const sessions = err ? [] : stdout.trim().split("\n").filter(Boolean);

    if (sessions.length > 0) {
      readFile(commandMessageFile, 'utf8', (err, data) => {
        writeFileSync(commandMessageFile, data ? data + message : message);
      });
      for (const tty of sessions) {
        writeFile(tty, "\u0007", () => { });
      }
    } else {
      readFile(motdFile, 'utf8', (err, data) => {
        writeFileSync(motdFile, data ? data + message : message);
      });
    }

    readFile(historyFile, (err, data) => {
      writeFileSync(historyFile, data ? data + message : message);
    });
  });
}

export default class JobWatch extends Command {
  static description = 'Watch HPC job queue in real time'

  async run() {
    const watcher = new QueueWatcher(100);
    mkdirSync('/tmp/messages', { recursive: true });
    mkdirSync(`${os.homedir()}/slurmHistory/`, { recursive: true });

    watcher.on('job:added', job => {
      handleMessage(job, `
      ========================================
        JOB ADDED TO QUEUE
      ----------------------------------------
        Job ID      :  ${job.id}
        Job Name    :  ${job.name}
        Time Limit  :  ${job.timeLimit}
        Timestamp   :  ${job.timestamp}
      ========================================
      \n`);
    });

    watcher.on('job:started', job => {
      handleMessage(job, `
      ========================================
        JOB STARTED
      ----------------------------------------
        Job ID      :  ${job.id}
        Job Name    :  ${job.name}
        Time Limit  :  ${job.timeLimit}
        Timestamp   :  ${job.timestamp}
      ========================================
      \n`);
    });

    watcher.on('job:finished', job => {
      handleMessage(job, `
      ========================================
        JOB COMPLETED SUCCESSFULLY
      ----------------------------------------
        Job ID     :  ${job.id}
        Job Name   :  ${job.name}
        Time       :  ${job.elapsed} / ${job.timeLimit}
        Timestamp  :  ${job.timestamp}
      ========================================
      \n`);
    });

    watcher.on('job:failed', job => {
      handleMessage(job, `
      ========================================
        JOB FAILED
      ----------------------------------------
        Job ID     :  ${job.id}
        Job Name   :  ${job.name}
        Time       :  ${job.elapsed} / ${job.timeLimit}
        Timestamp  :  ${job.timestamp}
      ========================================
      \n`);
    });

    watcher.on('error', err => {
      this.error(err);
    });

    this.log('Watching queue... press Ctrl+C to stop');

    watcher.start();

    await new Promise(() => { });
  }
}