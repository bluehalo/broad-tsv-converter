const config = require('../config');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const logger = require('../services/logger')('a', 'uploader');
const ftpService = require('../services/ftp-service');

const reportProcessor = require('./report-processor');

const { Readable } = require('stream');

// FTP variables
let ftpClient, isPolling;

// Variables
let submissionParams;
let data;

poll = async (initial = false) => {
    if (submissionParams.pollingEnd === 'disabled') {
        return;
    }

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
    try {
        let hasSubmissionFile = await ftpClient.exists(`${submissionParams.uploadFolder}/submit.ready`);

        if (hasSubmissionFile) {
            // Exit this entire method, wait to poll again.
            logger.log('Submission status: queued');
            return poll();
        }

        let files = await ftpClient.list(submissionParams.uploadFolder, 'report.[0-9]+.xml');

        if (files.length === 0) {
            logger.log('Submission status: processing... awaiting first report');
            return poll();
        }

        // Only way to access this point of the code is if the submit.ready file is not present.
        // Options for collator sort will prioritize 1 < 2 < 10
        let collator = new Intl.Collator(undefined, {numeric: true, sensitivty: 'base'});
        let sortedFilenames = files
            .map((file) => file.name)
            .sort(collator.compare);
        let reportName = sortedFilenames.slice(-1)[0];
        let reportNumberStr = (reportName.match('([0-9]+)') || ['-1'])[0];
        let reportNumber = parseInt(reportNumberStr);

        let shouldPoll = submissionParams.poll === 'all' || reportNumber < submissionParams.poll;
        await downloadReport(reportName, shouldPoll);
    } catch (error) {
        if (error.code === 'ETIMEDOUT' || error.code === 'ERR_NOT_CONNECTED') {
            logger.log(chalk.red('FTP client timed out, starting a new connection'));
            ftpClient = await ftpService.startFtpClient(submissionParams);
            getReports();
        }
        else {
            console.log(chalk.red(error.code));
            console.log(chalk.red(error.stack));
        }
    }
}

downloadReport = async (reportName, shouldPoll = false) => {
    let remotePath = `${submissionParams.uploadFolder}/${reportName}`;
    let localPath = path.resolve(__dirname, `../../reports/${submissionParams.outputFilename}-${reportName}`);
    await ftpClient.fastGet(remotePath, localPath);
    await processReport(localPath, shouldPoll);
}

processReport =  async (reportPath, shouldPoll = false) => {
    let reportDetails = await reportProcessor.processReport(reportPath, submissionParams.debug);

    if (reportDetails.failed) {
        return stopPolling();
    }
    else if (reportDetails.status === 'processed-ok') {
        reportProcessor.writeAttributesTsv(reportDetails.report, submissionParams, data);
        return stopPolling();
    }
    else if (reportDetails.isProcessing && shouldPoll) {
        fs.unlinkSync(reportPath);
        poll();
    }
    else {
        stopPolling();
    }
}

stopPolling = () => {
    if (isPolling) {
        isPolling  = false;

        logger.log('Halting polling, and closing FTP client...');

        if (!submissionParams.skipFtp && ftpClient) {
            ftpClient.end();
            delete ftpClient;
        }
    }

    if (ftpClient) {
        ftpClient.end();
        delete ftpClient;
    }

}

module.exports = {
    processRequest: async (submissionParams_, data_) => {
        submissionParams = submissionParams_;
        data = data_;

        if (submissionParams.reportFilename) {
            await module.exports.extractTsvFromReport(submissionParams_, data);
        }
        else if (submissionParams.uploadFolder) {
            await module.exports.uploadFiles(submissionParams_, data);
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
        else if (submissionParams.uploaded) {
            ftpClient = await ftpService.startFtpClient(submissionParams);
            poll(true);
        }
        else {
            ftpClient = await ftpService.startFtpClient(submissionParams);
            await ftpService.ensureDirectory(ftpClient, submissionParams.uploadFolder);

            if (submissionParams.inputFilename) {
                let remotePath = `${submissionParams.uploadFolder}/submission.xml`;
                let localPath = submissionParams.outputFilepath;
                await ftpClient.fastPut(localPath, remotePath);
                logger.log(`Uploaded ${submissionParams.uploadFolder}/submission.xml`);
            }

            if (submissionParams.uploadFiles) {
                for (filename of submissionParams.uploadFiles) {
                    let localPath = path.resolve(__dirname, `../../files/${filename}`);
                    let remotePath = `${submissionParams.uploadFolder}/${filename}`;

                    await ftpClient.fastPut(localPath, remotePath)
                    logger.log(`Uploaded ${submissionParams.uploadFolder}/${filename}`);
                };
            }

            let localFile = Readable.from(['']);
            let remotePath = `${submissionParams.uploadFolder}/submit.ready`;
            await ftpClient.put(localFile, remotePath);
            logger.log(`Uploaded ${submissionParams.uploadFolder}/submit.ready`);

            poll(true);
        }
    },

    extractTsvFromReport: async (submissionParams_, data_) => {
        logger.log('Extracting TSV from Report');
        submissionParams = submissionParams_;
        data = data_;

        if (!submissionParams.reportFilename) {
            logger.log('No report declared; skipping extract tsv from report');
            return;
        }

        if (submissionParams.uploadFolder) {
            ftpClient = await ftpService.startFtpClient(submissionParams);
            try {
                await downloadReport(submissionParams.reportFilename, 'disabled');
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