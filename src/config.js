//-------------------------------------------
//             FTP Configuration
//-------------------------------------------
exports.ftpConfig = {
    host: 'ftp.some.net',
    port: 21,
    user: 'username',
    pass: 'pass',
    pollingInterval: 3000 // check on submission results every {x} milliseconds
};

//-------------------------------------------
//         Organization Configuration
//-------------------------------------------
exports.organizationConfig = {

    //------------------------
    // Required Fields
    //------------------------
    name: 'Broad Institute',
    type: 'institute',  // Options: 'consortium', 'center', 'institute', 'lab'
    spuid_namespace: 'Institute Namespace',
    contact: {
        email: 'organizationemail@email.com'

        // --- Optional Contact Fields
        // secondary_email: '',
        // phone: '',
        // fax: ''/
    },

    //------------------------
    // Optional Fields
    //------------------------
    // role: 'owner',      // Options: 'owner', 'participant'
    // org_id: 111,
    // group_id: 'FAKEGROUPID',
    // url: 'FAKEURL',
    // address: {
    //     department: '', // Eg: Department of Medicine
    //     institution: '', // Eg: Washington University
    //     street: '',
    //     city: '',
    //     state: '', // State or Province
    //     country: '',
    //     postal_code: ''
    // }
};

//-------------------------------------------
//          Submitter Configuration
//  Note: Uncomment block to use
//-------------------------------------------
// exports.submitterConfig = {
//     account_id: 'account Id',
//     contact: {
//         email: 'clu@asymmetrik.com'
//     }
// };
