const { Command } = require("commander");

const ScontrolShowJobParser = require('./parsers/scontrolShowJob');
const ScontrolShowNodeParser = require('./parsers/scontrolShowNode');
const SinfoParser = require('./parsers/sinfo');
const SqueueParser = require('./parsers/squeue');

const explainJobFields = require('./descriptions/jobFields')
const explainNodeFields = require('./descriptions/nodeFields')

const command = "slhelp"

const program = new Command();

program
    .name("slhelp")
    .description("Learn common Slurm commands")
    .version("1.0.0")

const sinfo = new Command("sinfo")
    .description("Explain sinfo output")
    .action(() => {
        const parser = new SinfoParser();
        console.log("Running sinfo -Nl will output the following:\n");
        console.log(parser.data);
        console.log("\nHere is what this means:\n");
        console.log(parser.explain());
        console.log();
        console.log(`Run "${command} sinfo node <node>" for more information about a node`);
        console.log(`More information about nodes can be found using scontrol. Run "${command} scontrol-show-node <node>" for more info`);
        console.log(`Run "${command} sinfo column <column>" for a definition of a column`);
    });

    sinfo
        .command("node <node>")
        .description("Explain a specific node")
        .action(node => {
            const parser = new SinfoParser();
            console.log(parser.explainNode(node));
        });

    sinfo
        .command("column <column>")
        .description("Explain a column")
        .action(column => {
            const parser = new SinfoParser();
            console.log(parser.explainColumn(column));
        });


const scontrolShowNode = new Command("scontrol-show-node")
    .description("Explain \"scontrol show node\" output")
    .argument("<node>")
    .action((node) => {
        const parser = new ScontrolShowNodeParser(node);
        console.log(`Running "scontrol show node ${node}" will show the following:\n`);
        console.log(parser.data);
        console.log("\nHere is what this means\n");
        console.log(parser.explain());
        console.log();
        console.log(`Run "${command} scontrol-show-node field <field>" for a definition of the field`);
    });

    scontrolShowNode
        .command("field <field>")
        .description("Explain fields in scontrol show node")
        .action((field) => {
            console.log(explainNodeFields(field));
        });

const squeue = new Command("squeue")
    .description("Explain squeue output")
    .action(() => {
        const parser = new SqueueParser();
        console.log("Running \"squeue\" wil show the following:\n");
        console.log(parser.data);
        console.log("\nHere is what this means\n");
        console.log(parser.explain());
        console.log();
        console.log(`Run "${command} squeue job <job>" for information about a specific job`);
        console.log(`Run "${command} squeue state <state>" for information about a state`);
        console.log(`Run "${command} squeue column <column >" for information about a column`);
    });

    squeue
        .command("job <job>")
        .description("Give more information about a specific job")
        .action((job) => {
            const parser = new SqueueParser();
            console.log(parser.explainJob(job))
        });

    squeue
        .command("state <state>")
        .description("Explain what a state means")
        .action((state) => {
            const parser = new SqueueParser();
            console.log(parser.explainState(state))
        });

    squeue
        .command("column <column>")
        .description("Explain a column")
        .action((column) => {
            const parser = new SqueueParser();
            console.log(parser.explainColumn(column))
        });

const scontrolShowJob = new Command("scontrol-show-job")
    .description("Explain \"scontrol show job\" output")
    .argument("<id>")
    .action((id) => {
        const parser = new ScontrolShowJobParser(id);
        console.log(`Running "scontrol show job ${id}" will show the following:\n`);
        console.log(parser.data);
        console.log("\nHere is what this means\n");
        console.log(parser.explain());
        console.log();
        console.log(`Run "${command} scontrol-show-job field <field>" for a definition of the field`);
    });

    scontrolShowJob
        .command("field <field>")
        .description("Explain fields in scontrol show node")
        .action((field) => {
            console.log(explainJobFields(field));
        });


program.addCommand(sinfo);
program.addCommand(scontrolShowNode);
program.addCommand(squeue);
program.addCommand(scontrolShowJob);
program.parse();