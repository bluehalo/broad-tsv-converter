const fs = require('fs');
const path = require('path');

const builder = require('xmlbuilder');
const libxmljs = require('libxmljs');

const logger = require('./logger')('a', 'xml-service');

module.exports = {
    buildXml: (xmlString) => {
        return builder
            .create(xmlString)
            .end({ pretty: true });
    },

    validateXml: (xsd, xml, buildFromString) => {
        if (buildFromString) {
            xml = module.exports.buildXml(xml);
        }
    
        let xsdString = fs.readFileSync(path.resolve(__dirname, `../xsds/${xsd}.xsd`));
        let xsdSchema = libxmljs.parseXml(xsdString, {baseUrl: path.resolve(__dirname, `../xsds/`)});
        let xmlDoc = libxmljs.parseXml(xml.toString());
    
        if (!xmlDoc.validate(xsdSchema)) {
            logger.debug(`Validation Error: ${xsd}`);
            logger.debug(xmlDoc.validationErrors);
            logger.debug(xml.toString());
        }
    
        return {
            isValid: xmlDoc.validate(xsdSchema),
            errors: xmlDoc.validationErrors,
            xml: xml
        };
    }
    
};