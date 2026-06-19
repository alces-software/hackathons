const fs = require("fs/promises");

(async () => {

    const body = {
        title: "Plumber",
        description: "Use 3 or more pipes in one command",
    }

    const res = await fetch('http://localhost:3000/achievement', {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await res.json()

    console.log(data)
})();