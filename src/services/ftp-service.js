const config = require('../config');

const Client = require('ssh2-sftp-client');
const logger = require('../services/logger')('a', 'ftp-serv');

module.exports = {

    startFtpClient: async (submissionParams) => {
        if (submissionParams.skipFtp) return logger.log('Skipping Connection to FTP Client');
        logger.log('Creating FTP client...')
    
        ftpClient = new Client();

        await module.exports.access(ftpClient, !!submissionParams.debug);
        return ftpClient;
    },

    access: async (ftpClient, debug = false) => {
        logger.log(`Connecting to FTP`)
        try {
            await ftpClient.connect({
                host: config.ftpConfig.host,
                port: config.ftpConfig.port,
                user: config.ftpConfig.user,
                debug: (str) => logger.debug(str, debug),
                password: config.ftpConfig.pass,
                retries: 3,
                retry_minTimeout: 5000
            });

            logger.log('Successfully connected to FTP');
            return ftpClient;
        } catch (err) {
            logger.log(`There was an error connecting to the ftp client: \n${err.message}\n${err.stack}`);
        }
    }
};