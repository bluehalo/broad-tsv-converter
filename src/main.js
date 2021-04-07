const config = require('./config');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const builder = require('xmlbuilder');
const parser = require('xml2js');
const libxmljs = require('libxmljs');
const ftp = require('basic-ftp');

// FTP variables
let ftpClient, polling;

// Options Variables
const argv = process.argv.slice(2);
let inputFilename, inputFileContent;
let outputFilename, outputFilepath;
let uploadFolder;
let selectedAction = 'AddData'; // AddFiles, ChangeStatus
let comment, hold;
let skipFtp = false;

// XML variables
let xml;

// Data Variables
let columnsRaw;
let columnIndices = [];
let columnIndexMap = {};
let dataMap = {};

// Other run time variables
const log_file = fs.createWriteStream(path.resolve(__dirname, '../logs/debug.log'), {flags: 'w'});
const log_stdout = process.stdout;
debugLog = (d) => {
    let date = new Date();
    let dateString = `${date.toLocaleDateString()}-${date.toLocaleTimeString()}`;
    log_file.write(`${dateString}\t|\t${d}\n`);
};
console.log = (d, log = true) => {
    if (log) {
        debugLog(d);
    }
    log_stdout.write(`${d}\n`);
};
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
'Parameter      |    |            | Description        ')}
help           | -h |            | print help table
inputFilename  | -i | (required) | filename for the tsv file to be uploaded
outputFilename | -o | (optional) | filename to write the generated xml file to. Default value will use inputFilename
uploadFolder   | -u | (optional) | if provided, the generated xml file will be uploaded through ftp to the specified folder
uploadComment  | -c | (optional) | description or comment about this submission
releaseDate    | -d | (optional) | All data in this submission is requested to be publicly released on or after this date; example: '2017-01-01'
runTestMode    | -t |            | Run the test mode (skip FTP steps, and run with sample responses)
--------------------------------------------------

Example:
node main.js -i=sample.tsv -c="this is a comment" --uploadFolder=folder

