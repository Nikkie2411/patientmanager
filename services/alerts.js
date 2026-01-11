const sheetsService = require('./sheets');
const guidelineService = require('./guidelines');
const { sendAlertEmail } = require('../lib/email');
const { createAlertEmailHTML } = require('../lib/emailTemplate');

class AlertService {
    async runDailyProcess() {
        try {
            const patients = await sheetsService.getPatients();
            const summary = {
                patientsChecked: 0,
                alertsGenerated: 0,
                emailsSent: 0
            };

            for (const patient of patients) {
                const logs = await sheetsService.getDailyLogs(patient.id);
                logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const latestLog = logs[0];

                if (!latestLog?.weight) continue;

                const antibiotics = await sheetsService.getAntibiotics(patient.id);
                let hasAnyAlert = false;

                for (const abx of antibiotics) {
                    if (abx.status !== 'Active') continue;

                    const recommendation = await guidelineService.getRecommendedDosage(
                        abx.drug_name,
                        patient,
                        latestLog,
                        abx.isCriticallyIll || 'FALSE'
                    );

                    if (!recommendation) continue;

                    const compliance = guidelineService.checkGuidelineCompliance(
                        abx,
                        recommendation,
                        latestLog.weight
                    );

                    if (!compliance.isCompliant) {
                        hasAnyAlert = true;
                        abx.hasAlert = true;
                        await sheetsService.updateAntibioticAlertFlag(
                            abx._rowIndex,
                            true
                        );
                    }
                }

                if (hasAnyAlert) {
                    summary.alertsGenerated++;
                    const accounts = await sheetsService.getAccounts();
                    const deptAccounts = accounts.filter(
                        a => a.department?.toLowerCase() === patient.department?.toLowerCase()
                    );

                    const emails = Array.from(new Set(deptAccounts.flatMap(a => a.emails)));
                    for (const email of emails) {
                        await sendAlertEmail(
                            email,
                            `Cảnh báo liều kháng sinh - ${patient.full_name}`,
                            `Phát hiện phác đồ kháng sinh cần điều chỉnh cho bệnh nhân ${patient.full_name}.`
                        );
                        summary.emailsSent++;
                    }
                }
            }
            return summary;
        } catch (error) {
            console.error("Daily process failed:", error);
            throw error;
        }
    }

    async sendManualEntryAlert(patientId, drugName, dose, frequency, isCriticallyIll) {
        console.log('[sendManualEntryAlert] STARTED for patient:', patientId, 'drug:', drugName);
        try {
            const patients = await sheetsService.getPatients();
            const patient = patients.find(p => p.id === patientId);
            if (!patient) {
                console.log('[sendManualEntryAlert] ERROR: Patient not found');
                return;
            }
            console.log('[sendManualEntryAlert] Patient found:', patient.full_name, 'Department:', patient.department);

            const dept = patient.department || 'Unknown';
            const logs = await sheetsService.getDailyLogs(patientId);
            logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const currentLog = logs[0];
            console.log('[sendManualEntryAlert] Latest weight:', currentLog?.weight, 'kg');

            const recommendation = await guidelineService.getRecommendedDosage(drugName, patient, currentLog, isCriticallyIll ? 'TRUE' : 'FALSE');
            if (!recommendation) {
                console.log('[sendManualEntryAlert] No recommendation found for:', drugName);
                return;
            }
            console.log('[sendManualEntryAlert] Recommendation:', recommendation);

            const compliance = guidelineService.checkGuidelineCompliance({ dose, frequency }, recommendation, currentLog?.weight);
            console.log('[sendManualEntryAlert] Compliance check:', compliance);
            if (compliance.isCompliant) {
                console.log('[sendManualEntryAlert] Compliant - No alert needed');
                return;
            }

            // Create HTML email using template
            const emailHTML = createAlertEmailHTML(
                patient,
                dept,
                drugName,
                dose,
                frequency,
                recommendation,
                currentLog?.weight,
                isCriticallyIll,
                compliance.message
            );

            const allAccounts = await sheetsService.getAccounts();
            console.log('[sendManualEntryAlert] Total accounts:', allAccounts.length);
            const deptAccounts = allAccounts.filter(a => a.department?.toLowerCase() === dept.toLowerCase());
            console.log('[sendManualEntryAlert] Accounts in department', dept, ':', deptAccounts.length);
            const emails = Array.from(new Set(deptAccounts.flatMap(a => a.emails)));
            console.log('[sendManualEntryAlert] Target emails:', emails);

            if (emails.length === 0) {
                console.log('[sendManualEntryAlert] WARNING: No emails found for department:', dept);
            }

            for (const email of emails) {
                console.log('[sendManualEntryAlert] Sending to:', email);
                await sendAlertEmail(email, `⚠️ Cảnh báo liều kháng sinh - ${patient.full_name} - Khoa ${dept}`, null, emailHTML);
            }
            console.log('[sendManualEntryAlert] COMPLETED');
        } catch (error) {
            console.error("[sendManualEntryAlert] FAILED:", error);
        }
    }
}

module.exports = new AlertService();
