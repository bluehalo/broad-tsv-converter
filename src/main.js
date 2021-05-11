const chalk = require('chalk');
const path = require('path');
const readline = require('readline');

const logger = require('./services/logger')('w', '  main  ');
const tsvConverter = require('./scripts/tsv-to-xml');
const ncbiUploader = require('./scripts/ncbi-uploader');
const cmdParser = require('./scripts/command-parser');

// Options Variables
const argv = process.argv.slice(2);
let submissionParams = {
    poll: 'all',
    uploaded: false,
    selectedAction: 'AddData' // AddFiles, ChangeStatus
};

const fns = {
    processRequest: async () => {
        if (!submissionParams.inputFilename && (!submissionParams.uploadFiles || submissionParams.uploadFiles.length === 0)) {
            throw new Error('Invalid Input: Either inputFilename (-i) or uploadFiles (-f) must be declared');
        }

        try {
            if (submissionParams.inputFilename) {
                let data = await tsvConverter.process(submissionParams);
                ncbiUploader.processRequest(submissionParams, data);
            }
            else {
                ncbiUploader.processRequest(submissionParams);
            }
        } catch (error) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0, null);
            logger.log(`There was an error: ${error.message}`);
            logger.debug(error.stack, submissionParams.debug)
        }
    }
}


//--------------------------------------------------
// Execute
//--------------------------------------------------
let execute = async () => {
    try {
        submissionParams = cmdParser.extractRequestVariables(argv);
        await fns.processRequest();
    } catch (err) {
        logger.log(chalk.red(`\n\nThere was an error: `) + err.message);
        logger.debug(err.stack, submissionParams.debug)
        return;
    }
};

execute();