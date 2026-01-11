const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    connectionTimeout: 10000, // 10 seconds
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

async function sendAlertEmail(to, subject, text) {
    console.log('[sendAlertEmail] Called for:', to);
    console.log('[sendAlertEmail] ENV check - GMAIL_USER:', process.env.GMAIL_USER ? 'SET' : 'NOT SET');
    console.log('[sendAlertEmail] ENV check - GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'SET' : 'NOT SET');

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.log('[sendAlertEmail] Using MOCK mode (missing credentials)');
        console.log('Mock Email Send:', { to, subject, text });
        return { success: true, mock: true };
    }

    try {
        console.log('[sendAlertEmail] Attempting real SMTP send...');
        const info = await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to,
            subject,
            text,
        });
        console.log('[sendAlertEmail] SUCCESS - Message ID:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[sendAlertEmail] FAILED:', error.message);
        console.error('[sendAlertEmail] Full error:', error);
        return { success: false, error };
    }
}

module.exports = {
    sendAlertEmail
};
