const config = require('../config');

const ftp = require('basic-ftp');
const logger = require('../services/logger')('a', 'ftp-serv');

module.exports = {

    startFtpClient: async (submissionParams) => {
        if (submissionParams.skipFtp) return logger.log('Skipping Connection to FTP Client');
        logger.log('Creating FTP client...')
    
        ftpClient = new ftp.Client();

        if (submissionParams.debug) {
            ftpClient.ftp.verbose = true;
        }

        await module.exports.access(ftpClient);
        return ftpClient;
    },

    access: async (ftpClient) => {
        let attempt = 1;

        while (ftpClient.closed) {
            logger.log(`Connecting to FTP: ${attempt++} attempt`)
            try {
                await ftpClient.access({
                    host: config.ftpConfig.host,
                    user: config.ftpConfig.user,
                    password: config.ftpConfig.pass,
                    secure: config.ftpConfig.secure
                });
    
                logger.log('Successfully connected to FTP');
                return ftpClient;
            } catch (err) {
                logger.log(`There was an error connecting to the ftp client: \n${err.message}\n${err.stack}, trying again... (Ctrl+C to stop the process)`);
            }
        }
    }
};