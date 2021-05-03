const config = require('../config');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const parser = require('xml2js');
const logger = require('../services/logger')('a', 'report-p');

module.exports = {

    processReport: async (reportPath, debug) => {
        let ret = {
            failed: false
        };

        try {
            logger.debug(`Processing report: ${reportPath}`, debug);
            let reportFileContent = fs.readFileSync(reportPath, 'utf8');

            let report = await parser.parseStringPromise(reportFileContent);
            ret.report = report;
    
            let status = report.SubmissionStatus.$.status.toLowerCase();
            ret.status = status;
            logger.debug(`Submission status: ${status}`, debug);
    
            if (status === 'failed') {
                logger.log(chalk.red(`There was an error processing this report: ${status}, please open the report for more details`));
                logger.log(chalk.red(reportPath));
                ret.failed = true;
                return ret;
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
                let isProcessing = hasSubmittedActions || hasQueuedActions || hasProcessingActions;
    
                ret.isProcessing = isProcessing;
                ret.requestCounts = {
                    completed: actionStatuses['processed-ok'] + actionStatuses['processed-error'] + actionStatuses.deleted,
                    remaining: actionStatuses.queued + actionStatuses.submitted + actionStatuses.processing,
                    errored: actionStatuses['processed-error']
                };

                logger.log(`Submission is ${isProcessing ? 'processing' : 'done'}... (Status: ${ret.requestCounts.completed}/${ret.requestCounts.remaining + ret.requestCounts.completed})`);

                if (actionStatuses['processed-error'] > 0) {
                    logger.log(chalk.red(`There was a processing error on ${actionStatuses['processed-error']} action(s), please open the report for more details.`));
                    logger.log(chalk.red(reportPath));
                    ret.failed = true;
                }
            }

            return ret;
        } catch(e) {
            if (e.code === 'ENOENT') {
                logger.log(chalk.red(`Error attempting to open downloaded report (${reportPath})`));
            }
            else {
                logger.log(chalk.red(`Error attempting to parse the report (${reportPath})`));
            }
            return {failed: true};
        }
    },

    writeAttributesTsv: (report, submissionParams) => {
        if (!data) {
            logger.log('Unable to write attributes tsv');
            return;
        }
    
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
};
