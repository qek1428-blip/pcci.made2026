import React, { useState, useMemo } from 'react';
import { PunchRecord, Employee, BonusRecord } from '../types';
import { Download, Printer, Search, FileText, Edit3 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface CloudSheetViewProps {
  records: PunchRecord[];
  bonuses?: BonusRecord[];
  employees: Employee[];
  isAdmin: boolean;
  onEditRecord: (record: PunchRecord) => void;
}

export const CloudSheetView: React.FC<CloudSheetViewProps> = ({
  records,
  bonuses = [],
  employees,
  isAdmin,
  onEditRecord,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 取得所有可用月份選單
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    records.forEach((r) => {
      if (r.date) months.add(r.date.substring(0, 7));
    });
    bonuses.forEach((b) => {
      if (b.date) months.add(b.date.substring(0, 7));
    });
    const now = new Date();
    months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    return Array.from(months).sort().reverse();
  }, [records, bonuses]);

  // 2. 篩選與排序邏輯 (最新日期在最上方)
  const filteredRecords = useMemo(() => {
    let result = records.filter((r) => r.date.startsWith(selectedMonth));

    if (selectedEmployeeId !== 'ALL') {
      result = result.filter((r) => r.employeeId === selectedEmployeeId);
    }
    if (selectedStatus === 'COMPLETED') {
      result = result.filter((r) => r.clockInTime && r.clockOutTime);
    } else if (selectedStatus === 'MISSING_OUT') {
      result = result.filter((r) => r.clockInTime && !r.clockOutTime);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(term) ||
          (r.siteName || '').toLowerCase().includes(term) ||
          (r.notes || '').toLowerCase().includes(term) ||
          (r.adminNote || '').toLowerCase().includes(term)
      );
    }

    // 最新日期與時間優先 (遞減排序)
    return result.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.clockInTime || '').localeCompare(a.clockInTime || '');
    });
  }, [records, selectedMonth, selectedEmployeeId, selectedStatus, searchTerm]);

  // 3. 統計當月數據 (工時、本薪、加給、總發放)
  const stats = useMemo(() => {
    const totalHours = filteredRecords.reduce((sum, r) => sum + (r.durationHours || 0), 0);
    const totalWorkDays = filteredRecords.reduce((sum, r) => sum + (r.wageMultiplier || 0), 0);
    const totalWorkWage = filteredRecords.reduce((sum, r) => sum + (r.calculatedWage || 0), 0);

    let relatedBonuses = bonuses.filter((b) => b.date.startsWith(selectedMonth));
    if (selectedEmployeeId !== 'ALL') {
      relatedBonuses = relatedBonuses.filter((b) => b.employeeId === selectedEmployeeId);
    }
    const totalBonus = relatedBonuses.reduce((sum, b) => sum + (b.amount || 0), 0);

    return {
      count: filteredRecords.length,
      hours: Math.round(totalHours * 10) / 10,
      workDays: totalWorkDays,
      workWage: totalWorkWage,
      bonusTotal: totalBonus,
      finalTotal: totalWorkWage + totalBonus,
    };
  }, [filteredRecords, bonuses, selectedMonth, selectedEmployeeId]);

  // 匯出 Excel
  const exportToExcel = () => {
    if (!isAdmin) {
      alert('僅管理員可下載報表！');
      return;
    }
    const exportData = filteredRecords.map((r) => ({
      日期: r.date,
      員工姓名: r.employeeName,
      上班時間: r.clockInTime,
      下班時間: r.clockOutTime || '未打卡(缺卡)',
      折算工數: r.wageMultiplier ? `${r.wageMultiplier}工` : '0工',
      當日工資: r.calculatedWage,
      施工案場: r.siteName || '',
      狀態: r.clockInTime && r.clockOutTime ? '已下班' : '缺卡/出勤中',
      備註說明: r.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '打卡紀錄');
    XLSX.writeFile(wb, `薄薄工程行_出勤紀錄_${selectedMonth}.xlsx`);
  };

  // 匯出 PDF
  const exportToPDF = () => {
    if (!isAdmin) {
      alert('僅管理員可列印報表！');
      return;
    }
    const doc = new jsPDF('l', 'pt', 'a4'); // 橫向 A4

    doc.addFileToVFS('NotoSansTC-Regular.ttf', 'AAEAAAAQAQAABAAARkZUT... (此處為字體base64，實際專案需另外加載)');
    
    // NOTE: 此處為簡易示範，實際匯出中文字體需掛載 vfs 檔案。
    doc.text(`薄薄工程行出勤紀錄表 - ${selectedMonth}`, 40, 40);

    const tableColumn = ["日期", "姓名", "上班", "下班", "工數", "當日工資", "案場", "備註"];
    const tableRows = filteredRecords.map((r) => [
      r.date,
      r.employeeName,
      r.clockInTime,
      r.clockOutTime || '缺卡',
      r.wageMultiplier,
      r.calculatedWage,
      r.siteName || '',
      r.notes || '',
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 60,
      styles: { font: 'helvetica', fontSize: 10 },
    });

    doc.save(`薄薄工程行_出勤紀錄_${selectedMonth}.pdf`);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 標題與匯出按鈕區 */}
      <div className="bg-white rounded-3xl p-5 border border-[#E6E1D8] flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#6E5D4F]" />
          <h2 className="text-lg font-bold text-[#2B2521]">出勤雲端表單 (含薪資加給)</h2>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={exportToExcel}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-[#6E5D4F] hover:bg-[#5C4D40] text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>下載 Excel</span>
          </button>
          <button
            onClick={exportToPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2B2521] hover:bg-[#1E1916] text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>列印 PDF</span>
          </button>
        </div>
      </div>

      {/* 4 格統計資訊卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-[#E6E1D8] shadow-sm">
          <div className="text-xs text-[#706458] mb-1 font-semibold">出勤筆數</div>
          <div className="text-xl font-black text-[#2B2521] font-mono">
            {stats.count} <span className="text-xs font-medium text-[#998D80] ml-1">筆</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-[#E6E1D8] shadow-sm">
          <div className="text-xs text-[#706458] mb-1 font-semibold">本月總工時</div>
          <div className="text-xl font-black text-[#2B2521] font-mono">
            {stats.hours.toFixed(1)} <span className="text-xs font-medium text-[#998D80] ml-1">小時</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-[#E6E1D8] shadow-sm">
          <div className="text-xs text-[#706458] mb-1 font-semibold">折算總工數</div>
          <div className="text-xl font-black text-[#2B2521] font-mono">
            {stats.workDays} <span className="text-xs font-medium text-[#998D80] ml-1">工</span>
          </div>
        </div>
        <div className="bg-[#FAF8F5] p-4 rounded-3xl border border-[#D4C9BC] shadow-sm">
          <div className="text-xs text-[#54473C] mb-1 font-semibold">應發薪資總額 (含加給)</div>
          <div className="text-xl font-black text-[#6E5D4F] font-mono">
            NT$ {stats.finalTotal.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 篩選控制器 */}
      <div className="bg-white p-4 rounded-3xl border border-[#E6E1D8] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shadow-sm">
        <div>
          <label className="block text-[11px] font-semibold text-[#706458] mb-1">統計月份</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521] font-bold"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>{m.replace('-', '年 ')}月</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#706458] mb-1">人員篩選</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
          >
            <option value="ALL">全部員工 (全員)</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#706458] mb-1">出勤狀態</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
          >
            <option value="ALL">全部狀態</option>
            <option value="COMPLETED">已順利下班</option>
            <option value="MISSING_OUT">缺下班卡 / 出勤中</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#706458] mb-1">搜尋案場或備註</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#998D80] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="輸入案場/姓名/備註..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs border border-[#E6E1D8] rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
            />
          </div>
        </div>
      </div>

      {/* 資料表格 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#FAF8F5] text-[#706458] border-b border-[#E6E1D8]">
              <tr>
                <th className="px-4 py-3 font-semibold text-center">序</th>
                <th className="px-4 py-3 font-semibold">日期</th>
                <th className="px-4 py-3 font-semibold">員工姓名</th>
                <th className="px-4 py-3 font-semibold">工種</th>
                <th className="px-4 py-3 font-semibold text-center">上班時間</th>
                <th className="px-4 py-3 font-semibold text-center">下班時間</th>
                <th className="px-4 py-3 font-semibold text-center">累計工時</th>
                <th className="px-4 py-3 font-semibold text-center">折算工數</th>
                <th className="px-4 py-3 font-semibold text-right">當日工資</th>
                <th className="px-4 py-3 font-semibold">施工案場</th>
                <th className="px-4 py-3 font-semibold text-center">狀態</th>
                <th className="px-4 py-3 font-semibold">備註說明</th>
                <th className="px-4 py-3 font-semibold text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E1D8]/60 text-[#2B2521]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-[#998D80]">
                    該條件下無任何打卡紀錄
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, index) => {
                  const emp = employees.find((e) => e.id === record.employeeId);
                  const isMissingOut = record.clockInTime && !record.clockOutTime;
                  
                  return (
                    <tr key={record.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="px-4 py-3 text-center text-[#998D80]">{index + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-[#54473C]">{record.date}</td>
                      <td className="px-4 py-3 font-bold">{record.employeeName}</td>
                      <td className="px-4 py-3 text-[#706458]">{emp?.workType || '一般'}</td>
                      <td className="px-4 py-3 font-mono text-center">{record.clockInTime}</td>
                      <td className="px-4 py-3 font-mono text-center">
                        {record.clockOutTime ? (
                          record.clockOutTime
                        ) : (
                          <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">缺卡</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{record.durationHours ? `${record.durationHours}h` : '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#6E5D4F]">{record.wageMultiplier || 0} 工</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#6E5D4F]">
                        NT$ {(record.calculatedWage || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{record.siteName || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {isMissingOut ? (
                          <span className="px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-600 text-[10px] font-bold">缺卡異常</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded border border-[#D4C9BC] bg-[#EAE3DA] text-[#4A3D32] text-[10px] font-bold">已下班</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#706458] max-w-[150px] truncate" title={record.notes}>
                        {record.notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isAdmin ? (
                          <button
                            onClick={() => onEditRecord(record)}
                            className="p-1.5 text-[#998D80] hover:text-[#2B2521] hover:bg-[#EAE3DA] rounded-lg transition-colors inline-flex"
                            title="修正此紀錄"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[#D6CEC3]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
