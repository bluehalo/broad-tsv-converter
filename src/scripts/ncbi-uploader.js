const config = require('../config');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const parser = require('xml2js');
const logger = require('../services/logger')('a', 'uploader');
const ftpService = require('../services/ftp-service');

const { Readable } = require('stream');

// FTP variables
let ftpClient, isPolling;

// Variables
let submissionParams;
let data;

poll = async (initial = false) => {
    if (initial) {
        isPolling = true;
        logger.log(`Starting polling, waiting ${config.ftpConfig.pollingInterval} ms to check submission status`)
    }

    // Switched from Interval to Timeout:
    // Interval was running into async issues where the second check was kicked off
    // before the first one had completed.
    polling = setTimeout(getReports, config.ftpConfig.pollingInterval);
}

getReports = async () => {
    submissionParams.skipFtp
        ? getFakeReports()
        : getRealReports();
}

getFakeReports = () => {
    logger.log('Grabbing fake report for testing purposes');
    let reportPath = path.resolve(__dirname, `../../reports/${submissionParams.outputFilename}-report.xml`);
    processReport(reportPath);
}

getRealReports = async () => {
    try {
        let files = await ftpClient.list(submissionParams.uploadFolder);

        logger.log(`Checking ${files.length} files`);
        let highestReportNumber = -1;

        // Get all the report names
        for (let file of files) {
            if (file.name.substring(0, 7) === 'report.') {
                let split = file.name.split('.');
                if (split[1] === 'xml') {
                    highestReportNumber = Math.max(highestReportNumber, 0);
                }
                else {
                    let reportNumber = parseInt(split[1]);
                    highestReportNumber = Math.max(highestReportNumber, reportNumber);
                }
            }
            else if (file.name === 'submit.ready') {
                // Exit this entire method, wait to poll again.
                logger.log('Submission status: queued');
                return poll();
            }
        }

        if (highestReportNumber === -1) {
            logger.log('Submission status: processing... awaiting first report');
            return poll();
        }

        // Only way to access this point of the code is if the submit.ready file is not present.
        let reportName = highestReportNumber > 0
            ? `report.${highestReportNumber}.xml`
            : 'report.xml';

        await downloadReport(reportName);
    } catch (error) {
        console.log(chalk.red(error.stack))
    }
}

downloadReport = async (reportName) => {
    let reportPath = path.resolve(__dirname, `../../reports/${submissionParams.outputFilename}-${reportName}`);
    await ftpClient.downloadTo(reportPath, `${submissionParams.uploadFolder}/${reportName}`);
    await processReport(reportPath);
}

processReport = (reportPath) => {
    try {
        logger.debug(`processing report: ${reportPath}`);
        let reportFileContent = fs.readFileSync(reportPath, 'utf8');

        parser.parseString(reportFileContent, (err, report) => {
            if (err) {
                logger.log(chalk.red(`There was an error parsing the downloaded report (${reportPath})`));
                logger.debug(err);
                stopPolling();
                return;   
            }

            let status = report.SubmissionStatus.$.status.toLowerCase();
            logger.debug(`Submission status: ${status}`);

            if (status === 'processed-ok') {
                writeAttributesTsv(report);
                stopPolling();
            }
            else if (status === 'failed') {
                logger.log(chalk.red(`There was an error processing this report: ${status}, please open the report for more details`));
                logger.log(chalk.red(reportPath));
                stopPolling();
            }
            else {
                // NCBI documentation indicates these action statuses can possibly be:
                //    queued, processing, processed-ok, processed-error, deleted.
                // In practice, we also discovered they can have the status 'submitted'
                let actionStatuses = {
                    queued: 0,
                    submitted: 0,
                    processing: 0,
                    'processed-ok': 0,
                    'processed-error': 0,
                    deleted: 0
                };

                // Count them up!
                report.SubmissionStatus.Action.forEach((action) => {
                    let status = action.$.status;
                    if (!actionStatuses[status]) {
                        actionStatuses[status] = 0;
                    }
                    actionStatuses[status]++;
                });

                let hasSubmittedActions = actionStatuses.submitted > 0;
                let hasQueuedActions = actionStatuses.queued > 0;
                let hasProcessingActions = actionStatuses.processing > 0;
                if (hasSubmittedActions || hasQueuedActions || hasProcessingActions) {
                    let completed = actionStatuses['processed-ok'] + actionStatuses['processed-error'] + actionStatuses.deleted;
                    let remaining = completed + actionStatuses.queued + actionStatuses.submitted + actionStatuses.processing;
                    logger.log(`Submission is in progress... (Status: ${completed}/${remaining})`);
                    fs.unlinkSync(reportPath);
                    poll();
                }
                else {
                    logger.log(`Finished processing submission.`);

                    if (actionStatuses['processed-error'] > 0) {
                        logger.log(chalk.red(`There was a processing error on ${actionStatuses['processed-error']} action(s), please open the report for more details.`));
                        logger.log(chalk.red(reportPath));
                    }
                    stopPolling();
                }
            }
        });
    } catch(e) {
        if (e.code === 'ENOENT') {
            logger.log(chalk.red(`Error attempting to open downloaded report (${reportPath})`));
        }
        stopPolling();
    }
}

