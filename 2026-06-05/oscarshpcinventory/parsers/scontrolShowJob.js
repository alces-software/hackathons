const { execSync }= require('child_process');

class ScontrolJobParser {
    constructor(id) {
        const data = getScontrolOutput(id);
        this.data = data;
        this.fields = {};

        const matches = data.matchAll(/([A-Za-z\/:]+)=([^\s]+)/g);

        for (const [, key, value] of matches) {
            this.fields[key] = value;
        }
    }

    get(key) {
        return this.fields[key];
    }

    explainState(state = this.get("JobState")) {
        const explanations = {
            PENDING: "The job is waiting for resources.",
            RUNNING: "The job is currently running.",
            COMPLETED: "The job completed successfully.",
            FAILED: "The job exited with an error.",
            CANCELLED: "The job was cancelled."
        };

        return explanations[state] ?? "Unknown state.";
    }

    explain() {
        return `
Job ${this.get("JobId")} (${this.get("JobName")})

User: ${this.get("UserId")?.split("(")[0]}
Partition: ${this.get("Partition")}

State: ${this.get("JobState")}
Reason: ${this.get("Reason")}
Meaning: ${this.explainState()}

Requested Resources:
- CPUs: ${this.get("NumCPUs")}
- Nodes: ${this.get("NumNodes")}
- TRES: ${this.get("ReqTRES")}

Timing:
- Submitted: ${this.get("SubmitTime")}
- Expected Start: ${this.get("StartTime")}
- Time Limit: ${this.get("TimeLimit")}
`.trim();
    }
}

function getScontrolOutput(id) {
    const data = execSync(`ssh -A rndhub "ssh cognition 'scontrol show job ${id}'" 2> /dev/null`, { 
        encoding: 'utf-8'
    });
    return data
}

module.exports = ScontrolJobParser