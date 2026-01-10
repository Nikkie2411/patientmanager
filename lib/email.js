const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

async function sendAlertEmail(to, subject, text) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.log('Mock Email Send:', { to, subject, text });
        return { success: true, mock: true };
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to,
            subject,
            text,
        });
        console.log('Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
}

module.exports = {
    sendAlertEmail
};
