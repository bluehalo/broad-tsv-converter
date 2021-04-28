


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

Example

```
node main.js -i=sample.tsv -c="this is a comment" --uploadFolder=folder
node main.js -i=sample.tsv --runTestMode --debug --force
node main.js --uploadFiles=sample.tsv,submission.xml -poll=1
node main.js --uploadFiles=sample.tsv,submission.xml -poll=disabled
```

| Parameter      |flag| Required    | Type | Default Value | Description |
|----------------|----|------------|-------|---|--------------|
| help           | -h |            |  |   |  print help table |
| inputFilename  | -i | (required) | string |   |  filename for the tsv file to be uploaded |
| uploadFiles    | -f | (required) | string |   |  (Either input filename or uploadFiles is required, but not both) comma separated list of files to upload |
| outputFilename | -o |            | string |   |  filename to write the generated xml file to. Default value will use inputFilename |
| uploadFolder   | -u |            | string |   |  if provided, the generated xml file will be uploaded through ftp to the specified folder |
| uploadComment  | -c |            | string |   |  description or comment about this submission |
| uploaded       |    |            |  | false  | Poll and check reports for a request that has already been uploaded |
| poll           |    |            | '(number)' \| 'all' \| 'disabled' | all | Poll until either this report number is hit or poll until all requests have been completed |
| processReport  | -r |            | string |   |  filename for report to convert to tsv - If upload folder is included, it will be downloaded from the FTP, otherwise, the script will look in the local files |
| releaseDate    | -d |            | datestring |   |  All data in this submission is requested to be publicly released on or after this date; example: '2017-01-01' | 
| runTestMode    |    |            |  |   |  Run the script in test mode (aka: skip ftp upload) | 
| debug          |    |            |  |   |  Show verbose logging details | 
| force          |    |            |  |   |  Force upload and processing, even when validation fails | 
--------------------------------------------------

Going through the flow:

1. drop your file into the "/files".
2. from the root, run `node src/main.js -i=sample.tsv -c="this is a comment" --uploadFolder=folder --runTestMode=true`
3. The script will now generate "sample-submission.xml" from your sample.tsv file, and save it in /files.
4. If you choose an upload folder, the script will also generate a "sample-attributes.tsv" file from the "sample-report.xml" file

--------------------------------------------------
  Example Usages
--------------------------------------------------
- Generate a biosample submission:
  - Generate a sample-submission.xml file from sample.tsv
  - Upload to ftp:/path/to/folder/submission.xml
  - Poll until submission processing has been completed
  - `node main.js -i=sample.tsv --uploadFolder=ftp:/path/to/folder`
- Generate a genbank submission:
  - Upload content.tsv and submission.xml to /path/to/folder
  - content.zip and submission.xml should be locally at ./files
  - Poll until report.1.xml is generated
  - `node main.js --uploadFiles=content.zip,submission.xml --uploadFolder=ftp:/path/to/folder -poll=1`
- Generate a tsv file from a report.xml file
  - convert report.5.xml file into report-attributes.tsv 
  - report.5.xml should be located in ./reports
  - `node main.js --inputFilename=sample.tsv --processReport=report.5.xml`
