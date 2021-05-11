const chalk = require('chalk');
const path = require('path');
const submission = require('./xml-generators/submission');

const logger = require('../services/logger')('w', ' cmdpsr ');

// Options Variables
let submissionParams;

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
uploadFiles    | -f | (required) | (Either input filename or uploadFiles is required, but not both) comma separated list of files to upload
outputFilename | -o | (optional) | filename to write the generated xml file to. Default value will use inputFilename
uploadFolder   | -u | (optional) | if provided, the generated xml file will be uploaded through ftp to the specified folder
uploaded       |    | (optional) | Boolean, file has already been uploaded; just check on status with the same conditions
uploadComment  | -c | (optional) | description or comment about this submission
poll           |    | (optional) | '(number)' | 'all' | 'disabled' - Default value is 'all'. Poll until either this report number is hit or poll until all requests have been completed
processReport  | -p | (optional) | filename for report to convert to tsv - If upload folder is included, it will be downloaded from the FTP, otherwise, the script will look in the local files
releaseDate    | -d | (optional) | All data in this submission is requested to be publicly released on or after this date; example: '2017-01-01'
runTestMode    | -t |            | Run the test mode (skip FTP steps, and run with sample responses)
debug          |    |            | Turn on verbose details
force          |    |            | Force upload / processing, even if validation fails
--------------------------------------------------

Example:
node main.js -i=sample.tsv -c="this is a comment" --uploadFolder=folder
node main.js -i=sample.tsv --runTestMode --debug --force

--------------------------------------------------
`;

module.exports = {
    extractRequestVariables: (argv) => {
        submissionParams = {
            poll: 'all',
            uploaded: false,
            selectedAction: 'AddData' // AddFiles, ChangeStatus
        };

        module.exports.extractParameters(argv);
        module.exports.getInputFile();
        module.exports.getOutputFileDetails();
        module.exports.getUploadFiles();

        return submissionParams;
    },

    //--------------------------------------------------
    // User Input / Set Up
    //--------------------------------------------------
    extractParameters: (argv) => {
        logger.debug(`extracting parameters: ${argv}`, submissionParams.debug)
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
                case 'uploadfiles':
                case '--uploadfiles':
                case '-f':
                    submissionParams.uploadFiles = mapEntry[1];
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
                case 'poll':
                case '--poll':
                    let poll = mapEntry[1].toLowerCase();

                    if (poll === 'all' || poll === 'disabled') {
                        submissionParams.poll = poll;
                    }
                    else {
                        submissionParams.poll = parseInt(poll);

                        if (isNaN(submissionParams.poll)) {
                            throw new Error(`Invalid input: poll must either be a number or 'all' or 'disabled'`);
                        }
                    }
                    break;
                case 'processreport':
                case '--processreport':
                case '-p':
                    submissionParams.force = false;
                    submissionParams.reportFilename = mapEntry[1];
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
                    submissionParams.testing = true;
                    break;
                case 'debug':
                case '--debug':
                case 'verbose':
                case '--verbose':
                case '-v':
                    submissionParams.debug = true;
                    break;
                case 'force':
                case '--force':
                    submissionParams.force = true;
                    break;
                case 'uploaded':
                case '--uploaded':
                    submissionParams.uploaded = true;
                    break;
            }
        });

        logger.debug('Extracted parameters', submissionParams.debug);
        logger.debug(JSON.stringify(submissionParams), submissionParams.debug);
    },

    getInputFile: () => {
        if (!submissionParams.inputFilename) return;

        let fileInfo = module.exports.extractFiletype(submissionParams.inputFilename);
        submissionParams.fileType = fileInfo.fileType;
        submissionParams.inputFilename = fileInfo.filename;
        submissionParams.outputFilename = submissionParams.outputFilename || fileInfo.filename;
    },

    getUploadFiles: () => {
        if (!submissionParams.uploadFiles) return;

        let files = submissionParams.uploadFiles.split(',');
        submissionParams.uploadFiles = files;

        let fileInfo = module.exports.extractFiletype(files[0]);
        submissionParams.outputFilename = submissionParams.outputFilename || fileInfo.filename;
    },

    getOutputFileDetails: () => {
        submissionParams.outputFilepath = path.resolve(__dirname, `../../files/${submissionParams.outputFilename}-submission.xml`);
    },

    extractFiletype: (filename, defaultFiletype = 'tsv') => {
        // strip out the file type
        let splitName = filename.split('.');

        // If no filetype declared, just assume the user meant to use tsv (default case)
        if (splitName.length === 1) {
            splitName.push(defaultFiletype);
        }

        // Extract filetype
        let fileType = splitName[splitName.length - 1].toLowerCase();

        // Join filename without the filetype
        splitName.length = splitName.length - 1;
        let computedFilename = splitName.join('.');

        return { fileType, filename: computedFilename };
    }
}