const extractData = require('./methods/extractData');
const increment = require('./methods/increment');
const stats = require('./methods/stats');
const specific = require('./methods/specific');
const handleAchievements = require('./methods/handleAchievements');

(async () => {
    const data = extractData(process.argv);

    const toSubmit = []

    // Increment values and check values against achievements (total number of commands run, times this specific command was run)
    toSubmit.push(...await increment(data));

    // Store stats of command (length, arguments, etc) and check against achievements
    toSubmit.push(...await stats(data));

    // Check command against specific achievement conditions
    toSubmit.push(...await specific(data));

    handleAchievements(toSubmit, data);
})();