const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logger = require('../services/logger')('a', 'tsv->xml');
const xmlService = require('../services/xml-service');
const submissionGenerator = require('./xml-generators/submission');

extractData = (submissionParams) => {
    let filepath = path.resolve(__dirname, `../../files/${submissionParams.inputFilename}.tsv`);
    let inputFileContent = fs.readFileSync(filepath, 'utf8');

    let data = inputFileContent.split('\n');
    let columnsRaw = data.shift(); // Raw data for column string
    let cols = columnsRaw.split('\t'); // get first row, delete it from original data array
    let columnIndexMap = {};
    let columnIndices = cols.map((col, i) => {
        // remove special characters that google docs puts in
        // /r gets added to the last column to indicate newline, i think
        let normalizedName = col.replace('\r', '');
        columnIndexMap[normalizedName] = i;
        return normalizedName;
    });
    logger.debug(`columns: ${columnIndices}`);

    return {
        rows: data,
        metadata: {
            columnsRaw,
            columnIndices,
            columnIndexMap,
            dataMap: {} // the raw row data per id; generate this as you iterate through the data itself
        }
    };
}

writeXml = async (submissionParams, xmlString) => {
    return await new Promise((resolve, reject) => {
        try {
            let xml = xmlService.buildXml(xmlString);

            fs.writeFile(submissionParams.outputFilepath, xml.toString(), () => {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0, null);
                let dateString = new Date().toLocaleTimeString();
                process.stdout.write(` ${dateString}\t| tsv->xml | \tFinished Processing {${submissionParams.inputFilename}.tsv}\n`);
                resolve(true);
            });
        } catch (e) {
            reject(e);
        }
    });
}

module.exports = {
    process: async (submissionParams) => {
        readline.cursorTo(process.stdout, 0, null);
        let dateString = `${new Date().toLocaleTimeString()}`;
        process.stdout.write(` ${dateString}\t| tsv->xml | \tProcessing {${submissionParams.inputFilename}.tsv}\t0%`);
        logger.debug('in tsv-to-xml.js : starting to process file');

        let data = extractData(submissionParams);
        let xmlString = submissionGenerator.generate(submissionParams, data);
        await writeXml(submissionParams, xmlString);

        return data;
    }
};
