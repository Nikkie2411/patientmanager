const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');

// Initialize MailerSend
const mailerSend = new MailerSend({
    apiKey: process.env.MAILERSEND_API_KEY || '',
});

async function sendAlertEmail(to, subject, text, html) {
    console.log('[sendAlertEmail] Called for:', to);
    console.log('[sendAlertEmail] ENV check - MAILERSEND_API_KEY:', process.env.MAILERSEND_API_KEY ? 'SET' : 'NOT SET');

    if (!process.env.MAILERSEND_API_KEY || !process.env.MAILERSEND_FROM_EMAIL) {
        console.log('[sendAlertEmail] Using MOCK mode (missing credentials)');
        console.log('Mock Email Send:', { to, subject, text });
        return { success: true, mock: true };
    }

    try {
        console.log('[sendAlertEmail] Attempting MailerSend API send...');

        const sentFrom = new Sender(
            process.env.MAILERSEND_FROM_EMAIL,
            process.env.MAILERSEND_FROM_NAME || 'Patient Manager'
        );

        const recipients = [new Recipient(to, to)];

        const emailParams = new EmailParams()
            .setFrom(sentFrom)
            .setTo(recipients)
            .setSubject(subject);

        // Use HTML if provided, otherwise plain text
        if (html) {
            emailParams.setHtml(html);
        } else {
            emailParams.setText(text);
        }

        const response = await mailerSend.email.send(emailParams);
        console.log('[sendAlertEmail] SUCCESS - Response:', response.statusCode);
        return { success: true, response };
    } catch (error) {
        console.error('[sendAlertEmail] FAILED:', error.message);
        if (error.body) {
            console.error('[sendAlertEmail] Error details:', JSON.stringify(error.body));
        }
        return { success: false, error };
    }
}

module.exports = {
    sendAlertEmail
};
