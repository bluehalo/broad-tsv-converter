const path = require('path');
const fs = require('fs');
const log_stdout = process.stdout;

let log_file;

// Flag options:
// 'w' : write new file, overwrite if file already exists
// 'a' : append to existing file
module.exports = (flags, category) => {

    log_file = fs.createWriteStream(path.resolve(__dirname, '../../logs/debug.log'), {flags: flags})

    return {
        log: (d) => {
            let date = new Date();
            let dateString = `${date.toLocaleTimeString()}`;
            let dateString_long = `${date.toLocaleDateString()}-${date.toLocaleTimeString()}`;

            log_stdout.write(` ${dateString}\t| ${category} | \t${d}\n`);
            log_file.write(`${dateString_long}\t| ${category} |\t${d}\n`);
        },
        debug: (d, debugMode = false) => {
            let date = new Date();
            let dateString = `${date.toLocaleTimeString()}`;
            let dateString_long = `${date.toLocaleDateString()}-${date.toLocaleTimeString()}`;

            if (debugMode) {
                log_stdout.write(` ${dateString}\t| ${category} | \t${d}\n`);
            }
            log_file.write(`${dateString_long}\t| ${category} |\t${d}\n`);
        }
    }
};