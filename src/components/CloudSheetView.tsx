import React, { useState, useMemo } from 'react';
import { PunchRecord, Employee, BonusRecord } from '../types';
import { Search, FileText, Edit3 } from 'lucide-react';

interface CloudSheetViewProps {
  records: PunchRecord[];
  bonuses?: BonusRecord[];
  employees: Employee[];
  isAdmin: boolean;
  onEditRecord: (record: PunchRecord) => void;
}

// 核心判定邏輯：是否超過當日 19:00 未打下班卡
const checkIsMissingOut = (dateStr: string, outTime?: string) => {
  if (outTime) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  // 建立當日 19:00:00 的時間基準
  const limitTime = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 19, 0, 0);
  return new Date() > limitTime;
};

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

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    records.forEach((r) => { if (r.date) months.add(r.date.substring(0, 7)); });
    bonuses.forEach((b) => { if (b.date) months.add(b.date.substring(0, 7)); });
    const now = new Date();
    months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    return Array.from(months).sort().reverse();
  }, [records, bonuses]);

  const filteredRecords = useMemo(() => {
    let result = records.filter((r) => r.date.startsWith(selectedMonth));

    if (selectedEmployeeId !== 'ALL') {
      result = result.filter((r) => r.employeeId === selectedEmployeeId);
    }
    
    // 套用 19:00 缺卡判定狀態過濾
    if (selectedStatus === 'COMPLETED') {
      result = result.filter((r) => r.clockOutTime);
    } else if (selectedStatus === 'MISSING_OUT') {
      result = result.filter((r) => checkIsMissingOut(r.date, r.clockOutTime));
    } else if (selectedStatus === 'WORKING') {
      result = result.filter((r) => !r.clockOutTime && !checkIsMissingOut(r.date, r.clockOutTime));
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

    return result.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.clockInTime || '').localeCompare(a.clockInTime || '');
    });
  }, [records, selectedMonth, selectedEmployeeId, selectedStatus, searchTerm]);

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

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="bg-white rounded-3xl p-5 border border-[#E6E1D8] flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#6E5D4F]" />
          <h2 className="text-lg font-bold text-[#2B2521]">出勤雲端表單 (含薪資加給)</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-[#E6E1D8] shadow-sm">
          <div className="text-xs text-[#706458] mb-1 font-semibold">出勤筆數</div>
          <div className="text-xl font-black text-[#2B2521] font-mono">{stats.count} <span className="text-xs font-medium text-[#998D80] ml-1">筆</span></div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-[#E6E1D8] shadow-sm">
          <div className="text-xs text-[#706458] mb-1 font-semibold">本月總工時</div>
          <div className="text-xl font-black text-[#2B2521] font-mono">{stats.hours.toFixed(1)} <span className="text-xs font-medium text-[#998D80] ml-1">小時</span></div>
        </div>
        <div className="bg-white p-4 rounded-3xl border border-[#E6E1D8] shadow-sm">
          <div className="text-xs text-[#706458] mb-1 font-semibold">折算總工數</div>
          <div className="text-xl font-black text-[#2B2521] font-mono">{stats.workDays} <span className="text-xs font-medium text-[#998D80] ml-1">工</span></div>
        </div>
        <div className="bg-[#FAF8F5] p-4 rounded-3xl border border-[#D4C9BC] shadow-sm">
          <div className="text-xs text-[#54473C] mb-1 font-semibold">應發薪資總額 (含加給)</div>
          <div className="text-xl font-black text-[#6E5D4F] font-mono">NT$ {stats.finalTotal.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-[#E6E1D8] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shadow-sm">
        <div>
          <label className="block text-[11px] font-semibold text-[#706458] mb-1">統計月份</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521] font-bold">
            {availableMonths.map((m) => (<option key={m} value={m}>{m.replace('-', '年 ')}月</option>))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#706458] mb-1">人員篩選</label>
          <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]">
            <option value="ALL">全部員工 (全員)</option>
            {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#706458] mb-1">出勤狀態</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]">
            <option value="ALL">全部狀態</option>
            <option value="COMPLETED">已順利下班</option>
            <option value="WORKING">出勤中 (19:00 前)</option>
            <option value="MISSING_OUT">缺卡異常 (逾 19:00 未下班)</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#706458] mb-1">搜尋案場或備註</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#998D80] absolute left-3 top-2.5" />
            <input type="text" placeholder="輸入案場/姓名/備註..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full text-xs border border-[#E6E1D8] rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]" />
          </div>
        </div>
      </div>

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
                  const isMissingOut = checkIsMissingOut(record.date, record.clockOutTime);
                  
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
                        ) : isMissingOut ? (
                          <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">缺卡</span>
                        ) : (
                          <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">--:--:--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{record.durationHours ? `${record.durationHours}h` : '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#6E5D4F]">{record.wageMultiplier || 0} 工</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#6E5D4F]">
                        NT$ {(record.calculatedWage || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{record.siteName || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {record.clockOutTime ? (
                          <span className="px-2 py-0.5 rounded border border-[#D4C9BC] bg-[#EAE3DA] text-[#4A3D32] text-[10px] font-bold">已下班</span>
                        ) : isMissingOut ? (
                          <span className="px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-600 text-[10px] font-bold">缺卡異常</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-600 text-[10px] font-bold">出勤中</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#706458] max-w-[150px] truncate" title={record.notes}>
                        {record.notes || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isAdmin ? (
                          <button onClick={() => onEditRecord(record)} className="p-1.5 text-[#998D80] hover:text-[#2B2521] hover:bg-[#EAE3DA] rounded-lg transition-colors inline-flex" title="修正此紀錄">
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
