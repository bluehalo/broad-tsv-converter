const assert = require('assert');
const cmdParser = require('../../src/scripts/command-parser');

let command;
let actualParams;

describe('Command Line Parsing', function() {
    describe('TSV Conversion Variables', () => {
        describe(`extracts 'input'`, () => {
            it(`extracts 'input'`, () => {
                command = ['input=testing.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.notStrictEqual(actualParams.inputFilename, 'testing.tsv');
    
                command = ['inputFile=testing.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.notStrictEqual(actualParams.inputFilename, 'testing.tsv');
    
                command = ['--input=testing.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.notStrictEqual(actualParams.inputFilename, 'testing.tsv');
    
                command = ['--inputfile=testing.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.notStrictEqual(actualParams.inputFilename, 'testing.tsv');
    
                command = ['-i=testing.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
            });

            it('extracts filetype details', () => {
                command = ['-i=testing.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.fileType, 'tsv');
            })

            it('sets outputfile details', () => {
                command = ['-i=testing.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.outputFilename, 'testing');
            })

            it('sets outputfilePath details', () => {
                command = ['-i=testing.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert(actualParams.outputFilepath !== undefined);
            })
        })

        describe(`extracts 'output'`, () => {
            it(`extracts 'output'`, () => {
                command = ['output=submission.xml'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.outputFilename, 'submission.xml');

                command = ['outputFile=submission.xml'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.outputFilename, 'submission.xml');

                command = ['--outputFile=submission.xml'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.outputFilename, 'submission.xml');

                command = ['-o=submission.xml'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.outputFilename, 'submission.xml');
            });

            it('sets outputfilePath details', () => {
                command = ['-o=submission.xml'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert(actualParams.outputFilepath !== undefined);
            });

            it(`should override the default input`, () => {
                command = ['-i=wrong.tsv', '-o=submission.xml'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.outputFilename, 'submission.xml');

                command = ['-o=submission.xml', '-i=wrong.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.outputFilename, 'submission.xml');
            });
        });

        it(`extracts 'uploadComment'`, () => {
            command = ['uploadComment=comment'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.comment, 'comment');

            command = ['--uploadComment=this is a comment'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.comment, 'this is a comment');

            command = [`-c=this is a comment`];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.comment, 'this is a comment');
        });

        it(`extracts 'hold'`, () => {
            command = ['hold=1/2/2020'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.hold, '1/2/2020');

            command = ['--hold=1/2/2020'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.hold, '1/2/2020');

            command = ['releaseDate=1/2/2020'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.hold, '1/2/2020');

            command = ['--releasedate=1/2/2020'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.hold, '1/2/2020');

            command = ['-d=1/2/2020'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.hold, '1/2/2020');
        });
    });

    describe('File Upload Variables', () => {

        it(`extracts 'uploadFolder'`, () => {
            command = ['uploadFolder=folder'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.uploadFolder, 'folder');

            command = ['--uploadfolder=folder'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.uploadFolder, 'folder');

            command = ['-u=path/to/folder'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.uploadFolder, 'path/to/folder');
        });

        it(`extracts 'uploadFiles'`, () => {
            command = ['uploadFiles=submission.xml'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.uploadFiles.length, 1);
            assert.equal(actualParams.uploadFiles, 'submission.xml');

            command = ['uploadFiles=submission.xml,something.zip'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert.equal(actualParams.uploadFiles.length, 2);
            assert.equal(actualParams.uploadFiles[0], 'submission.xml');
            assert.equal(actualParams.uploadFiles[1], 'something.zip');
        });

        describe(`extracts 'poll`, () => {
            it(`should select 'all' by default`, () => {
                command = ['i=biosample-example.tsv'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.poll, 'all');
            });

            it(`should extract 'poll' if number`, () => {
                command = ['poll=1'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.poll, 1);
            });

            it(`should extract 'poll' if valid string 'all'`, () => {
                command = ['--poll=all'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.poll, 'all');
            });

            it(`should extract 'poll' if valid string 'disabled'`, () => {
                command = ['poll=disabled'];
                actualParams = cmdParser.extractRequestVariables(command);
                assert.equal(actualParams.poll, 'disabled');
            });

            it(`should throw error otherwise`, () => {
                let willThrow = () => {
                    command = ['poll=asdf'];
                    cmdParser.extractRequestVariables(command);
                };
                assert.throws(willThrow, Error, `Invalid input: poll must either be a number or 'all' or 'disabled'`);
            });
        });

        it(`extracts 'uploaded'`, () => {
            command = ['--uploaded=here'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert(actualParams.uploaded);

            command = ['uploaded=here'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert(actualParams.uploaded);

            command = ['uploaded'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert(actualParams.uploaded);
        });
    });

    describe('Process Variables', () => {
        it(`extracts 'force'`, () => {
            command = ['force'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert(actualParams.force);

            command = ['force=123'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert(actualParams.force);

            command = ['--force'];
            actualParams = cmdParser.extractRequestVariables(command);
            assert(actualParams.force);
        });
    });

});

