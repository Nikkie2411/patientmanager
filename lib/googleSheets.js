const { google } = require('googleapis');

function cleanEnv(value) {
    if (!value) return undefined;
    let clean = value.replace(/^["']|["']$/g, '');
    clean = clean.replace(/\\n/g, '\n');
    return clean;
}

const SPREADSHEET_ID = cleanEnv(process.env.GOOGLE_SHEETS_ID) || '1EXoMPzAI66xQkEu9e5SsWedssrlt3v5iG1p1steYlk8';

async function getGoogleSheetsClient() {
    const email = cleanEnv(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    const privateKey = cleanEnv(process.env.GOOGLE_PRIVATE_KEY);

    console.log('--- Configured Email ---');
    console.log('Email:', email);
    console.log('------------------------');

    if (!email || !privateKey) {
        throw new Error('Google Service Account credentials are missing');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: email,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    return sheets;
}

module.exports = {
    getGoogleSheetsClient,
    SPREADSHEET_ID
};
