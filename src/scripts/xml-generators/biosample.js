const chalk = require('chalk');

const xmlService = require('../../services/xml-service');
const logger = require('../../services/logger')('a', 'biosample');

module.exports = {
    generate: (data, values, config, debug = false) => {
        let attributes = [];
        let columnIndices = data.metadata.columnIndices;
        let columnIndexMap = data.metadata.columnIndexMap;

        values.forEach((val, i) => {
            // These indices are handled separately in the data object
            let indicesToIgnore = [
                'sample_name', 'description',
                'organism',
                'bioproject_accession',
                'attribute_package',

                // These indices are not confirmed to match the tsv format of NCBI
                'taxonomy', 'label', 'breed', 'cultivar',
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
                        '#text': getRowValue(data, values, 'sample_name')
                    }
                },
                Descriptor: {
                    ...(columnIndexMap['title'] && values[columnIndexMap['title']] && { 'Title': getRowValue(data, values, 'title') }),
                    Description: getRowValue(data, values, 'description'),
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
                    PrimaryId: getRowValue(data, values, 'bioproject_accession')
                },
                // Name of attribute package used to validate the sample, for example: MIGS.ba.air.4.0. 
                // See https://www.ncbi.nlm.nih.gov/biosample/docs/packages/ for the full list of available packages.
                Package: getRowValue(data, values, 'attribute_package'),
                Attributes: {
                    Attribute: attributes
                }
            }
        };

        let validationObj = xmlService.validateXml('BioSample', bioSampleXml, true);
        if (!validationObj.isValid) {
            logger.log(chalk.red(
                '\nThere is a validation problem with a BioSample instance in this submission\n' 
                + 'This sample will not be excluded in the submission xml, and should not effect the\n'
                + 'other intended uploads. However, it will likely fail in the NCBI submission portal.\n\n'
                + 'The relevant BioSample segment has been written to your log file.\n'
                + 'If this problem persists, please send your debug.log to the dev team. ')
                + chalk.red.dim('Thank you!')
            , false);

            logger.debug('BioSample Validation Error:', debug);
            logger.debug(validationObj.validationErrors, debug);
            logger.debug(validationObj.xml, debug);
        }

        return bioSampleXml;
    }
}