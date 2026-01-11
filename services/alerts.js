const sheetsService = require('./sheets');
const guidelineService = require('./guidelines');
const { sendAlertEmail } = require('../lib/email');

class AlertService {
    async runDailyProcess() {
        console.log("Starting Daily Process...");
        const patients = await sheetsService.getPatients();
        const allAccounts = await sheetsService.getAccounts();
        const today = new Date().toISOString().split('T')[0];

        const summary = { processedPatients: 0, autoAddedAntibiotics: 0, alertsGenerated: 0, emailsSent: 0 };
        const alertsByDept = new Map();

        for (const patient of patients) {
            summary.processedPatients++;
            const antibiotics = await sheetsService.getAntibiotics(patient.id);
            const activeAntibiotics = antibiotics.filter(a => a.status === 'Active');

            const latestActiveByDrug = new Map();
            activeAntibiotics.forEach(abx => {
                if (abx.start_date === today) return;
                const existing = latestActiveByDrug.get(abx.drug_name);
                if (!existing || new Date(abx.start_date) > new Date(existing.start_date)) latestActiveByDrug.set(abx.drug_name, abx);
            });

            const logs = await sheetsService.getDailyLogs(patient.id);
            logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const currentLog = logs[0];
            let patientHasWarning = false;

            for (const [drugName, prevAbx] of latestActiveByDrug.entries()) {
                const existsToday = activeAntibiotics.some(a => a.drug_name === drugName && a.start_date === today);
                if (existsToday) continue;

                const recommendation = await guidelineService.getRecommendedDosage(drugName, patient, currentLog, prevAbx.isCriticallyIll ? 'TRUE' : 'FALSE');
                let hasAlert = false;
                let alertMsg = '';

                if (recommendation && currentLog?.weight) {
                    const compliance = guidelineService.checkGuidelineCompliance(prevAbx, recommendation, currentLog.weight);
                    if (!compliance.isCompliant) {
                        hasAlert = true;
                        patientHasWarning = true;
                        summary.alertsGenerated++;
                        const dept = patient.department || 'Unknown';
                        alertMsg = `⚠️ CẢNH BÁO LIỀU LƯỢNG KHÁNG SINH\n---------------------------------\nBệnh nhân: ${patient.full_name}\nMã BN: ${patient.id}\nKhoa: ${dept}\n\nTHÔNG TIN KHÁNG SINH CẦN ĐIỀU CHỈNH:\n- Tên thuốc: ${drugName}${prevAbx.isCriticallyIll ? ' (Nhiễm khuẩn nặng)' : ''}\n- Liều hiện dùng: ${prevAbx.dose}\n- Khuyến cáo: ${recommendation.dose} x ${currentLog.weight}kg\n- Ghi chú: ${compliance.message}\n---------------------------------\n`;
                        if (!alertsByDept.has(dept)) alertsByDept.set(dept, []);
                        alertsByDept.get(dept).push(alertMsg);
                    }
                }

                await sheetsService.addAntibiotic({ ...prevAbx, start_date: today, hasAlert, _rowIndex: undefined });
                summary.autoAddedAntibiotics++;
            }

            const newStatus = patientHasWarning ? 'Warning' : 'Normal';
            if (patient.alertStatus !== newStatus) {
                await sheetsService.updatePatient({ ...patient, alertStatus: newStatus });
            }
        }

        for (const [dept, alerts] of alertsByDept.entries()) {
            const deptAccounts = allAccounts.filter(a => a.department?.toLowerCase() === dept.toLowerCase());
            if (deptAccounts.length > 0 && alerts.length > 0) {
                const emails = Array.from(new Set(deptAccounts.flatMap(a => a.emails)));
                const content = `Hệ thống cảnh báo liều dùng kháng sinh - Khoa ${dept} - Ngày ${today}:\n\n` + alerts.join('\n----------------\n\n');
                for (const email of emails) {
                    await sendAlertEmail(email, `[Cảnh báo] Liều kháng sinh - Khoa ${dept}`, content);
                    summary.emailsSent++;
                }
            }
        }
        return summary;
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

            const content = `⚠️ CẢNH BÁO LIỀU LƯỢNG KHÁNG SINH (NHẬP THỦ CÔNG)\n` +
                `---------------------------------\n` +
                `Bệnh nhân: ${patient.full_name}\n` +
                `Mã BN: ${patient.id}\n` +
                `Khoa: ${dept}\n\n` +
                `THÔNG TIN KHÁNG SINH CẦN ĐIỀU CHỈNH:\n` +
                `- Tên thuốc: ${drugName}${isCriticallyIll ? ' (Nhiễm khuẩn nặng)' : ''}\n` +
                `- Liều nhập vào: ${dose}\n` +
                `- Tần suất nhập vào: ${frequency}\n` +
                `- Khuyến cáo: ${recommendation.dose} x ${currentLog?.weight}kg mỗi ${recommendation.frequency} giờ\n` +
                `- Ghi chú: ${compliance.message}\n` +
                `---------------------------------\n`;

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
                await sendAlertEmail(email, `[Khẩn cấp] Cảnh báo liều kháng sinh - Khoa ${dept}`, content);
            }
            console.log('[sendManualEntryAlert] COMPLETED');
        } catch (error) {
            console.error("[sendManualEntryAlert] FAILED:", error);
        }
    }
}

module.exports = new AlertService();
