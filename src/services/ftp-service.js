const config = require('../config');

const ftp = require('basic-ftp');
const logger = require('../services/logger')('a', 'ftp-serv');

module.exports = {

    startFtpClient: async (submissionParams) => {
        if (submissionParams.skipFtp) return logger.log('Skipping Connection to FTP Client');
        logger.log('Connecting to FTP client...')
    
        ftpClient = new ftp.Client();

        if (submissionParams.debug) {
            ftpClient.ftp.verbose = true;
        }
    
        // errors will be caught in the parent try catch
        await ftpClient.access({
            host: config.ftpConfig.host,
            user: config.ftpConfig.user,
            password: config.ftpConfig.pass,
            secure: config.ftpConfig.secure
        });

        return ftpClient;
    },

    downloadLatestReport: async (submissionParams, client) => {

    }

};