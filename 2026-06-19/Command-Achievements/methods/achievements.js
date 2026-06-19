const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const dir = path.join(os.homedir(), ".achievements");
const file = path.join(dir, "data.json");

async function setupPath() {
    const templateFile = path.join(process.cwd(), "statsTemplate.json");

    // Ensure folder exists
    await fs.mkdir(dir, { recursive: true });

    // Ensure file exists
    try {
        await fs.access(file);
    } catch {
        await fs.copyFile(templateFile, file);
    }
}

async function loadData() {
    await setupPath();

    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw || "{}");
}

async function saveData(data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

module.exports = async () => {
    const data = await loadData();

    return {
        data,
        save: () => saveData(data)
    };
};