require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sheetsService = require('./services/sheets');
const guidelineService = require('./services/guidelines');
const alertService = require('./services/alerts');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Auth
app.post('/api/auth/check', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await sheetsService.checkAccountCredentials(username, password);
        if (user) res.json(user);
        else res.status(401).json({ error: 'Invalid credentials' });
    } catch (error) {
        console.error('Auth Check Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Patients
app.get('/api/patients', async (req, res) => {
    try {
        const patients = await sheetsService.getPatients();
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/patients', async (req, res) => {
    try {
        await sheetsService.addPatient(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/patients', async (req, res) => {
    try {
        await sheetsService.updatePatient(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/patients/:id', async (req, res) => {
    try {
        await sheetsService.deletePatient(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logs
app.get('/api/patients/:id/logs', async (req, res) => {
    try {
        const logs = await sheetsService.getDailyLogs(req.params.id);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logs', async (req, res) => {
    try {
        await sheetsService.addDailyLog(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/logs/:index', async (req, res) => {
    try {
        await sheetsService.updateDailyLog(Number(req.params.index), req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/logs/:index', async (req, res) => {
    try {
        await sheetsService.deleteRow('DailyLogs', Number(req.params.index));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Antibiotics
app.get('/api/patients/:id/antibiotics', async (req, res) => {
    try {
        const abx = await sheetsService.getAntibiotics(req.params.id);
        res.json(abx);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/antibiotics', async (req, res) => {
    try {
        console.log('[POST /api/antibiotics] Received:', { drug: req.body.drug_name, hasAlert: req.body.hasAlert });
        await sheetsService.addAntibiotic(req.body);
        if (req.body.hasAlert) {
            console.log('[POST /api/antibiotics] Triggering manual alert email...');
            // Async send manual alert email
            alertService.sendManualEntryAlert(
                req.body.patient_id,
                req.body.drug_name,
                req.body.dose,
                req.body.frequency,
                req.body.isCriticallyIll
            ).catch(err => console.error("[POST /api/antibiotics] Manual alert send error:", err));
        } else {
            console.log('[POST /api/antibiotics] No alert flag set');
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/antibiotics/:index', async (req, res) => {
    try {
        console.log('[PUT /api/antibiotics] Received:', { drug: req.body.drug_name, hasAlert: req.body.hasAlert });
        await sheetsService.updateAntibiotic(Number(req.params.index), req.body);
        if (req.body.hasAlert) {
            console.log('[PUT /api/antibiotics] Triggering manual alert email...');
            // Async send manual alert email on edit
            alertService.sendManualEntryAlert(
                req.body.patient_id,
                req.body.drug_name,
                req.body.dose,
                req.body.frequency,
                req.body.isCriticallyIll
            ).catch(err => console.error("[PUT /api/antibiotics] Manual alert send error:", err));
        } else {
            console.log('[PUT /api/antibiotics] No alert flag set');
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/antibiotics/:index', async (req, res) => {
    try {
        await sheetsService.deleteRow('Antibiotics', Number(req.params.index));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Accounts & Departments
app.get('/api/accounts', async (req, res) => {
    try {
        const accounts = await sheetsService.getAccounts();
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/config/departments', async (req, res) => {
    try {
        const depts = await sheetsService.getDepartments();
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/config/system', async (req, res) => {
    try {
        const value = await sheetsService.getSystemConfig(req.query.key);
        res.json(value);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/config/system', async (req, res) => {
    try {
        await sheetsService.setSystemConfig(req.body.key, req.body.value);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/config/antibiotics', async (req, res) => {
    try {
        const names = await guidelineService.getDistinctAntibiotics();
        res.json(names);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/validate-dosage', async (req, res) => {
    try {
        const { antibiotic, patient, currentLog } = req.body;
        const recommendation = await guidelineService.getRecommendedDosage(
            antibiotic.drug_name,
            patient,
            currentLog,
            antibiotic.isCriticallyIll ? 'TRUE' : 'FALSE'
        );
        if (!recommendation || !currentLog?.weight) return res.json({ isCompliant: true });
        const validation = guidelineService.checkGuidelineCompliance(antibiotic, recommendation, currentLog.weight);
        res.json({ ...validation, recommendation });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Test Email Endpoint
app.post('/api/test-email', async (req, res) => {
    try {
        const testEmail = req.body.email || 'test@example.com';
        console.log('[TEST EMAIL] Attempting to send test email to:', testEmail);
        const { sendAlertEmail } = require('./lib/email');
        await sendAlertEmail(testEmail, '[TEST] Email hoạt động', 'Đây là email test từ hệ thống Patient Manager.');
        console.log('[TEST EMAIL] Success');
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('[TEST EMAIL] Failed:', error);
        res.status(500).json({ error: error.message });
    }
});

// Daily Process
app.post('/api/run-daily', async (req, res) => {
    try {
        const summary = await alertService.runDailyProcess();
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
