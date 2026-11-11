import React, { useState } from 'react';
import { PunchRecord, Employee } from '../types';
import {
  Download,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Building,
  Shield,
  FileSpreadsheet,
  Edit2,
  DollarSign,
} from 'lucide-react';
import { exportRecordsToCSV, printAttendanceSheet } from '../utils/export';
import { playPunchSound } from '../utils/sound';

interface CloudSheetViewProps {
  records: PunchRecord[];
  employees: Employee[];
  isAdmin: boolean;
  onEditRecord: (record: PunchRecord) => void;
}

export const CloudSheetView: React.FC<CloudSheetViewProps> = ({
  records,
  employees,
  isAdmin,
  onEditRecord,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-11');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'WORKING'>('ALL');

  // Filter records
  const filteredRecords = records.filter((rec) => {
    // Month filter
    if (selectedMonth && !rec.date.startsWith(selectedMonth)) return false;

    // Employee filter
    if (selectedEmployeeId !== 'ALL' && rec.employeeId !== selectedEmployeeId) return false;

    // Status filter
    if (statusFilter === 'COMPLETED' && !rec.clockOutTime) return false;
    if (statusFilter === 'WORKING' && rec.clockOutTime) return false;

    // Search keyword
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      const match =
        rec.employeeName.toLowerCase().includes(q) ||
        rec.siteName.toLowerCase().includes(q) ||
        (rec.notes && rec.notes.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  // Calculate stats
  const totalDays = filteredRecords.length;
  const totalHours = filteredRecords.reduce((sum, r) => sum + (r.durationHours || 0), 0);
  const totalUnits = filteredRecords.reduce((sum, r) => sum + (r.wageMultiplier || 1.0), 0);
  const totalWages = filteredRecords.reduce((sum, r) => sum + (r.calculatedWage || 0), 0);

  const handleDownloadCSV = () => {
    playPunchSound('tap');
    exportRecordsToCSV(filteredRecords, employees, selectedMonth);
  };

  const handlePrint = () => {
    playPunchSound('tap');
    printAttendanceSheet(filteredRecords, employees, selectedMonth);
  };

  return (
    <div className="space-y-6">
      {/* Cloud Sync Header & Action Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                出勤紀錄
              </h2>
            </div>
          </div>
        </div>

        {/* Action Buttons: Side-by-side on mobile, flex on desktop */}
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
          <button
            onClick={handleDownloadCSV}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition-all"
            title="下載符合 Excel 格式的 CSV 檔案 (含 UTF-8 BOM 避免亂碼)"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">下載 Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="w-full sm:w-auto px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all"
            title="開啟列印或另存為 PDF 月簽核表"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">列印 PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Summary Card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">出勤筆數</span>
          <div className="text-base sm:text-lg font-bold font-mono text-slate-900 mt-0.5 tabular-nums truncate">
            {totalDays} <span className="text-xs font-normal text-slate-500">筆</span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">總工時</span>
          <div className="text-base sm:text-lg font-bold font-mono text-orange-600 mt-0.5 tabular-nums truncate">
            {totalHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">小時</span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">總工數</span>
          <div className="text-base sm:text-lg font-bold font-mono text-blue-600 mt-0.5 tabular-nums truncate">
            {totalUnits.toFixed(1)} <span className="text-xs font-normal text-slate-500">工</span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">應發薪資總額</span>
          <div className="text-base sm:text-lg font-bold font-mono text-emerald-700 mt-0.5 tabular-nums truncate">
            NT$ {totalWages.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Month selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              統計月份
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="2026-11">2026 年 11 月</option>
              <option value="2026-10">2026 年 10 月</option>
              <option value="2026-09">2026 年 09 月</option>
              <option value="">全部月份紀錄</option>
            </select>
          </div>

          {/* Employee selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              人員篩選
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">全部員工 (全員)</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.workType})
                </option>
              ))}
            </select>
          </div>

          {/* Status selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              出勤狀態
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="ALL">全部狀態</option>
              <option value="COMPLETED">已打下班卡 (已結算)</option>
              <option value="WORKING">施工中 (尚未打下班卡)</option>
            </select>
          </div>

          {/* Search box */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              搜尋案場或備註
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="輸入案場/姓名/備註..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider">
                <th className="py-3 px-3 w-12 text-center">序</th>
                <th className="py-3 px-3">日期</th>
                <th className="py-3 px-3">員工姓名</th>
                <th className="py-3 px-3">工種</th>
                <th className="py-3 px-3">上班時間</th>
                <th className="py-3 px-3">下班時間</th>
                <th className="py-3 px-3 text-right">累計工時</th>
                <th className="py-3 px-3 text-right">折算工數</th>
                <th className="py-3 px-3 text-right">當日工資</th>
                <th className="py-3 px-3">施工案場</th>
                <th className="py-3 px-3">狀態</th>
                <th className="py-3 px-3">備註說明</th>
                {isAdmin && <th className="py-3 px-3 text-center">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 13 : 12}
                    className="py-12 text-center text-slate-400"
                  >
                    尚無符合條件的打卡紀錄
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, index) => {
                  const emp = employees.find((e) => e.id === rec.employeeId);
                  const isCompleted = Boolean(rec.clockOutTime);

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {rec.date}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {rec.employeeName}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap text-xs">
                        {emp?.workType || '-'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800 font-semibold whitespace-nowrap">
                        {rec.clockInTime}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-800 whitespace-nowrap">
                        {rec.clockOutTime ? (
                          <span className="font-semibold">{rec.clockOutTime}</span>
                        ) : (
                          <span className="text-amber-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            施工中
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-orange-600 whitespace-nowrap tabular-nums">
                        {rec.durationHours !== undefined ? `${rec.durationHours}h` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-blue-600 whitespace-nowrap tabular-nums font-semibold">
                        {rec.wageMultiplier ? `${rec.wageMultiplier} 工` : '1.0 工'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                        NT$ {(rec.calculatedWage || emp?.dailyRate || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-xs truncate">
                        {rec.siteName}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            已下班
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            出勤中
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-xs max-w-xs truncate">
                        {rec.notes || '-'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            onClick={() => onEditRecord(rec)}
                            className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="管理員修改此筆紀錄"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
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
