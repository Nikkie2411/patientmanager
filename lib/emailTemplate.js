function createAlertEmailHTML(patient, dept, drugName, doseEntered, frequencyEntered, recommendation, weight, isCriticallyIll, complianceMessage) {
    return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cảnh báo liều kháng sinh</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px; width: 100%;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Patient Manager</h1>
                            <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Hệ thống quản lý sơ sinh</p>
                        </td>
                    </tr>
                    
                    <!-- Alert Icon -->
                    <tr>
                        <td style="padding: 30px 30px 20px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <p style="margin: 0; font-size: 18px; color: #1f2937; font-weight: 600;">
                                            <span style="font-size: 24px;">⚠️</span> Cảnh báo liều kháng sinh
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Patient Info -->
                    <tr>
                        <td style="padding: 0 30px 20px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; padding: 16px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; font-weight: 500;">THÔNG TIN BỆNH NHÂN</p>
                                        <table width="100%" cellpadding="4" cellspacing="0">
                                            <tr>
                                                <td style="font-size: 14px; color: #374151; padding: 4px 0;">
                                                    <strong>Họ tên:</strong> ${patient.full_name}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 14px; color: #374151; padding: 4px 0;">
                                                    <strong>Mã BN:</strong> ${patient.id}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 14px; color: #374151; padding: 4px 0;">
                                                    <strong>Khoa:</strong> ${dept}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 14px; color: #374151; padding: 4px 0;">
                                                    <strong>Cân nặng:</strong> ${weight} kg
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Warning Box -->
                    <tr>
                        <td style="padding: 0 30px 20px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 12px 0; font-size: 14px; color: #92400e; font-weight: 600;">
                                            ⚠️ PHÁC ĐỒ CẦN KIỂM TRA
                                        </p>
                                        <table width="100%" cellpadding="6" cellspacing="0">
                                            <tr>
                                                <td style="font-size: 14px; color: #78350f; padding: 4px 0;">
                                                    <strong>Kháng sinh:</strong> ${drugName}${isCriticallyIll ? ' <span style="background-color: #dc2626; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">NHIỄM KHUẨN NẶNG</span>' : ''}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 14px; color: #78350f; padding: 4px 0;">
                                                    <strong>Liều đã nhập:</strong> ${doseEntered}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="font-size: 14px; color: #78350f; padding: 4px 0;">
                                                    <strong>Tần suất đã nhập:</strong> ${frequencyEntered}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="border-top: 1px dashed #f59e0b; margin-top: 8px; padding-top: 12px; font-size: 14px; color: #78350f;">
                                                    <strong>✓ Khuyến cáo:</strong> ${recommendation.dose} × ${weight}kg = ${(parseFloat(recommendation.dose) * weight).toFixed(1)} mg, mỗi ${recommendation.frequency} giờ
                                                </td>
                                            </tr>
                                        </table>
                                        <div style="margin-top: 12px; padding: 12px; background-color: #fffbeb; border-radius: 6px;">
                                            <p style="margin: 0; font-size: 13px; color: #92400e;">
                                                <strong>Lý do cảnh báo:</strong> ${complianceMessage}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Action Note -->
                    <tr>
                        <td style="padding: 0 30px 30px 30px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border-radius: 8px; padding: 16px; border: 1px solid #3b82f6;">
                                <tr>
                                    <td>
                                        <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.6;">
                                            💡 <strong>Hướng dẫn:</strong> Vui lòng kiểm tra lại đơn thuốc và cân nhắc điều chỉnh liều dùng theo khuyến cáo Guidelines. Liên hệ bác sĩ phụ trách nếu cần hỗ trợ thêm.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
                                Email tự động từ <strong>Patient Manager</strong>
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                                © ${new Date().getFullYear()} Patient Manager - Hệ thống quản lý thông tin sơ sinh
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

module.exports = { createAlertEmailHTML };
