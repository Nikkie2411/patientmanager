const { Resend } = require('resend');

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendAlertEmail(to, subject, text, html) {
    console.log('[sendAlertEmail] Called for:', to);
    console.log('[sendAlertEmail] ENV check - RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'SET' : 'NOT SET');

    if (!process.env.RESEND_API_KEY) {
        console.log('[sendAlertEmail] Using MOCK mode (missing RESEND_API_KEY)');
        console.log('Mock Email Send:', { to, subject, text });
        return { success: true, mock: true };
    }

    try {
        console.log('[sendAlertEmail] Attempting Resend API send...');
        const emailData = {
            from: 'Patient Manager <onboarding@resend.dev>',
            to: [to],
            subject: subject,
        };

        // Use HTML if provided, otherwise plain text
        if (html) {
            emailData.html = html;
        } else {
            emailData.text = text;
        }

        const data = await resend.emails.send(emailData);
        console.log('[sendAlertEmail] SUCCESS - Email ID:', data.id);
        return { success: true, emailId: data.id };
    } catch (error) {
        console.error('[sendAlertEmail] FAILED:', error.message);
        console.error('[sendAlertEmail] Full error:', error);
        return { success: false, error };
    }
}

module.exports = {
    sendAlertEmail
};
