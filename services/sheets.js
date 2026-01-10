const { getGoogleSheetsClient, SPREADSHEET_ID } = require('../lib/googleSheets');

class GoogleSheetService {
    async getSystemConfig(key) {
        const sheets = await getGoogleSheetsClient();
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'SystemConfig!A:B',
            });
            const rows = response.data.values || [];
            const row = rows.find(r => r[0] === key);
            return row ? row[1] : null;
        } catch (error) {
            if (error.code === 404 || error.message.includes('not found')) {
                await this.ensureSystemConfigSheet();
                return null;
            }
            throw error;
        }
    }

    async setSystemConfig(key, value) {
        const sheets = await getGoogleSheetsClient();
        await this.ensureSystemConfigSheet();

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'SystemConfig!A:A',
        });
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(r => r[0] === key);

        if (rowIndex === -1) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'SystemConfig!A:B',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[key, value]] },
            });
        } else {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `SystemConfig!A${rowIndex + 1}:B${rowIndex + 1}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[key, value]] },
            });
        }
    }

    async ensureSystemConfigSheet() {
        const sheets = await getGoogleSheetsClient();
        const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const exists = metadata.data.sheets?.some(s => s.properties?.title === 'SystemConfig');

        if (!exists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [{
                        addSheet: { properties: { title: 'SystemConfig' } }
                    }]
                }
            });
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'SystemConfig!A1:B1',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [['ConfigKey', 'ConfigValue']] },
            });
        }
    }

    async getPatients() {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patients!A2:G',
        });
        const rows = response.data.values || [];
        return rows.map(row => ({
            id: row[0],
            full_name: row[1],
            dob: row[2],
            gender: row[3],
            gestational_age_weeks: Number(row[4]),
            department: row[5] || '',
            alertStatus: row[6] || 'Normal',
        }));
    }

    async addPatient(patient) {
        const sheets = await getGoogleSheetsClient();
        const existing = await this.getPatients();
        if (existing.some(p => p.id === patient.id)) {
            throw new Error(`Patient ID ${patient.id} already exists`);
        }
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patients!A:G',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[patient.id, patient.full_name, patient.dob, patient.gender, patient.gestational_age_weeks, patient.department || '', patient.alertStatus || 'Normal']],
            },
        });
    }

    async updatePatient(patient) {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patients!A:A',
        });
        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === patient.id);
        if (rowIndex === -1) throw new Error('Patient not found');
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Patients!A${rowIndex + 1}:G${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[patient.id, patient.full_name, patient.dob, patient.gender, patient.gestational_age_weeks, patient.department || '', patient.alertStatus || 'Normal']],
            },
        });
    }

    async deletePatient(id) {
        const sheets = await getGoogleSheetsClient();
        const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

        const getSheetId = (title) => {
            const sheet = metadata.data.sheets?.find(s => s.properties?.title === title);
            return sheet?.properties?.sheetId;
        };

        const patientsSheetId = getSheetId('Patients');
        const logsSheetId = getSheetId('DailyLogs');
        const antibioticsSheetId = getSheetId('Antibiotics');

        const patientsResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Patients!A:A',
        });
        const patientRows = patientsResponse.data.values || [];
        const patientRowIndex = patientRows.findIndex(row => row[0] === id);

        if (patientRowIndex === -1) throw new Error('Patient not found');

        const logs = await this.getDailyLogs(id);
        const antibiotics = await this.getAntibiotics(id);

        const requests = [];
        const addDeleteRequests = (sheetId, indices) => {
            if (sheetId === undefined) return;
            indices.sort((a, b) => b - a).forEach(index => {
                requests.push({
                    deleteDimension: {
                        range: { sheetId, dimension: 'ROWS', startIndex: index, endIndex: index + 1 },
                    },
                });
            });
        };

        addDeleteRequests(patientsSheetId, [patientRowIndex]);
        addDeleteRequests(logsSheetId, logs.map(l => l._rowIndex).filter(i => i !== undefined));
        addDeleteRequests(antibioticsSheetId, antibiotics.map(a => a._rowIndex).filter(i => i !== undefined));

        if (requests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: { requests },
            });
        }
    }

    async getDailyLogs(patientId) {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'DailyLogs!A:F',
        });
        const rows = response.data.values || [];
        return rows
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => row[0] === patientId)
            .map(({ row, index }) => ({
                patient_id: row[0],
                date: row[1],
                weight: Number(row[2]),
                height: row[3] ? Number(row[3]) : undefined,
                postnatal_age_days: Number(row[4]),
                creatinine: row[5] ? Number(row[5]) : undefined,
                _rowIndex: index,
            }));
    }

    async addDailyLog(log) {
        const sheets = await getGoogleSheetsClient();
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'DailyLogs!A:F',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[log.patient_id, log.date, log.weight, log.height, log.postnatal_age_days, log.creatinine]],
            },
        });
    }

    async getAntibiotics(patientId) {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Antibiotics!A:H',
        });
        const rows = response.data.values || [];
        return rows
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => row[0] === patientId)
            .map(({ row, index }) => ({
                patient_id: row[0],
                drug_name: row[1],
                start_date: row[2],
                dose: row[3],
                frequency: row[4],
                status: row[5],
                isCriticallyIll: row[6] === 'TRUE',
                hasAlert: row[7] === 'TRUE',
                _rowIndex: index,
            }));
    }

    async addAntibiotic(antibiotic) {
        const sheets = await getGoogleSheetsClient();
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Antibiotics!A:H',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    antibiotic.patient_id,
                    antibiotic.drug_name,
                    antibiotic.start_date,
                    antibiotic.dose,
                    antibiotic.frequency,
                    antibiotic.status,
                    antibiotic.isCriticallyIll ? 'TRUE' : 'FALSE',
                    antibiotic.hasAlert ? 'TRUE' : 'FALSE'
                ]],
            },
        });
    }

    async updateAntibiotic(rowIndex, antibiotic) {
        const sheets = await getGoogleSheetsClient();
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Antibiotics!A${rowIndex + 1}:H${rowIndex + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    antibiotic.patient_id,
                    antibiotic.drug_name,
                    antibiotic.start_date,
                    antibiotic.dose,
                    antibiotic.frequency,
                    antibiotic.status,
                    antibiotic.isCriticallyIll ? 'TRUE' : 'FALSE',
                    antibiotic.hasAlert ? 'TRUE' : 'FALSE'
                ]],
            },
        });
    }

    async getAccounts() {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Accounts!A2:D',
        });
        const rows = response.data.values || [];
        const accountsMap = new Map();
        rows.forEach(row => {
            const username = row[0];
            const department = row[2];
            const email = row[3];
            if (!accountsMap.has(username)) {
                accountsMap.set(username, { username, full_name: username, department, emails: [] });
            }
            if (email) accountsMap.get(username).emails.push(email);
        });
        return Array.from(accountsMap.values());
    }

    async checkAccountCredentials(username, password) {
        const sheets = await getGoogleSheetsClient();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Accounts!A2:D',
        });
        const rows = response.data.values || [];
        const matchingRows = rows.filter(row => row[0] === username);
        if (matchingRows.length === 0) return null;
        if (password && matchingRows[0][1] !== password) return null;
        return {
            username: matchingRows[0][0],
            full_name: matchingRows[0][0],
            department: matchingRows[0][2],
            emails: matchingRows.map(row => row[3]).filter(Boolean)
        };
    }

    async getDepartments() {
        const sheets = await getGoogleSheetsClient();
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Departments!A:A',
            });
            const rows = response.data.values || [];
            return rows.flat().filter(d => d && d !== 'Tên khoa');
        } catch (error) {
            return ['Khoa Điều trị tích cực sơ sinh', 'Khoa Sơ sinh', 'Khoa Điều trị tích cực Ngoại khoa', 'Khoa Điều trị tích cực Nội khoa'];
        }
    }
}

module.exports = new GoogleSheetService();
