const config = require('../config');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const parser = require('xml2js');
const logger = require('../services/logger')('a', 'uploader');
const ftpService = require('../services/ftp-service');

const { Readable } = require('stream');

// FTP variables
let ftpClient, polling;

// Variables
let submissionParams;
let data;

startPolling = async () => {
    logger.log(`Starting polling, waiting ${config.ftpConfig.pollingInterval} ms to check submission status`)
    polling = setInterval(getReports, config.ftpConfig.pollingInterval);
}

getReports = async () => {
    logger.log('Getting list of reports from FTP')
    // basic-ftp list method only supports MLSD, Unix, and DOS directory listings
    let files = submissionParams.skipFtp
        // testing data, to just make sure the sorting will take the last available report
        ? [{ name: 'report.xml' }]
        : await ftpClient.list(submissionParams.uploadFolder);
    let reports = [];

    let shouldPoll = false;

    // Get all the report names
    files.forEach((file) => {
        if (file.name.substring(0, 7) === 'report.') {
            reports.push(file.name);
        }
        else if (file.name === 'submit.ready') {
            shouldPoll = true;
        }
    });

    if (!shouldPoll) {
        this.processReports(reports);
    }
}

processReports = async (reports) => {
    // find the latest report version
    reports = reports.sort((a, b) => {
        return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    });
    logger.debug('reports found:');
    logger.debug(reports);

    // testing array will be sorted to:
    // [ report.1, report.2, report.11, report]
    // Ignore "report.xml", assuming it's the last result.
    let lastReport = reports.length === 1
        ? reports[0]
        : reports[reports.length - 2];
    let reportPath = path.resolve(__dirname, `../../reports/${submissionParams.outputFilename}-${lastReport}`);

    if (lastReport) {
        if (!submissionParams.skipFtp) {
            await ftpClient.downloadTo(reportPath, `${submissionParams.uploadFolder}/${lastReport}`);
        }
        processReport(reportPath);
    }
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
            logger.debug(`report status: ${status}`)
            if (status === 'processed-ok') {
                writeAttributesTsv(report);
                stopPolling();
            }
            else if (status === 'processed-error' || status === 'deleted' || status === 'failed') {
                logger.log(chalk.red(`There was an error processing this report: ${status}, please open the report for more details`));
                stopPolling();
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
        stream.write(`accession\tmessage\t${data.metadata.columnsRaw}`);
        actions.forEach((action) => {
            let response = action.Response[0];
            let organism = response.Object[0].Meta[0].Organism[0]._;
            let accession = response.Object[0].$.accession;
            let message = response.Message[0]._;

            let val = data.metadata.dataMap[organism];
            if (val) {
                stream.write(`${accession}\t${message}\t${val}`);
            }
        });
        stream.end();

        logger.log(`Generated ${submissionParams.outputFilename}-attributes.tsv file`);
    });
}

stopPolling = () => {
    logger.log('Halting polling, and closing FTP client...')
    clearInterval(polling);
    polling = 0;

    if (!submissionParams.skipFtp) {
        ftpClient.close();
    }
}

module.exports = {
    uploadFile: async (submissionParams_, data_) => {
        submissionParams = submissionParams_;
        data = data_;

        if (!submissionParams.uploadFolder) {
            logger.log('No upload folder defined; skipping upload.');
            return;
        }
    
        ftpClient = await ftpService.startFtpClient(submissionParams);
        logger.log(`Uploading generated xml file to ${submissionParams.uploadFolder}`);
    
        if (submissionParams.skipFtp) {
            startPolling();
        }
        else {
            await ftpClient.ensureDir(submissionParams.uploadFolder);
            await ftpClient.uploadFrom(submissionParams.outputFilepath, `${submissionParams.uploadFolder}/submission.xml`);
            await ftpClient.uploadFrom(Readable.from(['']), `${submissionParams.uploadFolder}/submit.ready`);
            startPolling();
        }
    }
};