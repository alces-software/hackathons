const { execSync }= require('child_process');
const { error } = require('console');

class ScontrolNodeParser {
    constructor(node) {
        const data = getScontrolOutput(node);
        this.data = data
        this.fields = {};

        const matches = data.matchAll(/([A-Za-z\/:]+)=([^\s]+)/g);

        for (const [, key, value] of matches) {
            this.fields[key] = value;
        }
    }

    get(key) {
        return this.fields[key];
    }

    explainState(state = this.get("State")) {
        const explanations = {
            IDLE: "The node is available and not currently running jobs.",
            MIXED: "Some resources are allocated while others remain available.",
            ALLOCATED: "All schedulable resources on the node are allocated.",
            DOWN: "The node is unavailable.",
            DRAIN: "The node is being removed from service and will not accept new jobs."
        };

        return explanations[state] ?? "Unknown state.";
    }

    explain() {
        return `
Node ${this.get("NodeName")}

Partition: ${this.get("Partitions")}
State: ${this.get("State")}
Meaning: ${this.explainState()}

Hardware:
- CPUs: ${this.get("CPUTot")}
- Memory: ${(Number(this.get("RealMemory")) / 1024).toFixed(1)} GB
- GPUs: ${this.get("Gres")}
- Architecture: ${this.get("Arch")}

Current Usage:
- Allocated CPUs: ${this.get("CPUAlloc")}
- Allocated Memory: ${this.get("AllocMem")}
- CPU Load: ${this.get("CPULoad")}

Resources:
- Configured TRES: ${this.get("CfgTRES")}
- Allocated TRES: ${this.get("AllocTRES")}

System:
- Boot Time: ${this.get("BootTime")}
- Last Busy Time: ${this.get("LastBusyTime")}
`.trim();
    }
}

function getScontrolOutput(node) {
    try {
        const data = execSync(`ssh -A rndhub "ssh cognition 'scontrol show node ${node}'" 2> /dev/null`, { 
            encoding: 'utf-8'
        });
        return data
    } catch {
        throw new Error("Invalid Node");
    }
}

module.exports = ScontrolNodeParser;