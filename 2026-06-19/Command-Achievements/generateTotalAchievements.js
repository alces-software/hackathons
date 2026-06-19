const fs = require("fs/promises");

(async () => {

    const milestones = [1, 5, 10, 25, 50, 100, 200, 500, 1000];

    const idDict = {}

    for (const milestone of milestones) {
        const body = {
            title: `RunX${milestone}`,
            description: `You have run ${milestone} command${(milestone> 1) ? 's' : ''}`
        }

        const res = await fetch('http://localhost:3000/achievement', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await res.json()

        idDict[milestone] = data["data"];
    }

    fs.writeFile('./achievementTotalIds.json', JSON.stringify(idDict, null, 2));

})();