--------------------------------------------------
`;

const fns = {
    //--------------------------------------------------
    // User Input / Set Up
    //--------------------------------------------------
    extractParameters: () => {
        debugLog(`extracting parameters: ${argv}`)
        if (argv.length === 0) {
            console.log(helptext, false);
            process.exit(1);
        }

        skipFtp = false;

        argv.forEach((arg) => {
            let mapEntry = arg.split('=');
            let key = mapEntry[0].toLowerCase();
            switch(key) {
                case 'input':
                case 'inputfile':
                case '--input':
                case '--inputfile':
                case '-i':
                    inputFilename = mapEntry[1];
                    break;
                case 'output':
                case 'outputfile':
                case '--output':
                case '--outputfile':
                case '-o':
                    outputFilename = mapEntry[1];
                    break;
                case 'action':
                case '--action':
                case '-a':
                    selectedAction = mapEntry[1];
                    break;
                case 'uploadfolder':
                case '--uploadfolder':
                case '-u':
                    uploadFolder = mapEntry[1];
                    break;
                case 'uploadcomment':
                case '--uploadcomment':
                case '-c':
                    comment = mapEntry[1];
                    break;
                case 'hold':
                case '--hold':
                case 'releasedate':
                case '--releasedate':
                case '-d':
                    hold = mapEntry[1];
                    break;
                case 'help':
                case '--help':
                case '-h':
                    console.log(helptext, false);
                    process.exit(1);
                case 'runtestmode':
                case '--runtestmode':
                    skipFtp = true;
                    break;
            }
        });
    },

    getInputFile: () => {
        if (!inputFilename) throw new Error('Input Filename is Required'); 

        // strip out the file type
        let splitName = inputFilename.split('.');
        if (splitName[splitName.length - 1].toLowerCase() === 'tsv') {
            splitName.length = splitName.length - 1;
            inputFilename = splitName.join(',');
        }

        let filepath = path.resolve(__dirname, `../files/${inputFilename}.tsv`);
        inputFileContent = fs.readFileSync(filepath, 'utf8');
    },

    getOutputFileDetails: () => {
        outputFilename = outputFilename || inputFilename;
        outputFilepath = path.resolve(__dirname, `../files/${outputFilename}-submission.xml`);
    },

    //--------------------------------------------------
    // XML Methods
    //--------------------------------------------------
    getSelectedActionDataXml: (data) => {
        switch (selectedAction) {
            case 'AddData': return fns.getAddDataXml(data);
            default: return {};
        }
    },

    getDescriptionXml: () => {
        return {
            ...(comment && { 'Comment': comment }),
            ...(config.submitterConfig && {
                Submitter: {
                    ...(config.submitterConfig.contact && config.submitterConfig.contact.email && {
                        Contact: {
                            '@email': config.submitterConfig.contact.email
                        }
                    }),
                    ...(config.submitterConfig.account_id && { '@account_id': config.submitterConfig.account_id })
                }
            }),
            Organization: {
                Name: config.organizationConfig.name,
                '@type': config.organizationConfig.type,
                ...(config.organizationConfig.address && {
                    Address: {
                        ...(config.organizationConfig.address.department && { 'Department': config.organizationConfig.address.department }),
                        ...(config.organizationConfig.address.institution && { 'Institution': config.organizationConfig.address.institution }),
                        ...(config.organizationConfig.address.street && { 'Street': config.organizationConfig.address.street }),
                        ...(config.organizationConfig.address.city && { 'City': config.organizationConfig.address.city }),
                        ...(config.organizationConfig.address.state && { 'Sub': config.organizationConfig.address.state }),
                        ...(config.organizationConfig.address.country && { 'Country': config.organizationConfig.address.country }),
                        ...(config.organizationConfig.address.postal_code && { '@postal_code': config.organizationConfig.address.postal_code }),
                    }
                }),
                Contact: {
                    '@email': config.organizationConfig.contact.email
                },
                ...(config.organizationConfig.role && { '@role': config.organizationConfig.role }),
                ...(config.organizationConfig.role && { '@org_id': config.organizationConfig.org_id }),
                ...(config.organizationConfig.role && { '@group_id': config.organizationConfig.group_id }),
                ...(config.organizationConfig.role && { '@url': config.organizationConfig.url }),
            },
            ...(hold && { Hold: { '@release_date': config.organizationConfig.url }}),
            SubmissionSoftware: {
                '@version': 'asymmetrik-tsv@1.0.0'
            }
        };
    },

    getAddDataXml: (data) => {
        return data.map((d, rowNum) => {
            // Log current progress, just in case this takes a long time
            let percentageCompleted = Math.floor(rowNum * 100.0 / data.length);
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Processing ${inputFilename}.tsv\t${percentageCompleted}%`);

            let values = d
                .replace('\r', '')
                .split('\t');

            // Store data to map organism tsv row by name
            dataMap[fns.getRowValue(values, 'sample_name')] = d;

            let rowRet = {
                // These fields exist, but they are unexplained in the xsd
                // '@action_id': 'REPLACEME: token type',
                // '@submitter_tracking_id': 'REPLACEME: string maxlength 255',
                AddData: {
                    '@target_db': 'BioSample',
                    Data: {
                        '@content_type': 'XML',
                        XmlContent: {
                            ...(fns.getBioSampleXml(values))
                        }
                    }
                }
            }

            return rowRet;
        });
    },

    getBioSampleXml(values) {
        let attributes = [];
        values.forEach((val, i) => {
            // These indices are handled separately in the data object
            let indicesToIgnore = [
                'sample_name', 'description',
                'organism', 'isolate',
                'bioproject_accession',
                'attribute_package',

                // These indices are not confirmed to match the tsv format of NCBI
                'taxonomy', 'label', 'strain', 'breed', 'cultivar',
                'title'
            ];
            let shouldIgnoreAttribute = !columnIndices[i] || indicesToIgnore.indexOf(columnIndices[i]) !== -1;

            if (val && !shouldIgnoreAttribute) {
                attributes.push({
                    '@attribute_name': columnIndices[i],
                    '#text': val
                })    
            }
        });

        let bioSampleXml = {
            BioSample: {
                '@schema_version': '2.0',
                SampleId: {
                    SPUID: {
                        '@spuid_namespace': config.organizationConfig.spuid_namespace,
                        '#text': fns.getRowValue(values, 'sample_name')
                    }
                },
                Descriptor: {
                    ...(columnIndexMap['title'] && values[columnIndexMap['title']] && { 'Title': fns.getRowValue(values, 'title') }),
                    Description: fns.getRowValue(values, 'description'),
                    // TODO: Currently not supported
                    // ExternalLink: {
                        // '@label': 'link title'
                        // URL: '',
                        // ExternalId: typePrimaryId,
                        // EntrezQuery: ''
                    // }
                },
                Organism: {
                    ...(columnIndexMap['taxonomy'] && values[columnIndexMap['taxonomy']] && { '@taxonomy_id': values[columnIndexMap['taxonomy']] }),
                    ...(columnIndexMap['organism'] && values[columnIndexMap['organism']] && { 'OrganismName': values[columnIndexMap['organism']] }),
                    ...(columnIndexMap['label'] && values[columnIndexMap['label']] && { 'Label': values[columnIndexMap['label']] }),
                    ...(columnIndexMap['strain'] && values[columnIndexMap['strain']] && { 'Strain': values[columnIndexMap['strain']] }),
                    ...(columnIndexMap['isolate'] && values[columnIndexMap['isolate']] && { 'IsolateName': values[columnIndexMap['isolate']] }),
                    ...(columnIndexMap['breed'] && values[columnIndexMap['breed']] && { 'Breed': values[columnIndexMap['breed']] }),
                    ...(columnIndexMap['cultivar'] && values[columnIndexMap['cultivar']] && { 'Cultivar': values[columnIndexMap['cultivar']] }),
                },
                BioProject: {
                    PrimaryId: fns.getRowValue(values, 'bioproject_accession')
                },
                // Name of attribute package used to validate the sample, for example: MIGS.ba.air.4.0. 
                // See https://www.ncbi.nlm.nih.gov/biosample/docs/packages/ for the full list of available packages.
                Package: fns.getRowValue(values, 'attribute_package'),
                Attributes: {
                    Attribute: attributes
                }
            }
        };

        let validationXml = builder
            .create(bioSampleXml)
            .end({ pretty: true });

        let biosampleSchema = fs.readFileSync(path.resolve(__dirname, `./xsds/BioSample.xsd`));
        let biosampleSchemaDoc = libxmljs.parseXml(biosampleSchema, {baseUrl: path.resolve(__dirname, `./xsds/`)});
        let biosampleDoc = libxmljs.parseXml(validationXml.toString());

        if (!biosampleDoc.validate(biosampleSchemaDoc)) {
            console.log(chalk.red(
                '\nThere is a validation problem with a BioSample instance in this submission\n' 
                + 'This sample will not be excluded in the submission xml, and should not effect the\n'
                + 'other intended uploads. However, it will likely fail in the NCBI submission portal.\n\n'
                + 'The relevant BioSample segment has been written to your log file.\n'
                + 'If this problem persists, please send your debug.log to the dev team. ')
                + chalk.red.dim('Thank you!')
            , false);

            debugLog('BioSample Validation Error:');
            debugLog(biosampleDoc.validationErrors);
            debugLog(validationXml);
        }

        return bioSampleXml;
    },

    process: async () => {
        process.stdout.cursorTo(0);
        process.stdout.write(`Processing ${inputFilename}.tsv\t0%`);

        let data = inputFileContent.split('\n');
        columnsRaw = data.shift();
        let cols = columnsRaw.split('\t'); // get first row, delete it from original data array
        columnIndices = cols.map((col, i) => {
            // remove special characters that google docs puts in
            // /r gets added to the last column to indicate newline, i think
            let normalizedName = col.replace('\r', '');
            columnIndexMap[normalizedName] = i;
            return normalizedName;
        });
        debugLog(`columns: ${columnIndices}`)

        let xmlJson = {
            Submission: {
                '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                '@xsi:noNamespaceSchemaLocation': 'http://www.ncbi.nlm.nih.gov/viewvc/v1/trunk/submit/public-docs/common/submission.xsd',
                '@schema_version': '2.0',
                Description: fns.getDescriptionXml(data),
                Action: fns.getSelectedActionDataXml(data)
            }
        }

        xml = builder
            .create(xmlJson)
            .end({ pretty: true });
            
        let submissionSchema = fs.readFileSync(path.resolve(__dirname, `./xsds/Submission.xsd`));
        let submissionSchemaDoc = libxmljs.parseXml(submissionSchema, {baseUrl: path.resolve(__dirname, `./xsds/`)});
        let submissionDoc = libxmljs.parseXml(xml.toString());
        debugLog(`submission xml is valid: (${submissionDoc.validate(submissionSchemaDoc)})`)

        fs.writeFile(outputFilepath, xml.toString(), () => {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(`Finished Processing {${inputFilename}.tsv}\n`);

            if (submissionDoc.validate(submissionSchemaDoc)) {
                fns.uploadFile();
            }
            else {
                console.log(chalk.red(
                    'The submission xml file fails validation. Please check your config\n' 
                    + 'file and try again. If the problem persists, please send us your\n'
                    + '   1. input tsv file\n'
                    + '   2. output xml file\n'
                    + '   3. /logs/debug.log\n'
                ), false);
            }
            return;
        });
    },

    getRowValue: (values, field) => {
        let colIndex = columnIndexMap[field];
        return colIndex || colIndex === 0 ? values[colIndex] : undefined;
    },

    //--------------------------------------------------
    // FTP Methods
    //--------------------------------------------------
    startFtpClient: async () => {
        if (skipFtp) return console.log('Skipping Connection to FTP Client');
        console.log('Connecting to FTP client...')

        ftpClient = new ftp.Client();
        ftpClient.ftp.verbose = true;

        // errors will be caught in the parent try catch
        await ftpClient.access({
            host: config.ftpConfig.host,
            user: config.ftpConfig.user,
            password: config.ftpConfig.pass,
            secure: true
        });
    },

    uploadFile: async () => {
        if (!uploadFolder) {
            console.log('No upload folder defined; skipping upload.');
            return;
        }

        await fns.startFtpClient();
        console.log(`Uploading generated xml file to ${uploadFolder}`);

        if (skipFtp) {
            fns.startPolling();
        }
        else {
            let ftpResponse = await ftpClient.uploadFrom(outputFilepath, `${uploadFolder}/submission.xml`);
            let logPath = path.resolve(__dirname, `../logs/${outputFilename}`);
            fs.writeFile(logPath, ftpResponse, () => {
                fns.startPolling();
            });
        }
    },

    startPolling: async () => {
        console.log(`Starting polling, waiting ${config.ftpConfig.pollingInterval} ms to check submission status`)
        polling = setInterval(fns.getReports, config.ftpConfig.pollingInterval);
    },

    getReports: async () => {
        console.log('Getting list of reports from FTP')
        // basic-ftp list method only supports MLSD, Unix, and DOS directory listings
        let files = skipFtp
            // testing data, to just make sure the sorting will take the last available report
            ? [{ name: 'report.xml' }]
            : await ftpClient.list(uploadFolder);
        let reports = [];

        // Get all the report names
        files.forEach(async (file) => {
            debugLog('looking at file');
            debugLog(file.toString());
            debugLog(JSON.stringify(file));
            debugLog(`file name: ${file.name}`)
            if (file.name.substring(0, 7) === 'report.') {
                reports.push(file.name);
            }
        });

        // find the latest report version
        reports = reports.sort((a, b) => {
            return a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });
        debugLog('reports found:');
        debugLog(reports);

        // testing array will be sorted to:
        // [ report.1, report.2, report.11, report]
        // Ignore "report.xml", assuming it's the last result.
        let lastReport = reports.length === 1
            ? reports[0]
            : reports[reports.length - 2];
        let reportPath = path.resolve(__dirname, `../reports/${outputFilename}-${lastReport}`);

        if (!skipFtp) {
            await ftpClient.downloadTo(reportPath, `${uploadFolder}/${file.name}`);
        }

        fns.processReport(reportPath);
    },

    processReport: (reportPath) => {
        debugLog(`processing report: ${reportPath}`);
        let reportFileContent = fs.readFileSync(reportPath, 'utf8');
        parser.parseString(reportFileContent, (err, report) => {
            let status = report.SubmissionStatus.$.status.toLowerCase();
            debugLog(`report status: ${status}`)
            if (status === 'processed-ok' || status === 'processed-error' || status === 'deleted' || status === 'failed') {
                fns.writeAttributesTsv(report);
                fns.stopPolling();
            }
        });
    },

    writeAttributesTsv: (report) => {
        let actions = report.SubmissionStatus.Action;

        let stream = fs.createWriteStream(path.resolve(__dirname, `../reports/${outputFilename}-attributes.tsv`));
        stream.once('open', () => {
            stream.write(`accession\tmessage\t${columnsRaw}`);
            actions.forEach((action) => {
                let response = action.Response[0];
                let organism = response.Object[0].Meta[0].Organism[0]._;
                let accession = response.Object[0].$.accession;
                let message = response.Message[0]._;
                stream.write(`${accession}\t${message}\t${dataMap[organism]}`);
            });
            stream.end();
        });
    },

    stopPolling: () => {
        console.log('Script completed, closing FTP client...')
        clearInterval(polling);
        polling = 0;
        if (!skipFtp) {
            ftpClient.close();
        }
    }
}


//--------------------------------------------------
// Execute
//--------------------------------------------------
try {
    fns.extractParameters();
    fns.getInputFile();
    fns.getOutputFileDetails();
    fns.process();
} catch (err) {
    console.log(chalk.red(`\n\nThere was an unexpected error: `) + err.message);
    debugLog(err.stack)
    return;
}
