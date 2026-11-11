import { PunchRecord, Employee } from '../types';

export function exportRecordsToCSV(
  records: PunchRecord[],
  employees: Employee[],
  monthStr: string // '2026-11'
) {
  const empMap = new Map(employees.map((e) => [e.id, e]));

  // UTF-8 BOM so Excel opens Traditional Chinese characters correctly
  const BOM = '\uFEFF';

  const headers = [
    '打卡紀錄ID',
    '員工姓名',
    '工種',
    '日薪標準(NT$)',
    '打卡日期',
    '星期',
    '上班打卡時間',
    '下班打卡時間',
    '累計工時(小時)',
    '工數折算(工)',
    '當日應發工資(NT$)',
    '施工地點/工程案場',
    '打卡狀態',
    '工程備註',
    '管理員修正註記',
    '建立時間',
  ];

  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

  const rows = records.map((rec) => {
    const emp = empMap.get(rec.employeeId);
    const dateObj = new Date(rec.date);
    const weekday = weekdayNames[dateObj.getDay()] || '';
    const status = rec.clockOutTime ? '已下班' : '工作中(尚未下班)';

    return [
      `"${rec.id}"`,
      `"${rec.employeeName}"`,
      `"${emp?.workType || '-'}"`,
      emp?.dailyRate ?? 3000,
      `"${rec.date}"`,
      `"週${weekday}"`,
      `"${rec.clockInTime || '-'}"`,
      `"${rec.clockOutTime || '-'}"`,
      rec.durationHours ?? '-',
      rec.wageMultiplier ?? 1.0,
      rec.calculatedWage ?? (emp?.dailyRate || 0),
      `"${rec.siteName || ''}"`,
      `"${status}"`,
      `"${(rec.notes || '').replace(/"/g, '""')}"`,
      `"${rec.modifiedByAdmin ? '管理員已審核修正' : '員工正常打卡'}"`,
      `"${rec.createdAt || ''}"`,
    ].join(',');
  });

  const csvContent = BOM + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `薄薄工程行_出勤打卡紀錄表_${monthStr}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printAttendanceSheet(
  records: PunchRecord[],
  employees: Employee[],
  monthStr: string
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const totalDays = records.length;
  const totalHours = records.reduce((sum, r) => sum + (r.durationHours || 0), 0);
  const totalWages = records.reduce((sum, r) => sum + (r.calculatedWage || 0), 0);

  const rowsHtml = records
    .map(
      (r, i) => `
    <tr>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${i + 1}</td>
      <td style="padding: 6px; border: 1px solid #ccc; font-weight: bold;">${r.employeeName}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${r.date}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${r.clockInTime}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: center;">${r.clockOutTime || '工作中'}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: right;">${r.durationHours !== undefined ? r.durationHours + 'h' : '-'}</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: right;">${r.wageMultiplier || 1.0} 工</td>
      <td style="padding: 6px; border: 1px solid #ccc; text-align: right; font-weight: bold;">NT$ ${(r.calculatedWage || 0).toLocaleString()}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${r.siteName}</td>
      <td style="padding: 6px; border: 1px solid #ccc;">${r.notes || '-'}</td>
    </tr>
  `
    )
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>薄薄工程行 - ${monthStr} 員工出勤打卡月報表</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif; padding: 20px; color: #1e293b; }
          h1 { margin-bottom: 4px; font-size: 22px; }
          .sub { color: #64748b; font-size: 14px; margin-bottom: 16px; }
          .summary { display: flex; gap: 20px; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
          .summary-item { font-size: 14px; }
          .summary-item strong { font-size: 16px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #f1f5f9; padding: 8px 6px; border: 1px solid #cbd5e1; text-align: left; }
          .sign-area { margin-top: 40px; display: flex; justify-content: space-between; font-size: 14px; padding: 0 40px; }
          .sign-box { border-top: 1px solid #000; width: 180px; text-align: center; padding-top: 8px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 15px;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #ea580c; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">列印 / 另存為 PDF</button>
        </div>
        <h1>薄薄工程行 · 員工每月出勤與日薪結算表</h1>
        <div class="sub">報表月份：${monthStr} ｜ 匯出時間：${new Date().toLocaleString('zh-TW')} ｜ 管理人：薄老闆</div>

        <div class="summary">
          <div class="summary-item">出勤總筆數：<strong>${totalDays}</strong> 筆</div>
          <div class="summary-item">累計總工時：<strong>${totalHours.toFixed(1)}</strong> 小時</div>
          <div class="summary-item">預計薪資總額：<strong>NT$ ${totalWages.toLocaleString()}</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">序</th>
              <th>員工姓名</th>
              <th style="text-align: center;">打卡日期</th>
              <th style="text-align: center;">上班時間</th>
              <th style="text-align: center;">下班時間</th>
              <th style="text-align: right;">工時</th>
              <th style="text-align: right;">工數</th>
              <th style="text-align: right;">預估日薪</th>
              <th>施工案場</th>
              <th>備註說明</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="sign-area">
          <div class="sign-box">工頭 / 帶班師傅簽名</div>
          <div class="sign-box">會計 / 出納覆核</div>
          <div class="sign-box">負責人 (薄老闆) 簽核</div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
}