writeAttributesTsv = (report) => {
    let actions = report.SubmissionStatus.Action;

    let stream = fs.createWriteStream(path.resolve(__dirname, `../../reports/${submissionParams.outputFilename}-attributes.tsv`));
    stream.once('open', () => {
        stream.write(`accession\tmessage\t${data.metadata.columnsRaw}\n`);
        actions.forEach((action) => {
            let response = action.Response[0];
            let spuid = response.Object[0].$.spuid;
            let accession = response.Object[0].$.accession;
            let message = response.Message[0]._;

            let val = data.metadata.dataMap[spuid];

            if (val) {
                stream.write(`${accession}\t${message}\t${val}\n`);
            }
        });
        stream.end();

        logger.log(`Generated ${submissionParams.outputFilename}-attributes.tsv file`);
    });
}

stopPolling = () => {
    if (isPolling) {
        isPolling  = false;

        logger.log('Halting polling, and closing FTP client...');

        if (!submissionParams.skipFtp && ftpClient) {
            ftpClient.close();
        }
    }
}

module.exports = {
    processRequest: async (submissionParams_, data_) => {
        submissionParams = submissionParams_;
        data = data_;

        if (submissionParams.reportFilename) {
            await module.exports.extractTsvFromReport(submissionParams_, data_);
        }
        else if (submissionParams.uploadFolder) {
            await module.exports.uploadFiles(submissionParams_, data_);
        }
    },

    uploadFiles: async (submissionParams_, data_) => {
        submissionParams = submissionParams_;
        data = data_;

        if (!submissionParams.uploadFolder) {
            logger.log('No upload folder defined; skipping upload.');
            return;
        }

        if (submissionParams.skipFtp) {
            poll(true);
        }
        else {
            ftpClient = await ftpService.startFtpClient(submissionParams);
            await ftpClient.ensureDir(submissionParams.uploadFolder);

            if (submissionParams.inputFilename) {
                await ftpClient.uploadFrom(submissionParams.outputFilepath, `${submissionParams.uploadFolder}/submission.xml`);
                logger.log(`Uploaded ${submissionParams.uploadFolder}/submission.xml`);
            }

            if (submissionParams.uploadFiles) {
                let promises = submissionParams.uploadFiles.map((filename) => {
                    let filepath = path.resolve(__dirname, `../../files/${filename}`);
                    return ftpClient
                        .uploadFrom(filepath, `${submissionParams.uploadFolder}/${filename}`)
                        .then(() => {
                            logger.log(`Uploaded ${submissionParams.uploadFolder}/${filename}`);
                        });
                });
                await Promise.all(promises);
            }

            await ftpClient.uploadFrom(Readable.from(['']), `${submissionParams.uploadFolder}/submit.ready`);
            logger.log(`Uploaded ${submissionParams.uploadFolder}/submit.ready`);

            poll(true);
        }
    },

    extractTsvFromReport: async (submissionParams_, data_) => {
        submissionParams = submissionParams_;
        data = data_;

        if (!submissionParams.reportFilename) {
            logger.log('No report declared; skipping extract tsv from report');
            return;
        }

        if (submissionParams.uploadFolder) {
            ftpClient = await ftpService.startFtpClient(submissionParams);
            try {
                await downloadReport(submissionParams.reportFilename);
            } catch (error) {
                logger.log(`There was an error downloading the report: ${error.message}`);
                logger.log('Please check your inputs and try again');
                process.exit(1);
            }
        }
        else {
            let reportPath = path.resolve(__dirname, `../../reports/${submissionParams.reportFilename}`);
            processReport(reportPath);
        }
    }
};