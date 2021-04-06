


This script is intended to convert the NCBI tsv file format into xml format, and submit it through 
an ftp upload.

https://www.ncbi.nlm.nih.gov/viewvc/v1/trunk/submit/public-docs/common/docs/UI-lessSubmissionProtocol.docx?revision=71197

--------------------------------------------------
  Script Prerequisites
--------------------------------------------------

Before running the script, you will need to do the following steps:
1. Run \`npm install\`
2. Modify the "src/config.js" file to enter your:
    A. FTP connection information
    B. Organization information
    C. Submitter information
3. Move the TSV files you would like converted into the "files" folder

--------------------------------------------------
  How to Use
--------------------------------------------------
Parameter      |    |            | Description        
help           | -h |            | print help table
inputFilename  | -i | (required) | filename for the tsv file to be uploaded
outputFilename | -o | (optional) | filename to write the generated xml file to. Default value will use inputFilename
uploadFolder   | -u | (optional) | if provided, the generated xml file will be uploaded through ftp to the specified folder
uploadComment  | -c | (optional) | description or comment about this submission
releaseDate    | -d | (optional) | All data in this submission is requested to be publicly released on or after this date; example: '2017-01-01'
--------------------------------------------------

Example:
node main.js -i=sample.tsv -c="this is a comment" --uploadFolder=folder

--------------------------------------------------

Going through the flow:

1. drop your file into the "/files".
2. from the root, run `node src/main.js -i=sample.tsv -c="this is a comment" --uploadFolder=folder --runTestMode=true`
3. The script will now generate "sample-submission.xml" from your sample.tsv file, and save it in /files.
4. If you choose an upload folder, the script will also generate a "sample-attributes.tsv" file from the "sample-report.xml" file

--------------------------------------------------