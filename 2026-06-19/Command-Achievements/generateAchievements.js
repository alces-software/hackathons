const fs = require("fs/promises");

(async () => {

    const commands = [
        "ls",
        "cd",
        "pwd",
        "mkdir",
        "rmdir",
        "rm",
        "cp",
        "mv",
        "touch",
        "cat",
        "less",
        "more",
        "head",
        "tail",
        "grep",
        "find",
        "chmod",
        "chown",
        "ps",
        "top",
        "kill",
        "df",
        "du",
        "uname",
        "whoami",
        "id",
        "echo",
        "tar",
        "gzip",
        "wget",
        "curl",
        "man",
        "history",
        "alias",
        "exit"
    ];

    const milestones = [1, 5, 10, 25, 50, 100];

    const idDict = {}

    for (const command of commands) {
        idDict[command] = {}
        for (const milestone of milestones) {
            const body = {
                title: `${command} RunX${milestone}`,
                description: `You have run ${command} ${milestone} time${(milestone> 1) ? 's' : ''}`
            }

            const res = await fetch('http://localhost:3000/achievement', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            const data = await res.json()

            idDict[command][milestone] = data["data"];
        }
    }

    fs.writeFile('./achievementIds.json', JSON.stringify(idDict, null, 2));

})();
