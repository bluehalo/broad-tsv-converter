const fs = require('fs');
const path = require('path');

const builder = require('xmlbuilder');
const libxmljs = require('libxmljs');
const parser = require('xml2js');

const logger = require('./logger')('a', 'xml-service');

module.exports = {
    parseXml: async (xmlString) => {
        return await parser.parseStringPromise(xmlString);
    },

    buildXml: (xmlString) => {
        return builder
            .create(xmlString)
            .end({ pretty: true });
    },

    validateXml: (xsd, xml, buildFromString, debug = false) => {
        if (buildFromString) {
            xml = module.exports.buildXml(xml);
        }
    
        let xsdString = fs.readFileSync(path.resolve(__dirname, `../xsds/${xsd}.xsd`));
        let xsdSchema = libxmljs.parseXml(xsdString, {baseUrl: path.resolve(__dirname, `../xsds/`)});
        let xmlDoc = libxmljs.parseXml(xml.toString());
    
        if (!xmlDoc.validate(xsdSchema)) {
            logger.debug(`Validation Error: ${xsd}`, debug);
            logger.debug(xmlDoc.validationErrors, debug);
            logger.debug(xml.toString(), debug);
        }
    
        return {
            isValid: xmlDoc.validate(xsdSchema),
            errors: xmlDoc.validationErrors,
            xml: xml
        };
    }
    
};