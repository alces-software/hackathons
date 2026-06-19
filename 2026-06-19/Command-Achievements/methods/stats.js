module.exports = async (data) => {
    const achievements = await require('./achievements')();
    const earned = [];

    const commandLength = data.command.length;
    const numArguments = data.command.split(/\s+/).length - 1;
    
    if (commandLength > achievements.data.longestCommand) {
        achievements.data.longestCommand = commandLength;
        earned.push({
            name: "Longest Command",
            description: `That's a new longest command! ${commandLength} characters!`,
            type: "Personal Best",
            stat: commandLength
        })
    }

    if (numArguments > achievements.data.mostArguments) {
        achievements.data.mostArguments = numArguments;
        earned.push({
            name: "Most Arguments",
            description: `Thats a new best for number of arguments! ${numArguments} arguments!`,
            type: "Personal Best",
            stat: numArguments
        })
    }

    await achievements.save();
    return earned;
}