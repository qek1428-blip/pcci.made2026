import React, { useState, useMemo } from 'react';
import { PunchRecord, Employee, BonusRecord } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Edit3, Plus, Coins, AlertCircle } from 'lucide-react';

interface CalendarViewProps {
  records: PunchRecord[];
  bonuses?: BonusRecord[];
  employees: Employee[];
  currentEmployee: Employee;
  isAdmin: boolean;
  onEditRecord: (record: PunchRecord) => void;
  onAddManualPunch: (dateStr: string, empId: string) => void;
}

// 缺卡異常判定：當日 19:00 前未下班
const checkIsMissingOut = (dateStr: string, outTime?: string) => {
  if (outTime) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const limitTime = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 19, 0, 0);
  return new Date() > limitTime;
};

export const CalendarView: React.FC<CalendarViewProps> = ({
  records,
  bonuses = [],
  employees,
  currentEmployee,
  isAdmin,
  onEditRecord,
  onAddManualPunch,
}) => {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedEmpId, setSelectedEmpId] = useState<string>(isAdmin ? 'ALL' : currentEmployee.id);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDateStr(null);
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDateStr(null);
  };

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  // 整理每日出勤與加給資料
  const dailyData = useMemo(() => {
    const data: Record<string, { records: PunchRecord[], bonuses: BonusRecord[] }> = {};
    const targetRecords = selectedEmpId === 'ALL' ? records : records.filter(r => r.employeeId === selectedEmpId);
    const targetBonuses = selectedEmpId === 'ALL' ? bonuses : bonuses.filter(b => b.employeeId === selectedEmpId);

    targetRecords.forEach(r => {
      if (!data[r.date]) data[r.date] = { records: [], bonuses: [] };
      data[r.date].records.push(r);
    });
    targetBonuses.forEach(b => {
      if (!data[b.date]) data[b.date] = { records: [], bonuses: [] };
      data[b.date].bonuses.push(b);
    });
    return data;
  }, [records, bonuses, selectedEmpId]);

  const handleDayClick = (day: number | null) => {
    if (!day) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDateStr(dateStr);
  };

  const selectedDayInfo = selectedDateStr ? dailyData[selectedDateStr] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* 頂部控制列 */}
      <div className="bg-white rounded-3xl p-5 border border-[#E6E1D8] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#6E5D4F]" />
          <h2 className="text-lg font-bold text-[#2B2521]">打卡日曆檢視</h2>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isAdmin && (
            <select
              value={selectedEmpId}
              onChange={(e) => {
                setSelectedEmpId(e.target.value);
                setSelectedDateStr(null);
              }}
              className="flex-1 sm:flex-none text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] font-bold text-[#2B2521]"
            >
              <option value="ALL">全部員工 (全員)</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          )}

          <div className="flex items-center bg-[#FAF8F5] rounded-xl border border-[#E6E1D8] p-1">
            <button onClick={prevMonth} className="p-1.5 text-[#706458] hover:text-[#2B2521] hover:bg-[#EAE3DA] rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 text-sm font-bold text-[#2B2521] min-w-[100px] text-center">
              {year}年 {month + 1}月
            </div>
            <button onClick={nextMonth} className="p-1.5 text-[#706458] hover:text-[#2B2521] hover:bg-[#EAE3DA] rounded-lg transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 日曆網格 */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#E6E1D8] shadow-sm">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <div key={day} className="text-center text-[11px] font-bold text-[#998D80] py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((day, index) => {
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
            const dayData = dateStr ? dailyData[dateStr] : null;
            const isSelected = selectedDateStr === dateStr;
            const isToday = day && dateStr === new Date().toISOString().split('T')[0];

            let hasMissing = false;
            if (dayData && dayData.records) {
              hasMissing = dayData.records.some(r => checkIsMissingOut(r.date, r.clockOutTime));
            }

            return (
              <div
                key={index}
                onClick={() => handleDayClick(day)}
                className={`min-h-[70px] sm:min-h-[90px] p-1 sm:p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer relative flex flex-col ${
                  !day ? 'bg-transparent border-transparent cursor-default' :
                  isSelected ? 'bg-[#2B2521] border-[#2B2521] text-white shadow-md scale-105 z-10' :
                  isToday ? 'bg-[#FAF8F5] border-[#6E5D4F] text-[#2B2521]' :
                  'bg-white border-[#E6E1D8] text-[#2B2521] hover:border-[#D4C9BC] hover:bg-[#FAF8F5]'
                }`}
              >
                {day && (
                  <>
                    <div className="text-xs sm:text-sm font-bold mb-1">{day}</div>
                    
                    <div className="flex flex-col gap-0.5 mt-auto">
                      {/* 出勤標記 */}
                      {dayData && dayData.records.length > 0 && (
                        <div className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded leading-tight truncate ${
                          isSelected ? 'bg-[#423932] text-[#D4C9BC]' :
                          hasMissing ? 'bg-rose-50 text-rose-600 border border-rose-200' :
                          'bg-[#EAE3DA] text-[#4A3D32]'
                        }`}>
                          {selectedEmpId === 'ALL' ? `${dayData.records.length}人出勤` : `工時: ${dayData.records.reduce((s, r) => s + (r.durationHours || 0), 0)}h`}
                        </div>
                      )}
                      {/* 加給標記 */}
                      {dayData && dayData.bonuses.length > 0 && (
                        <div className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded leading-tight truncate ${
                          isSelected ? 'bg-amber-900/50 text-amber-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          + 加給
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 當日詳細資訊面板 */}
      {selectedDateStr && (
        <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between border-b border-[#E6E1D8] pb-3">
            <h3 className="font-bold text-[#2B2521] text-base flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#6E5D4F]" />
              <span>{selectedDateStr} 明細紀錄</span>
            </h3>
            {isAdmin && (
              <button
                onClick={() => onAddManualPunch(selectedDateStr, selectedEmpId !== 'ALL' ? selectedEmpId : currentEmployee.id)}
                className="px-3 py-1.5 bg-[#EAE3DA] hover:bg-[#DFD6C9] text-[#4A3D32] text-xs font-bold rounded-xl flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增手動補登</span>
              </button>
            )}
          </div>

          {!selectedDayInfo || (selectedDayInfo.records.length === 0 && selectedDayInfo.bonuses.length === 0) ? (
            <div className="text-center py-6 text-xs text-[#998D80] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E6E1D8]">
              此日期尚無任何出勤與加給紀錄
            </div>
          ) : (
            <div className="space-y-4">
              {/* 打卡紀錄列表 */}
              {selectedDayInfo.records.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-[#706458] mb-2 uppercase tracking-wider">出勤紀錄</div>
                  {selectedDayInfo.records.map((record) => {
                    const missing = checkIsMissingOut(record.date, record.clockOutTime);
                    const emp = employees.find(e => e.id === record.employeeId);
                    
                    return (
                      <div key={record.id} className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-hover hover:border-[#D4C9BC]">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[#2B2521] text-sm">{record.employeeName}</span>
                            <span className="text-[10px] text-[#706458]">{emp?.workType || '一般'}</span>
                            {missing && <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-rose-50 text-rose-600 border border-rose-200 rounded text-[10px] font-bold"><AlertCircle className="w-3 h-3" />缺卡異常</span>}
                          </div>
                          <div className="text-xs text-[#706458] flex items-center gap-2">
                            <span className="font-mono">{record.clockInTime} ~ {record.clockOutTime || '未下班'}</span>
                            <span className="text-[#D4C9BC]">|</span>
                            <span>{record.durationHours || 0}小時 ({record.wageMultiplier || 0}工)</span>
                          </div>
                          {record.siteName && (
                            <div className="text-xs text-[#54473C] mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#998D80]" />
                              {record.siteName}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 border-t border-[#E6E1D8] sm:border-0 pt-2 sm:pt-0">
                          <div className="text-right">
                            <div className="font-mono font-bold text-[#6E5D4F]">NT$ {(record.calculatedWage || 0).toLocaleString()}</div>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => onEditRecord(record)}
                              className="px-2.5 py-1.5 bg-white border border-[#E6E1D8] hover:bg-[#EAE3DA] text-[#54473C] text-[11px] font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-2xs"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>修改</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 薪資加給列表 */}
              {selectedDayInfo.bonuses.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-bold text-[#706458] mb-2 uppercase tracking-wider">薪資加給紀錄</div>
                  {selectedDayInfo.bonuses.map((bonus) => (
                    <div key={bonus.id} className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-[#2B2521] text-sm">{bonus.employeeName}</span>
                          <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">
                            <Coins className="w-3 h-3" /> 加給費用
                          </span>
                        </div>
                        <div className="text-xs text-[#706458]">
                          事由：{bonus.note}
                        </div>
                      </div>
                      <div className="text-right mt-2 sm:mt-0">
                        <div className="font-mono font-bold text-amber-700">+NT$ {bonus.amount.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
