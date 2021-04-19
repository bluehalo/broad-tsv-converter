const config = require('./config');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const logger = require('./services/logger')('w');
const tsvConverter = require('./scripts/tsv-to-xml');
const ncbiUploader = require('./scripts/ncbi-uploader');

// Options Variables
const argv = process.argv.slice(2);
let submissionParams = {
    selectedAction: 'AddData' // AddFiles, ChangeStatus
};

const helptext = `
--------------------------------------------------
  ${chalk.bold.cyanBright(`NCBI TSV UI-less Submitter`)}
--------------------------------------------------

This script is intended to convert the NCBI tsv file format into xml format, and submit it through 
an ftp upload.

https://www.ncbi.nlm.nih.gov/viewvc/v1/trunk/submit/public-docs/common/docs/UI-lessSubmissionProtocol.docx?revision=71197

--------------------------------------------------
  ${chalk.bold.cyanBright(`Script Prerequisites`)}
--------------------------------------------------

Before running the script, you will need to do the following steps:
1. Run \`npm install\`
2. Modify the "src/config.js" file to enter your:
    A. FTP connection information
    B. Organization information
    C. Submitter information
3. Move the TSV files you would like converted into the "files" folder

--------------------------------------------------
  ${chalk.bold.cyanBright(`How to Use`)}
--------------------------------------------------
${chalk.underline(
'Parameter      |    |            | Description        ')}
help           | -h |            | print help table
inputFilename  | -i | (required) | filename for the tsv file to be uploaded
outputFilename | -o | (optional) | filename to write the generated xml file to. Default value will use inputFilename
uploadFolder   | -u | (optional) | if provided, the generated xml file will be uploaded through ftp to the specified folder
uploadComment  | -c | (optional) | description or comment about this submission
releaseDate    | -d | (optional) | All data in this submission is requested to be publicly released on or after this date; example: '2017-01-01'
runTestMode    | -t |            | Run the test mode (skip FTP steps, and run with sample responses)
--------------------------------------------------

Example:
node main.js -i=sample.tsv -c="this is a comment" --uploadFolder=folder

--------------------------------------------------
`;

const fns = {
    //--------------------------------------------------
    // User Input / Set Up
    //--------------------------------------------------
    extractParameters: () => {
        logger.debug(`extracting parameters: ${argv}`)
        if (argv.length === 0) {
            console.log(helptext, false);
            process.exit(1);
        }

        submissionParams.skipFtp = false;

        argv.forEach((arg) => {
            let mapEntry = arg.split('=');
            let key = mapEntry[0].toLowerCase();
            switch(key) {
                case 'input':
                case 'inputfile':
                case '--input':
                case '--inputfile':
                case '-i':
                    submissionParams.inputFilename = mapEntry[1];
                    break;
                case 'output':
                case 'outputfile':
                case '--output':
                case '--outputfile':
                case '-o':
                    submissionParams.outputFilename = mapEntry[1];
                    break;
                case 'action':
                case '--action':
                case '-a':
                    submissionParams.selectedAction = mapEntry[1];
                    break;
                case 'uploadfolder':
                case '--uploadfolder':
                case '-u':
                    submissionParams.uploadFolder = mapEntry[1];
                    break;
                case 'uploadcomment':
                case '--uploadcomment':
                case '-c':
                    submissionParams.comment = mapEntry[1];
                    break;
                case 'hold':
                case '--hold':
                case 'releasedate':
                case '--releasedate':
                case '-d':
                    submissionParams.hold = mapEntry[1];
                    break;
                case 'help':
                case '--help':
                case '-h':
                    logger.log(helptext, false);
                    process.exit(1);
                case 'runtestmode':
                case '--runtestmode':
                case '-t':
                    submissionParams.skipFtp = true;
                    break;
            }
        });
    },

    getInputFile: () => {
        if (!submissionParams.inputFilename) throw new Error('Input Filename is Required'); 

        // strip out the file type
        let splitName = submissionParams.inputFilename.split('.');
        if (splitName[splitName.length - 1].toLowerCase() === 'tsv') {
            splitName.length = splitName.length - 1;
            submissionParams.inputFilename = splitName.join(',');
        }
    },

    getOutputFileDetails: () => {
        submissionParams.outputFilename = submissionParams.outputFilename || submissionParams.inputFilename;
        submissionParams.outputFilepath = path.resolve(__dirname, `../files/${submissionParams.outputFilename}-submission.xml`);
    }
}


//--------------------------------------------------
// Execute
//--------------------------------------------------
let execute = async () => {
    try {
        fns.extractParameters();
        fns.getInputFile();
        fns.getOutputFileDetails();
        let data = await tsvConverter.process(submissionParams);
        ncbiUploader.uploadFile(submissionParams, data);
    } catch (err) {
        logger.log(chalk.red(`\n\nThere was an unexpected error: `) + err.message);
        logger.debug(err.stack)
        return;
    }
};

execute();