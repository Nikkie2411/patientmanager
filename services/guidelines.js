const { getGoogleSheetsClient, SPREADSHEET_ID } = require('../lib/googleSheets');

class GuidelineService {
    constructor() {
        this.cachedGuidelines = null;
        this.lastFetchTime = 0;
        this.CACHE_DURATION = 5 * 60 * 1000;
    }

    async getGuidelines() {
        const now = Date.now();
        if (this.cachedGuidelines && (now - this.lastFetchTime < this.CACHE_DURATION)) {
            return this.cachedGuidelines;
        }

        try {
            const sheets = await getGoogleSheetsClient();
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Guideline!A2:K',
            });

            const rows = response.data.values || [];
            const mapped = rows.map(row => ({
                id: row[0],
                antibiotic: row[1]?.trim(),
                critically_ill: row[2]?.toUpperCase(),
                ga_min: Number(row[3]),
                ga_max: Number(row[4]),
                pna_min: Number(row[5]),
                pna_max: Number(row[6]),
                dose_min: Number(row[7]),
                dose_max: Number(row[8]),
                frequency_min: Number(row[9]),
                frequency_max: Number(row[10])
            })).filter(r => r.antibiotic);

            this.cachedGuidelines = mapped;
            this.lastFetchTime = now;
            return mapped;
        } catch (error) {
            console.error("Error fetching guidelines:", error);
            return [];
        }
    }

    async getRecommendedDosage(drugName, patient, currentLog, severity = 'FALSE') {
        const guidelines = await this.getGuidelines();
        let pna = currentLog?.postnatal_age_days ?? 0;
        if (!pna && patient.dob) {
            const diffTime = Math.abs(new Date().getTime() - new Date(patient.dob).getTime());
            pna = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        const ga = patient.gestational_age_weeks;

        const matches = guidelines.filter(r =>
            r.antibiotic.toLowerCase() === drugName.toLowerCase() &&
            ga >= r.ga_min && ga <= r.ga_max &&
            pna >= r.pna_min && pna <= r.pna_max
        );

        let match = matches.find(r => r.critically_ill === severity);
        if (!match && severity === 'TRUE') match = matches.find(r => r.critically_ill === 'FALSE');

        if (match) {
            return {
                dose: match.dose_min === match.dose_max ? `${match.dose_min} mg/kg/dose` : `${match.dose_min}-${match.dose_max} mg/kg/dose`,
                frequency: match.frequency_min === match.frequency_max ? `${match.frequency_min}` : `${match.frequency_min}-${match.frequency_max}`
            };
        }
        return null;
    }

    checkGuidelineCompliance(antibiotic, recommendation, weight) {
        const recDoseStr = recommendation.dose;
        const currentDose = parseFloat(antibiotic.dose);
        const doseParts = recDoseStr.match(/(\d+(\.\d+)?)/g);

        // Extract frequency number from antibiotic.frequency (e.g. "12 giờ" -> 12, "24" -> 24)
        let freqStr = antibiotic.frequency?.toString() || '';
        const currentFreq = parseInt(freqStr.match(/\d+/)?.[0] || '0');

        const recFreqStr = recommendation.frequency?.toString() || '';
        const freqParts = recFreqStr.match(/\d+/g);

        if (!doseParts || !weight || !freqParts) return { isCompliant: true };

        const doseMin = parseFloat(doseParts[0]);
        const doseMax = doseParts.length > 1 ? parseFloat(doseParts[1]) : doseMin;
        const targetDoseMin = doseMin * weight;
        const targetDoseMax = doseMax * weight;
        const tolerance = 0.10; // Tightened from 0.15 to 0.10

        const isTooLow = currentDose < targetDoseMin * (1 - tolerance);
        const isTooHigh = currentDose > targetDoseMax * (1 + tolerance);

        if (isTooLow || isTooHigh) {
            const recRange = targetDoseMin === targetDoseMax ? `${targetDoseMin.toFixed(1)} mg` : `${targetDoseMin.toFixed(1)} - ${targetDoseMax.toFixed(1)} mg`;
            return { isCompliant: false, message: `Liều không hợp lệ (+/- 10%). Khuyến cáo: ${recRange} (${recommendation.dose} * ${weight}kg).` };
        }

        // 2. Frequency Validation (Strict)
        const freqMin = parseInt(freqParts[0]);
        const freqMax = freqParts.length > 1 ? parseInt(freqParts[1]) : freqMin;

        const isFreqWrong = currentFreq < Math.min(freqMin, freqMax) || currentFreq > Math.max(freqMin, freqMax);
        if (isFreqWrong && currentFreq !== 0) {
            return { isCompliant: false, message: `Tần suất không hợp lệ. Khuyến cáo: mỗi ${recFreqStr} giờ.` };
        }

        return { isCompliant: true };
    }

    async getDistinctAntibiotics() {
        const guidelines = await this.getGuidelines();
        return Array.from(new Set(guidelines.map(r => r.antibiotic))).sort();
    }
}

module.exports = new GuidelineService();
