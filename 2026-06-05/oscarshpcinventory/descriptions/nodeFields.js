function explainField(field) {
    const descriptions = {
        NodeName: "Name of the node.",
        Arch: "CPU architecture of the node.",
        CoresPerSocket: "Number of CPU cores per socket.",

        CPUAlloc: "Number of CPUs currently allocated to jobs.",
        CPUEfctv: "Number of CPUs available for scheduling.",
        CPUTot: "Total number of CPUs on the node.",
        CPULoad: "Current CPU load average.",

        AvailableFeatures: "Features configured for this node that jobs may request.",
        ActiveFeatures: "Features currently active on the node.",

        Gres: "Generic RESources available on the node, such as GPUs.",

        NodeAddr: "Network address used by Slurm to contact the node.",
        NodeHostName: "Hostname of the node.",
        Version: "Version of the Slurm daemon running on the node.",

        OS: "Operating system and kernel version running on the node.",

        RealMemory: "Total installed memory in MB.",
        AllocMem: "Memory currently allocated to jobs in MB.",
        FreeMem: "Estimated free memory available in MB.",

        Sockets: "Number of CPU sockets.",
        Boards: "Number of system boards.",

        State: "Current state of the node.",
        ThreadsPerCore: "Number of hardware threads per CPU core.",
        TmpDisk: "Amount of temporary local disk space available in MB.",
        Weight: "Scheduling weight used when selecting nodes.",
        Owner: "Owner of the node, if applicable.",
        MCS_label: "Multi-Category Security label assigned to the node.",

        Partitions: "Partitions that this node belongs to.",

        BootTime: "Time when the node was last booted.",
        SlurmdStartTime: "Time when the Slurm daemon started on the node.",

        LastBusyTime: "Last time the node was actively running jobs.",
        ResumeAfterTime: "Time when a suspended node will automatically resume.",

        CfgTRES: "Trackable resources configured on the node.",
        AllocTRES: "Trackable resources currently allocated to jobs.",

        CurrentWatts: "Current power consumption in watts.",
        AveWatts: "Average power consumption in watts."
    };

    return descriptions[field] ?? "No description available.";
}

module.exports = explainField;