module.exports = async (achievements, data) => {
    // Get user ID

    const res = await fetch(`http://localhost:3000/user/exist?username=${data.user}`);
    const userExists = await res.json();

    let userId = -1;

    if (userExists.success) {
        userId = userExists.data;
    } else {
        const body = {username: data.user};
        const res = await fetch('http://localhost:3000/user', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const response= await res.json();

        userId = response.data;
    }

    // Post achievement for each achievement
    for (const achievement of achievements) {

        // Check to see if it's an achievement or personal best

        if (achievement.type === "Achievement") {
            // Check to see if they have the achievement yet

            const hasAchievementRes = await fetch(`http://localhost:3000/user/has/achievement?id=${userId}&achievement=${achievement.id}`);
            const hasAchievementJson = await hasAchievementRes.json();

            if (!hasAchievementJson.data){
                console.log(`You got a new achievement!!\n\n${achievement.name}:\n${achievement.description}`)
            }
            const body = {
                id: userId,
                achievement: achievement.id
            }
            const res = await fetch('http://localhost:3000/user/achieved', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });
        } else {
            console.log(`You got a new Personal Best!!\n${achievement.name}:\n\n${achievement.description}`)
        }
    }
}