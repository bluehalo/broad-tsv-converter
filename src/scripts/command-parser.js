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
'Parameter          |    |            | Description        ')}
help               | -h |            | print help table
inputFilename      | -i | (required) | filename for the tsv file to be uploaded
uploadFiles        | -f | (required) | (Either input filename or uploadFiles is required, but not both) comma separated list of files to upload
outputFilename     | -o | (optional) | filename to write the generated xml file to. Default value will use inputFilename
submissionType     |    | (optional) | 'biosample' or 'sra', default is biosample
submissionDataType |    | (optional) | 'autodetect-xml' | 'generic-data' | 'phenotype-table' | ... (to see full list, run without specifying value) , default is 'generic-data'
submissionFileLoc  |    | (optional) | if a filename column exists in the tsv file, prepend this string to the filename provided (for indicating folder or path or source of file, ex: 'gs://example_paper_sra/')
bioproject         |    | (optional) | bioproject to use for data if field is not found in the csv
uploadFolder       | -u | (optional) | if provided, the generated xml file will be uploaded through ftp to the specified folder
uploaded           |    | (optional) | Boolean, file has already been uploaded; just check on status with the same conditions
uploadComment      | -c | (optional) | description or comment about this submission
poll               |    | (optional) | '(number)' | 'all' | 'disabled' - Default value is 'all'. Poll until either this report number is hit or poll until all requests have been completed
processReport      | -p | (optional) | filename for report to convert to tsv - If upload folder is included, it will be downloaded from the FTP, otherwise, the script will look in the local files
releaseDate        | -d | (optional) | All data in this submission is requested to be publicly released on or after this date; example: '2017-01-01'
runTestMode        | -t |            | Run the test mode (skip FTP steps, and run with sample responses)
debug              |    |            | Turn on verbose details
force              |    |            | Force upload / processing, even if validation fails
--------------------------------------------------

Example:
node main.js -i=sample.tsv -c="this is a comment" --uploadFolder=folder
node main.js -i=sample.tsv --runTestMode --debug --force

--------------------------------------------------
`;

const submissionFileDataTypeOptions = ['autodetect-xml', 'generic-data', 'phenotype-table', 'sra-study-xml-v1', 'sra-experiment-xml-v1', 'sra-sample-xml-v1', 'sra-run-xml-v1', 'sra-analysis-xml-v1', 'sra-study-xml-v2', 'sra-experiment-xml-v2', 'sra-sample-xml-v2', 'sra-run-xml-v2', 'sra-analysis-xml-v2', 'sra-run-454_native', 'sra-run-bam', 'sra-run-CompleteGenomics_native', 'sra-run-fastq', 'sra-run-Helicos_native', 'sra-run-PacBio_HDF5', 'sra-run-sff', 'sra-run-SOLiD_native', 'sra-run-srf', 'project-core-xml-v1', 'wgs-contigs-sqn', 'wgs-unplaced-scaffolds-agp', 'wgs-contig-replicon-descr', 'wgs-agp-replicon-descr', 'wgs-loc-chr-to-replicon', 'wgs-replicon-from-contigs-agp', 'wgs-scaffold-from-contigs-agp', 'wgs-replicon-from-scaffolds-agp', 'wgs-unlocalized-scaffolds-agp', 'wgs-unloc-scaffold-to-replicon', 'wgs-assembly-sqn', 'wgs-assembly-fasta', 'wgs-contigs-fasta', 'wgs-agp', 'wgs-placement', 'ena-wgs-flatfile', 'ddbj-wgs-flatfile', 'wgs-flatfile-preprocess-report', 'tsa-seqsubmit-sqn', 'complete-genomes-annotated-sqn', 'complete-genomes-annotate-sqn', 'complete-genomes-annotate-fasta', 'complete-genomes-annotate-template', 'complete-genomes-replicon', 'genbank-sqn', 'genbank-submission-package', 'genbank-barcode-tar', 'genbank-sequences-fasta', 'genbank-srcmods-tbl', 'genbank-ncbi-link-tbl', 'genbank-sequences-filtered-fasta', 'genbank-sequences-fastaval-xml', 'genbank-srcmods-filtered-tbl', 'genbank-sequences-report-txt', 'genbank-sequences-report-tbl', 'genbank-tools-versions-xml', 'genbank-features-table', 'genbank-features-filtered-table', 'methylation-data', 'sequences-fasta', 'bionano-cmap', 'bionano-coord', 'bionano-xmap', 'bionano-smap', 'bionano-bnx', 'sequin', 'antibiogram', 'modifications.csv', 'modifications.gff', 'motifs.gff', 'motif_summary.csv', 'biosample-tbl-v2.0', 'antibiogram-tbl-v1.0'];

module.exports = {
    extractRequestVariables: (argv) => {
        submissionParams = {
            poll: 'all',
            uploaded: false,
            selectedAction: 'AddData', // AddFiles, ChangeStatus
            targetDatabase: 'BioSample',
            submissionFileDataType: 'generic-data'
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
                case 'submissiontype':
                case '--submissiontype':
                    let type = (mapEntry[1] || '').toLowerCase();
                    if (type !== 'biosample' && type !== 'sra') {
                        throw new Error(`Invalid input: submissionType must be 'biosample' or 'sra'`);
                    }
                    submissionParams.submissionType = mapEntry[1].toLowerCase();
                    submissionParams.selectedAction = type === 'sra' ? 'AddFiles' : 'AddData';
                    submissionParams.targetDatabase = type === 'sra' ? 'SRA' : 'BioSample';
                    break;
                case 'submissiondatatype':
                case '--submissiondatatype':
                    let dataType = (mapEntry[1] || '').toLowerCase();
                    if (submissionFileDataTypeOptions.indexOf(dataType) === -1) {
                        logger.log(`Submission File Data Type Options:\n${submissionFileDataTypeOptions.join(',\n')}`);
                        throw new Error(`Invalid input: submissionFileData must be an approved value`);
                    }
                    submissionParams.submissionFileDataType = dataType;
                    break;
                case 'submissionfileloc':
                case '--submissionfileloc':
                    let fileLoc = mapEntry[1];
                    if (fileLoc[fileLoc.length - 1] !== '/') {
                        fileLoc += '/';
                    }
                    submissionParams.submissionFileLocation = fileLoc;
                    break;
                case 'bioproject':
                case '--bioproject':
                    submissionParams.bioproject = mapEntry[1];
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