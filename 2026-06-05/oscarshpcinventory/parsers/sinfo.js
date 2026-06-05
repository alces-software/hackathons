const { execSync }= require('child_process');

class SinfoParser {
    constructor() {
        const data = getSinfoOutput();
        const lines = data.trim().split("\n");

        this.data = data;
        this.timestamp = lines[0];
        this.header = lines[1].trim().split(/\s+/);

        this.nodes = lines.slice(2).map(line => {
            const [
                node,
                nodes,
                partition,
                state,
                cpus,
                socketsCoresThreads,
                memoryMB,
                tmpDiskMB,
                weight,
                availFeatures,
                reason
            ] = line.trim().split(/\s+/);

            return {
                node,
                nodes: Number(nodes),
                partition,
                state,
                cpus: Number(cpus),
                socketsCoresThreads,
                memoryMB: Number(memoryMB),
                tmpDiskMB: Number(tmpDiskMB),
                weight: Number(weight),
                availFeatures,
                reason
            };
        });
    }

    numNodes() {
        return this.nodes.length;
    }

    getNode(name) {
        return this.nodes.find(node => node.node === name);
    }

    getPartitions() {
        return [...new Set(this.nodes.map(node => node.partition))];
    }

    nodesInPartition(partition) {
        return this.nodes.filter(node => node.partition === partition);
    }

    countByState() {
        return this.nodes.reduce((counts, node) => {
            counts[node.state] = (counts[node.state] || 0) + 1;
            return counts;
        }, {});
    }

    totalCPUs() {
        return this.nodes.reduce((sum, node) => sum + node.cpus, 0);
    }

    totalMemoryMB() {
        return this.nodes.reduce((sum, node) => sum + node.memoryMB, 0);
    }

    explainState(state) {
        const explanations = {
            allocated: "All resources on this node are assigned to jobs.",
            mixed: "Some resources are in use while others remain available.",
            idle: "The node is completely free and available for scheduling.",
            down: "The node is unavailable."
        };

        return explanations[state.toLowerCase()] ?? "Unknown state.";
    }

    explainColumn(column) {
        const explanations = {
            NODELIST: "Hostname of the node.",
            NODES: "Number of nodes represented by this row.",
            PARTITION: "Partition (queue) the node belongs to.",
            STATE: "Current state of the node.",
            CPUS: "Total CPUs available on the node.",
            "S:C:T": "Sockets : Cores : Threads topology.",
            MEMORY: "Installed RAM in MB.",
            TMP_DISK: "Temporary local disk space in MB.",
            WEIGHT: "Scheduling weight.",
            AVAIL_FE: "Available node features.",
            REASON: "Reason for the current state."
        };

        return explanations[column] ?? "No description available.";
    }

    explainNode(name) {
        const node = this.getNode(name);

        if (!node) {
            return `Node '${name}' not found.`;
        }

        return this.explainRow(node);
    }

    explainRow(node) {
        return `
${node.node}

This node belongs to the '${node.partition}' partition.

State: ${node.state}
Meaning: ${this.explainState(node.state)}

Resources:
- CPUs: ${node.cpus}
- Memory: ${(node.memoryMB / 1024).toFixed(1)} GB
- Topology: ${node.socketsCoresThreads}
- Temporary disk: ${node.tmpDiskMB} MB

Reason: ${node.reason}
`.trim();
    }

    explain() {
        const partitions = this.getPartitions()
            .map(partition =>
                `- ${partition}: ${this.nodesInPartition(partition).length} nodes`
            )
            .join("\n");

        const states = Object.entries(this.countByState())
            .map(([state, count]) => `- ${state}: ${count} nodes`)
            .join("\n");

        return `
Cluster Summary
---------------
Timestamp: ${this.timestamp}

Total nodes: ${this.numNodes()}

Partitions:
${partitions}

Node States:
${states}

Resources:
- Total CPUs: ${this.totalCPUs()}
- Total Memory: ${(this.totalMemoryMB() / 1024).toFixed(0)} GB
`.trim();
    }
}

function getSinfoOutput() {
    const data = execSync('ssh -A rndhub "ssh cognition \'sinfo -Nl\'" 2> /dev/null', { 
        encoding: 'utf-8'
    });
    return data
}

module.exports = SinfoParser;