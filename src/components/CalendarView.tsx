import React, { useState } from 'react';
import { PunchRecord, Employee } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  Shield,
  Edit2,
  PlusCircle,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { playPunchSound } from '../utils/sound';

interface CalendarViewProps {
  records: PunchRecord[];
  employees: Employee[];
  currentEmployee: Employee;
  isAdmin: boolean;
  onEditRecord: (record: PunchRecord) => void;
  onAddManualPunch: (dateStr: string, employeeId?: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  records,
  employees,
  currentEmployee,
  isAdmin,
  onEditRecord,
  onAddManualPunch,
}) => {
  // Calendar Month State (Defaults to November 2026)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10); // 0-indexed: 10 is November
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    isAdmin ? 'ALL' : currentEmployee.id
  );
  const [selectedDayModal, setSelectedDayModal] = useState<string | null>(null);

  const prevMonth = () => {
    playPunchSound('tap');
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    playPunchSound('tap');
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthYearLabel = `${currentYear} 年 ${currentMonth + 1} 月`;
  const monthStrPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  // Filter records by month
  const monthlyRecords = records.filter((r) => r.date.startsWith(monthStrPrefix));

  // Further filter by selected employee if not 'ALL'
  const displayedRecords =
    selectedEmployeeId === 'ALL'
      ? monthlyRecords
      : monthlyRecords.filter((r) => r.employeeId === selectedEmployeeId);

  // Group records by date (YYYY-MM-DD)
  const recordsByDate = new Map<string, PunchRecord[]>();
  for (const rec of displayedRecords) {
    const list = recordsByDate.get(rec.date) || [];
    list.push(rec);
    recordsByDate.set(rec.date, list);
  }

  // Generate calendar days
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays: Array<{ dayNumber: number; dateStr: string } | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    calendarDays.push({
      dayNumber: d,
      dateStr: `${monthStrPrefix}-${dStr}`,
    });
  }

  // Selected date records for the popup sheet
  const selectedDateRecords = selectedDayModal
    ? records.filter((r) => r.date === selectedDayModal)
    : [];

  const handleDayClick = (dateStr: string) => {
    playPunchSound('tap');
    setSelectedDayModal(dateStr);
  };

  return (
    <div className="space-y-6">
      {/* Month & Filter Controls Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Month Selector */}
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-700"
            title="上個月"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-orange-600" />
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              {monthYearLabel}
            </span>
          </div>
          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-700"
            title="下個月"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-semibold text-slate-500 shrink-0">
            篩選檢視：
          </span>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="text-xs sm:text-sm font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="ALL">全部員工 (工程行全員)</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.workType})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly KPI Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] sm:text-xs text-slate-500 font-medium">出勤筆數</div>
          <div className="text-base sm:text-lg font-bold text-slate-900 font-mono mt-0.5 tabular-nums truncate">
            {displayedRecords.length} <span className="text-xs font-normal text-slate-500">筆</span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] sm:text-xs text-slate-500 font-medium">累計工時</div>
          <div className="text-base sm:text-lg font-bold text-orange-600 font-mono mt-0.5 tabular-nums truncate">
            {displayedRecords
              .reduce((sum, r) => sum + (r.durationHours || 0), 0)
              .toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">小時</span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] sm:text-xs text-slate-500 font-medium">總工數</div>
          <div className="text-base sm:text-lg font-bold text-blue-600 font-mono mt-0.5 tabular-nums truncate">
            {displayedRecords
              .reduce((sum, r) => sum + (r.wageMultiplier || 1.0), 0)
              .toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">工</span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] sm:text-xs text-slate-500 font-medium">預估日薪總額</div>
          <div className="text-base sm:text-lg font-bold text-emerald-700 font-mono mt-0.5 tabular-nums truncate">
            NT${' '}
            {displayedRecords
              .reduce((sum, r) => sum + (r.calculatedWage || 0), 0)
              .toLocaleString()}
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Status Legend Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                WORK
              </span>
              有出工
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              無出勤
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            點選日期查看明細
          </span>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/70 text-center py-2 text-xs font-bold text-slate-700">
          <span className="text-rose-500">週日</span>
          <span>週一</span>
          <span>週二</span>
          <span>週三</span>
          <span>週四</span>
          <span>週五</span>
          <span className="text-blue-500">週六</span>
        </div>

        {/* Days matrix */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
          {calendarDays.map((cell, idx) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[72px] sm:min-h-[88px] bg-slate-50/50 p-2"
                />
              );
            }

            const dayRecords = recordsByDate.get(cell.dateStr) || [];
            const hasRecords = dayRecords.length > 0;
            const isToday =
              cell.dateStr === new Date().toISOString().split('T')[0];
            const isWorkingAny = dayRecords.some((r) => !r.clockOutTime);

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => handleDayClick(cell.dateStr)}
                className={`min-h-[72px] sm:min-h-[88px] p-2 text-left transition-all relative flex flex-col justify-between group cursor-pointer ${
                  isToday
                    ? 'bg-orange-50/70 ring-2 ring-orange-500 ring-inset z-10'
                    : hasRecords
                    ? isWorkingAny
                      ? 'bg-amber-50/20 hover:bg-amber-50/50'
                      : 'bg-emerald-50/20 hover:bg-emerald-50/50'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Top date and subtle gray headcount */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex items-center justify-center text-xs sm:text-sm font-bold w-6 h-6 rounded-full shrink-0 ${
                      isToday
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'text-slate-800'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {hasRecords && (
                    <span className="text-[10px] font-mono text-slate-400 font-normal">
                      {dayRecords.length}人
                    </span>
                  )}
                </div>

                {/* Center: Clean minimalist green WORK badge */}
                <div className="my-auto py-1 flex items-center justify-center">
                  {hasRecords && (
                    <span
                      className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold tracking-wider uppercase transition-colors shadow-2xs ${
                        isWorkingAny
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      WORK
                    </span>
                  )}
                </div>

                {/* Bottom spacer for clean visual balance */}
                <div className="h-1" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Detail Modal / Drawer */}
      {selectedDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-slate-900 text-lg">
                  {selectedDayModal} 出勤紀錄
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Permission reminder note */}
            <div className="px-6 py-2.5 bg-amber-50/70 border-b border-amber-100 text-xs text-amber-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-600 shrink-0" />
                {isAdmin
                  ? '管理員模式：您可直接修改上下班時間或補登打卡'
                  : '員工查看模式：僅能查看上下班時間，修改請聯繫管理人 (薄老闆)'}
              </span>
              {isAdmin && (
                <button
                  onClick={() => {
                    onAddManualPunch(selectedDayModal);
                    setSelectedDayModal(null);
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  新增補打卡
                </button>
              )}
            </div>

            {/* Records List Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {selectedDateRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-500 space-y-3">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-medium">該日尚無打卡出勤紀錄</p>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        onAddManualPunch(selectedDayModal);
                        setSelectedDayModal(null);
                      }}
                      className="px-4 py-2 text-xs font-bold bg-orange-600 text-white rounded-xl hover:bg-orange-700 inline-flex items-center gap-1.5"
                    >
                      <PlusCircle className="w-4 h-4" />
                      幫員工補登此日打卡
                    </button>
                  )}
                </div>
              ) : (
                selectedDateRecords.map((rec) => {
                  const emp = employees.find((e) => e.id === rec.employeeId);
                  const isComplete = Boolean(rec.clockOutTime);

                  return (
                    <div
                      key={rec.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-base">
                              {rec.employeeName}
                            </span>
                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {emp?.workType || '師傅'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                            <MapPin className="w-3 h-3 text-orange-500 shrink-0" />
                            <span>{rec.siteName}</span>
                          </div>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              onEditRecord(rec);
                              setSelectedDayModal(null);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3 text-orange-600" />
                            修改
                          </button>
                        )}
                      </div>

                      {/* Time Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-slate-500 block">上班時間</span>
                          <span className="font-mono font-bold text-slate-800 text-sm">
                            {rec.clockInTime}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-slate-500 block">下班時間</span>
                          <span className="font-mono font-bold text-slate-800 text-sm">
                            {rec.clockOutTime || '施工中未下班'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-slate-500 block">工時 / 工數</span>
                          <span className="font-mono font-bold text-orange-600 text-sm">
                            {rec.durationHours ? `${rec.durationHours}h` : '-'} (
                            {rec.wageMultiplier ?? 1.0} 工)
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-slate-500 block">核算工資</span>
                          <span className="font-mono font-bold text-emerald-700 text-sm">
                            NT$ {(rec.calculatedWage || emp?.dailyRate || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {rec.notes && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg">
                          <strong>備註：</strong> {rec.notes}
                        </div>
                      )}

                      {rec.modifiedByAdmin && (
                        <div className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                          <Shield className="w-3 h-3 text-amber-600" />
                          已由管理員審核修訂紀錄
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedDayModal(null)}
                className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
