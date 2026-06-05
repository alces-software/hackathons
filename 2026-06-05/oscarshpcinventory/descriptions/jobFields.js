function explainField(field) {
    const descriptions = {
        JobId: "Unique identifier assigned to the job.",
        JobName: "User-specified name of the job.",

        UserId: "User who submitted the job and their numeric UID.",
        GroupId: "Primary group associated with the job and its GID.",
        MCS_label: "Multi-Category Security label applied to the job.",

        Priority: "Scheduling priority assigned to the job.",
        Nice: "User-specified adjustment to the job's priority.",
        Account: "Account charged for the job's resource usage.",
        QOS: "Quality of Service associated with the job.",

        JobState: "Current state of the job.",
        Reason: "Why the job is in its current state.",
        Dependency: "Job dependencies that must be satisfied before execution.",

        Requeue: "Whether the job may be requeued if interrupted.",
        Restarts: "Number of times the job has been restarted.",
        BatchFlag: "Indicates whether this is a batch job.",
        Reboot: "Whether nodes should be rebooted before the job starts.",
        ExitCode: "Exit status returned by the job.",

        RunTime: "Amount of time the job has been running.",
        TimeLimit: "Maximum runtime allowed for the job.",
        TimeMin: "Minimum runtime requested by the user.",

        SubmitTime: "When the job was submitted.",
        EligibleTime: "When the job became eligible to run.",
        AccrueTime: "When priority accrual began for the job.",

        StartTime: "When Slurm expects the job to start or when it started.",
        EndTime: "Expected or actual completion time.",
        Deadline: "Latest time by which the job must complete.",

        SuspendTime: "Time when the job was suspended.",
        SecsPreSuspend: "Seconds the job ran before suspension.",
        LastSchedEval: "Last time the scheduler evaluated the job.",
        Scheduler: "Scheduler responsible for the decision.",

        Partition: "Partition (queue) where the job was submitted.",
        "AllocNode:Sid": "Node and session that submitted the job.",

        ReqNodeList: "Specific nodes requested by the user.",
        ExcNodeList: "Nodes excluded from allocation.",
        NodeList: "Nodes currently allocated to the job.",
        SchedNodeList: "Nodes the scheduler intends to allocate.",

        NumNodes: "Number of nodes requested or allocated.",
        NumCPUs: "Total CPUs requested.",
        NumTasks: "Total number of tasks requested.",
        "CPUs/Task": "CPUs allocated to each task.",
        "ReqB:S:C:T": "Requested Boards:Sockets:Cores:Threads layout.",

        ReqTRES: "Trackable RESources requested by the job.",
        AllocTRES: "Trackable RESources allocated to the job.",

        "Socks/Node": "Sockets requested per node.",
        "NtasksPerN:B:S:C": "Task layout per Node:Board:Socket:Core.",
        CoreSpec: "Specialized cores reserved from user jobs.",

        MinCPUsNode: "Minimum CPUs required on each node.",
        MinMemoryNode: "Minimum memory required on each node.",
        MinTmpDiskNode: "Minimum temporary disk space required per node.",

        Features: "Required node features.",
        DelayBoot: "Maximum time Slurm may wait before booting nodes.",

        OverSubscribe: "Whether resources may be shared with other jobs.",
        Contiguous: "Whether allocated nodes must be contiguous.",
        Licenses: "Software licenses required by the job.",
        LicensesAlloc: "Licenses allocated to the job.",
        Network: "Network requirements for the job.",

        Command: "Script or executable launched by the job.",
        WorkDir: "Working directory when the job starts.",

        StdErr: "Path where standard error is written.",
        StdIn: "Path used as standard input.",
        StdOut: "Path where standard output is written.",

        TresPerNode: "TRES requested on each node.",
        TresPerTask: "TRES requested for each task."
    };

    return descriptions[field] ?? "No description available.";
}

module.exports = explainField;