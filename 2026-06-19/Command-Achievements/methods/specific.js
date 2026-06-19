module.exports = (data) => {
    const earned = [];

    const args = data.command.split(/\s+/);

    const badCommands= [
        "rm -rf /",
        "rm -rf /*",
        "dd if=/dev/zero of=/dev/sda",
        "dd if=/dev/random of=/dev/sda",
        "mkfs.ext4 /dev/sda",
        ":(){ :|:& };:",
        "chmod -R 777 /",
        "chown -R $USER:$USER /",
        "mv /home/* /dev/null",
        "wipefs -a /dev/sda",
        "shred -vfz /dev/sda",
        "echo \"something\" > /dev/sda",
        "find / -name \"*.log\" -delete",
        "dnf remove --allowerasing '*'"
    ];

    if (badCommands.includes(data.command)) {
        earned.push({
            name: "Oops",
            description: "That was a bad idea...",
            type: "Achievement",
            id: 221
        })
    };

    if (args[0] === "vim") {
        earned.push({
            name: "Open Vim",
            description: "Good luck quitting",
            type: "Achievement",
            id: 222
        })
    }

    if (args[0] === "nano") {
        earned.push({
            name: "Open Nano",
            description: "Should have used vim",
            type: "Achievement",
            id: 223
        })
    }

    const slurmCommands = [
        "sinfo",
        "squeue",
        "srun",
        "sbatch",
        "scancel",
        "scontrol",
        "sacct",
        "salloc",
        "sstat",
        "sprio",
        "smap",
        "sview",
        "sreport",
        "sacctmgr",
    ]

    if (slurmCommands.includes(args[0])) {
        earned.push({
            name: "First Slurm",
            description: "Run your first slurm command",
            type: "Achievement",
            id: 224
        })
    }

    const numPipes = data.command.split('|').length - 1;
    if (numPipes >= 3) {
        earned.push({
            name: "Plumber",
            description: "Use 3 or more pipes in one command",
            type: "Achievement",
            id: 225
        })
    }


    return earned;
}