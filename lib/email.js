const sgMail = require('@sendgrid/mail');

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

async function sendAlertEmail(to, subject, text, html) {
    console.log('[sendAlertEmail] Called for:', to);
    console.log('[sendAlertEmail] ENV check - SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'SET' : 'NOT SET');

    if (!process.env.SENDGRID_API_KEY) {
        console.log('[sendAlertEmail] Using MOCK mode (missing SENDGRID_API_KEY)');
        console.log('Mock Email Send:', { to, subject, text });
        return { success: true, mock: true };
    }

    try {
        console.log('[sendAlertEmail] Attempting SendGrid API send...');

        const msg = {
            to: to,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@patientmanager.com',
            subject: subject,
        };

        // Use HTML if provided, otherwise plain text
        if (html) {
            msg.html = html;
        } else {
            msg.text = text;
        }

        const response = await sgMail.send(msg);
        console.log('[sendAlertEmail] SUCCESS - Status:', response[0].statusCode);
        return { success: true, statusCode: response[0].statusCode };
    } catch (error) {
        console.error('[sendAlertEmail] FAILED:', error.message);
        if (error.response) {
            console.error('[sendAlertEmail] Error details:', error.response.body);
        }
        return { success: false, error };
    }
}

module.exports = {
    sendAlertEmail
};
