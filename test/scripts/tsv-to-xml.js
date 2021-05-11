const assert = require('assert');
const fs = require('fs');

const cmdParser = require('../../src/scripts/command-parser');
const xmlService = require('../../src/services/xml-service');
const testHelpers = require('./test-helpers');

const proxyquire = require('proxyquire');
let tsvConverter;

let commands;
let params;

generateXml = async (conf, commands) => {
    tsvConverter = proxyquire('../../src/scripts/tsv-to-xml', {
        '../config': conf
    });
    params = cmdParser.extractRequestVariables(commands);
    await tsvConverter.process(params);

    let inputFileContent = fs.readFileSync(params.outputFilepath, 'utf8');
    return await xmlService.parseXml(inputFileContent);
}

describe('TSV to XML', function() {
    it('Should generate submission xml', async () => {
        commands = [
            '-i=tests/sample.tsv',
            '--force', '--runTestMode'
        ];
        try {
            let xml = await generateXml(testHelpers.MINIMAL_CONFIG, commands);
        } catch(err) {
            assert();
        }
    });

    describe('Config Changes', () => {
        it('should successfully parse minimum required config', async () => {
            commands = [ '-i=tests/sample.tsv', '--force', '--runTestMode' ];
            let xml = await generateXml(testHelpers.MINIMAL_CONFIG, commands);
            let xmlDesc = xml.Submission.Description[0];
            let xmlAction = xml.Submission.Action;

            // Test Description Block
            assert.equal(xmlDesc.SubmissionSoftware[0].$.version, 'asymmetrik-tsv@1.0.0');
            assert.equal(xmlDesc.Organization[0].$.type, 'institute');
            assert.equal(xmlDesc.Organization[0].Name[0], 'Gotham Institute');
            assert.equal(xmlDesc.Organization[0].Contact[0].$.email, 'batman@email.com');

            // Test Action Blocks
            assert.equal(xmlAction.length, 3);
            assert.equal(xmlAction[0].AddData[0].Data[0].XmlContent[0].BioSample[0].SampleId[0].SPUID[0].$.spuid_namespace, 'InstituteNamespace')
        });

        it('should include extra organization information if provided ', async () => {
            let config = {
                organizationConfig: {
                    name: 'Gotham Institute',
                    type: 'institute',
                    spuid_namespace: 'InstituteNamespace',
                    contact: {
                        email: 'batman@email.com'
                    },
                    role: 'owner',
                    org_id: 123,
                    group_id: 'group_id',
                    url: 'url',
                    address: {
                        department: 'Department of Villains',
                        institution: 'Gotham Institute',
                        street: '123 fake street',
                        city: 'Gotham',
                        state: 'Metropolis',
                        country: 'USA',
                        postal_code: 12333
                    }
                }
            };
            commands = [ '-i=tests/sample.tsv', '--force', '--runTestMode' ];
            let xml = await generateXml(config, commands);
            let xmlOrg = xml.Submission.Description[0].Organization[0];
            
            assert.equal(xmlOrg.$.role, 'owner');
            assert.equal(xmlOrg.$.org_id, '123');
            assert.equal(xmlOrg.$.group_id, 'group_id');
            assert.equal(xmlOrg.$.url, 'url');

            assert.equal(xmlOrg.Address[0].$.postal_code, 12333);
            assert.equal(xmlOrg.Address[0].Department[0], 'Department of Villains');
            assert.equal(xmlOrg.Address[0].Institution[0], 'Gotham Institute');
            assert.equal(xmlOrg.Address[0].Street[0], '123 fake street');
            assert.equal(xmlOrg.Address[0].City[0], 'Gotham');
            assert.equal(xmlOrg.Address[0].Sub[0], 'Metropolis');
            assert.equal(xmlOrg.Address[0].Country[0], 'USA');
        });

        it('should include submitter information if provided ', async () => {
            let config = {
                organizationConfig: {
                    name: 'Gotham Institute',
                    type: 'institute',
                    spuid_namespace: 'InstituteNamespace',
                    contact: {
                        email: 'batman@email.com'
                    }
                },
                submitterConfig: {
                    account_id: 'accountId',
                    contact: {
                        email: 'test@email.com'
                    }
                }
            };
            commands = [ '-i=tests/sample.tsv', '--force', '--runTestMode' ];
            let xml = await generateXml(config, commands);
            let xmlSubmitter = xml.Submission.Description[0].Submitter[0];

            assert.equal(xmlSubmitter.$.account_id, 'accountId');
            assert.equal(xmlSubmitter.Contact[0].$.email, 'test@email.com');
        });
    });

    describe('Command Line Parameters', () => {
        it('Should append command line properties (releaseDate, comments)', async () => {
            commands = [
                '-i=tests/sample.tsv',
                '-c=this is a fun comment!',
                '--releasedate=2017-01-01',
                '--force', '--runTestMode'
            ];
            let xml = await generateXml(testHelpers.MINIMAL_CONFIG, commands);
            let xmlDesc = xml.Submission.Description[0];
            let xmlAction = xml.Submission.Action;

            // Test Description Block
            assert.equal(xmlDesc.Comment[0], 'this is a fun comment!');
            assert.equal(xmlDesc.Hold[0].$.release_date, '2017-01-01');

            // Test Action Blocks
            assert.equal(xmlAction.length, 3);
        })

        it('Should add comments, and release date', async () => {
            let config = {
                organizationConfig: {
                    name: 'Gotham Institute',
                    type: 'institute',
                    spuid_namespace: 'InstituteNamespace',
                    contact: {
                        email: 'batman@email.com'
                    }
                }
            };

            commands = [
                '-i=tests/sample.tsv',
                '-c=this is a fun comment!',
                '--releasedate=2017-01-01',
                '--force', '--runTestMode'
            ];
            let xml = await generateXml(config, commands);
            let xmlDesc = xml.Submission.Description[0];

            // Test Description Block
            assert.equal(xmlDesc.Comment[0], 'this is a fun comment!');
            assert.equal(xmlDesc.Hold[0].$.release_date, '2017-01-01');
        })
    });

    describe('Processing File Data', () => {
        it('Should properly render AddData fields per row of the tsv file', async () => {
            commands = [
                '-i=tests/sample.tsv',
                '-c=this is a fun comment!',
                '--releasedate=2017-01-01',
                '--force', '--runTestMode'
            ];
            let xml = await generateXml(testHelpers.MINIMAL_CONFIG, commands);
            let xmlActions = xml.Submission.Action;
            let action;

            assert.equal(xmlActions.length, 3);
            
            // First action
            action = xmlActions[0];
            assert.equal(action.AddData[0].$.target_db, 'BioSample');
            assert.equal(action.AddData[0].Identifier[0].SPUID[0]._, 'name1');
            assert.equal(action.AddData[0].Identifier[0].SPUID[0].$.spuid_namespace, 'InstituteNamespace');
            assert.equal(action.AddData[0].Data[0].$.content_type, 'XML');
            assert.equal(action.AddData[0].Data[0].XmlContent[0].BioSample[0].$.schema_version, '2.0');
            assert.equal(action.AddData[0].Data[0].XmlContent[0].BioSample[0].SampleId[0].SPUID[0]._, 'name1');
            assert.equal(action.AddData[0].Data[0].XmlContent[0].BioSample[0].SampleId[0].SPUID[0].$.spuid_namespace, 'InstituteNamespace');
            assert.equal(action.AddData[0].Data[0].XmlContent[0].BioSample[0].Descriptor[0].Description[0], '');
            assert.equal(action.AddData[0].Data[0].XmlContent[0].BioSample[0].Organism[0].OrganismName[0], 'Severe acute respiratory syndrome coronavirus 2');
            assert.equal(action.AddData[0].Data[0].XmlContent[0].BioSample[0].Organism[0].IsolateName[0], 'SARS-CoV-2/Human/USA/MA-MGH-03863/2020');
            assert.equal(action.AddData[0].Data[0].XmlContent[0].BioSample[0].BioProject[0].PrimaryId[0], 'project-leona');
            assert.equal(action.AddData[0].Data[0].XmlContent[0].BioSample[0].Package[0], 'Pathogen.cl');

            let attributes = action.AddData[0].Data[0].XmlContent[0].BioSample[0].Attributes[0].Attribute;
            assert.equal(attributes[0].$.attribute_name, 'isolate');
            assert.equal(attributes[0]._, 'SARS-CoV-2/Human/USA/MA-MGH-03863/2020');
            assert.equal(attributes[1].$.attribute_name, 'collected_by');
            assert.equal(attributes[1]._, 'Massachusetts General Hospital');
            assert.equal(attributes[2].$.attribute_name, 'collection_date');
            assert.equal(attributes[2]._, '5/26/2020');
            assert.equal(attributes[3].$.attribute_name, 'geo_loc_name');
            assert.equal(attributes[3]._, 'USA: Massachusetts');
            assert.equal(attributes[4].$.attribute_name, 'isolation_source');
            assert.equal(attributes[4]._, 'Clinical');
            assert.equal(attributes[5].$.attribute_name, 'lat_lon');
            assert.equal(attributes[5]._, 'missing');
            assert.equal(attributes[6].$.attribute_name, 'host');
            assert.equal(attributes[6]._, 'Homo sapiens');
            assert.equal(attributes[7].$.attribute_name, 'host_disease');
            assert.equal(attributes[7]._, 'COVID-19');
            assert.equal(attributes[8].$.attribute_name, 'host_subject_id');
            assert.equal(attributes[8]._, 'MA-MGH-03863');
            assert.equal(attributes[9].$.attribute_name, 'anatomical_part');
            assert.equal(attributes[9]._, 'Nasopharynx (NP)');
            assert.equal(attributes[10].$.attribute_name, 'body_product');
            assert.equal(attributes[10]._, 'Mucus');
            assert.equal(attributes[11].$.attribute_name, 'purpose_of_sampling');
            assert.equal(attributes[11]._, 'Diagnostic Testing');
            assert.equal(attributes[12].$.attribute_name, 'purpose_of_sequencing');
            assert.equal(attributes[12]._, 'Longitudinal surveillance (repeat sampling)');
        });
    });
});

