const chalk = require('chalk');
const readline = require('readline');

const xmlService = require('../../services/xml-service');
const logger = require('../../services/logger')('a', 'submissn');

const biosampleGenerator = require('./biosample');

getRowValue = (data, values, field) => {
    let colIndex = data.metadata.columnIndexMap[field];
    return colIndex || colIndex === 0 ? values[colIndex] : undefined;
}

getFilePath = (submissionParams, value) => {
    let fileLocation = submissionParams.submissionFileLocation || '';
    if (value[0] === '/') {
        value.slice(1);
    }
    return `${fileLocation}${value}`;
}

logPercentage = (submissionParams, rowsLength, rowNum) => {
    // Log current progress, just in case this takes a long time
    if (!submissionParams.testing) {
        let dateString = new Date().toLocaleTimeString();
        let percentageCompleted = Math.floor(rowNum * 100.0 / rowsLength);
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0, null);
        process.stdout.write(` ${dateString}\t| tsv->xml | \tProcessing {${submissionParams.inputFilename}.tsv}\t${percentageCompleted}%`);
    }
}

module.exports = {
    generate: (submissionParams, data, config) => {
        let ret = {
            Submission: {
                '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                '@xsi:noNamespaceSchemaLocation': 'http://www.ncbi.nlm.nih.gov/viewvc/v1/trunk/submit/public-docs/common/submission.xsd',
                '@schema_version': '2.0',
                Description: module.exports.getDescriptionXml(submissionParams, data, config),
                Action: module.exports.getSelectedActionDataXml(submissionParams, data, config)
            }
        };

        let validationObj = xmlService.validateXml('Submission', ret, true, submissionParams.debug);
        if (validationObj.isValid) {
            logger.debug('Submission XML is valid', submissionParams.debug);
            return ret;
        }
        else {
            if (!submissionParams.testing) {
                logger.log(chalk.red(
                    '\nThe submission xml file fails validation. Please check your config\n' 
                    + 'file and try again. If the problem persists, please send us your\n'
                    + '   1. input tsv file\n'
                    + '   2. output xml file\n'
                    + '   3. /logs/debug.log\n'
                ), false);

                logger.debug('Submission Validation Error:', submissionParams.debug);
                logger.debug(validationObj.validationErrors, submissionParams.debug);
                logger.debug(validationObj.xml, submissionParams.debug);
            }

            if (!submissionParams.force) {
                process.exit(1);
            }
        }
    },

    getDescriptionXml: (submissionParams, data, config) => {
        return {
            ...(submissionParams.comment && { 'Comment': submissionParams.comment }),
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
            ...(submissionParams.hold && { Hold: { '@release_date': submissionParams.hold }}),
            SubmissionSoftware: {
                '@version': 'asymmetrik-tsv@1.0.0'
            }
        };
    },

    getSelectedActionDataXml: (submissionParams, data, config) => {
        switch (submissionParams.selectedAction) {
            case 'AddData': return module.exports.getAddDataXml(submissionParams, data, config);
            case 'AddFiles': return module.exports.getAddFilesXml(submissionParams, data, config);
            default: return {};
        }
    },

    getAddDataXml: (submissionParams, data, config) => {
        return data.rows.map((d, rowNum) => {
            if (!d) { return; }
            logPercentage(submissionParams, data.rows.length, rowNum);
    
            let values = d
                .replace('\r', '')
                .split('\t');
    
            // Store data to map organism tsv row by name
            data.metadata.dataMap[getRowValue(data, values, 'sample_name')] = d;
    
            let rowRet = {
                // These fields exist, but they are unexplained in the xsd
                // '@action_id': 'REPLACEME: token type',
                // '@submitter_tracking_id': 'REPLACEME: string maxlength 255',
                AddData: {
                    '@target_db': submissionParams.targetDatabase,
                    Data: {
                        '@content_type': 'XML',
                        XmlContent: {
                            ...(biosampleGenerator.generate(data, values, config, submissionParams))
                        }
                    },
                    Identifier: {
                        SPUID: {
                            '@spuid_namespace': config.organizationConfig.spuid_namespace,
                            '#text': getRowValue(data, values, 'sample_name')
                        }
                    }
                }
            }
    
            return rowRet;
        });
    },

    getAddFilesXml: (submissionParams, data, config) => {
        return data.rows.map((d, rowNum) => {
            if (!d) { return; }
            logPercentage(submissionParams, data.rows.length, rowNum);
    
            let values = d
                .replace('\r', '')
                .split('\t');

            let attributes = [];
            let columnIndices = data.metadata.columnIndices;
            let columnIndexMap = data.metadata.columnIndexMap;

            // These indices are handled separately in the data object
            let indicesToIgnore = [
                'bioproject_accession',
                'biosample_accession',
                'filename'
            ];

            values.forEach((val, i) => {
                let shouldIgnoreAttribute = !columnIndices[i] || indicesToIgnore.indexOf(columnIndices[i]) !== -1;
    
                if (val && !shouldIgnoreAttribute) {
                    attributes.push({
                        '@name': columnIndices[i],
                        '#text': val
                    })    
                }
            });

            let rowRet = {
                AddFiles: {
                    '@target_db': submissionParams.targetDatabase,
                    File: {
                        '@cloud_url': getFilePath(submissionParams, values[columnIndexMap['filename']]),
                        DataType: {
                            '#text': submissionParams.submissionFileDataType
                        }
                    },
                    Attribute: attributes,
                    AttributeRefId: [
                        {
                            '@name': 'BioProject',
                            RefId: {
                                PrimaryId: {
                                    '@db': 'BioProject',
                                    '#text': values[columnIndexMap['bioproject_accession']] || submissionParams.bioproject
                                }
                            }
                        },
                        {
                            '@name': 'BioSample',
                            RefId: {
                                PrimaryId: {
                                    '@db': 'BioSample',
                                    '#text': values[columnIndexMap['biosample_accession']]
                                }
                            }
                        }
                    ],
                    Identifier: {
                        SPUID: {
                            '@spuid_namespace': config.organizationConfig.spuid_namespace,
                            '#text': getRowValue(data, values, 'library_ID')
                        }
                    }
                }
            };

            return rowRet;
        });
    }

};