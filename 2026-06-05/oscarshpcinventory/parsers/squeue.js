const { execSync }= require('child_process');

class SqueueParser {
    constructor() {
        const data = getSqueueOutput();
        this.data = data;
        const lines = data.trim().split("\n");

        this.header = lines[0].trim().split(/\s+/);

        this.jobs = lines.slice(1).map(line => {
            const cols = line.trim().split(/\s+/);

            return {
                jobId: Number(cols[0]),
                partition: cols[1],
                name: cols[2],
                user: cols[3],
                state: cols[4],
                time: cols[5],
                nodes: Number(cols[6]),
                nodeList: cols.slice(7).join(" ")
            };
        });
    }

    numJobs() {
        return this.jobs.length;
    }

    getJob(jobId) {
        return this.jobs.find(job => job.jobId === jobId);
    }

    jobsByState(state) {
        return this.jobs.filter(job => job.state === state);
    }

    jobsByPartition(partition) {
        return this.jobs.filter(job => job.partition === partition);
    }

    jobsByUser(user) {
        return this.jobs.filter(job => job.user === user);
    }

    countByState() {
        return this.jobs.reduce((counts, job) => {
            counts[job.state] = (counts[job.state] || 0) + 1;
            return counts;
        }, {});
    }

    explainState(state) {
        const explanations = {
            R: "Running. The job is currently executing on one or more nodes.",
            PD: "Pending. The job is waiting for resources or scheduling.",
            CG: "Completing. The job has finished and is cleaning up.",
            CD: "Completed. The job finished successfully.",
            F: "Failed. The job terminated with an error."
        };

        return explanations[state] ?? "Unknown state.";
    }

    explainJob(jobId) {
        const job = this.getJob(jobId);

        if (!job) {
            return `Job ${jobId} not found.`;
        }

        return `
Job ${job.jobId}

Name: ${job.name}
User: ${job.user}
Partition: ${job.partition}

State: ${job.state}
Meaning: ${this.explainState(job.state)}

Runtime: ${job.time}
Nodes: ${job.nodes}
Location: ${job.nodeList}
`.trim();
    }

    explainRow(job) {
        return `
Job ${job.jobId} (${job.name})

Submitted by: ${job.user}
Partition: ${job.partition}

State: ${job.state}
Meaning: ${this.explainState(job.state)}

Runtime: ${job.time}
Allocated nodes: ${job.nodes}
Node(s): ${job.nodeList}
`.trim();
    }

    explain() {
        const states = Object.entries(this.countByState())
            .map(([state, count]) => `- ${state}: ${count}`)
            .join("\n");

        return `
Queue Summary
-------------

Total jobs: ${this.numJobs()}

Job States:
${states}

Running jobs: ${this.jobsByState("R").length}
Pending jobs: ${this.jobsByState("PD").length}
`.trim();
    }

    explainColumn(column) {
        const explanations = {
            JOBID: "Unique identifier for the job.",
            PARTITION: "Partition (queue) the job was submitted to.",
            NAME: "Name of the job.",
            USER: "Owner of the job.",
            ST: "Current state of the job.",
            TIME: "Elapsed runtime.",
            NODES: "Number of nodes allocated.",
            "NODELIST(REASON)": "Allocated node(s) or reason the job is pending."
        };

        return explanations[column] ?? "No description available.";
    }
}

function getSqueueOutput() {
    const data = execSync('ssh -A rndhub "ssh cognition \'squeue\'" 2> /dev/null', { 
        encoding: 'utf-8'
    });
    return data
}

module.exports = SqueueParser;