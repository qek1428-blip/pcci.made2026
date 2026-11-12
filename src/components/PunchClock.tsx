import React, { useState, useEffect } from 'react';
import { Employee, PunchRecord, BonusRecord } from '../types';
import { Clock, MapPin, Users, Coins, Calendar, Edit3 } from 'lucide-react';
import { playPunchSound } from '../utils/sound';

interface PunchClockProps {
  currentEmployee: Employee;
  records: PunchRecord[];
  bonuses?: BonusRecord[];
  onPunchIn: (siteName: string, notes: string) => Promise<void>;
  onPunchOut: (notes?: string) => Promise<void>;
  isAdmin: boolean;
  onOpenSwitchUser: () => void;
  onEditRecord: (record: PunchRecord) => void;
}

const checkIsMissingOut = (dateStr: string, outTime?: string) => {
  if (outTime) return false;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return false;
  const limitTime = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 19, 0, 0);
  return new Date() > limitTime;
};

export const PunchClock: React.FC<PunchClockProps> = ({
  currentEmployee,
  records,
  bonuses = [],
  onPunchIn,
  onPunchOut,
  isAdmin,
  onOpenSwitchUser,
  onEditRecord,
}) => {
  const [siteName, setSiteName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateString = currentTime.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const year = currentTime.getFullYear();
  const month = String(currentTime.getMonth() + 1).padStart(2, '0');
  const day = String(currentTime.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  const currentMonthPrefix = `${year}-${month}`;

  const todayRecords = records.filter((r) => r.employeeId === currentEmployee.id && r.date === todayStr);
  todayRecords.sort((a, b) => a.clockInTime.localeCompare(b.clockInTime));
  
  const latestRecord = todayRecords[todayRecords.length - 1];
  const isCurrentlyWorking = Boolean(latestRecord && !latestRecord.clockOutTime);
  const isLatestMissing = latestRecord && checkIsMissingOut(latestRecord.date, latestRecord.clockOutTime);

  const totalDurationToday = todayRecords.reduce((sum, r) => sum + (r.durationHours || 0), 0);
  const totalWageToday = todayRecords.reduce((sum, r) => sum + (r.calculatedWage || 0), 0);

  const empMonthRecords = records.filter((r) => r.employeeId === currentEmployee.id && r.date.startsWith(currentMonthPrefix));
  const monthWorkWage = empMonthRecords.reduce((sum, r) => sum + (Number(r.calculatedWage) || 0), 0);
  const empMonthBonuses = bonuses.filter((b) => b.employeeId === currentEmployee.id && b.date.startsWith(currentMonthPrefix));
  const monthBonusTotal = empMonthBonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const monthTotalSalary = monthWorkWage + monthBonusTotal;

  const empRecentRecords = records
    .filter((r) => r.employeeId === currentEmployee.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.clockInTime || '').localeCompare(a.clockInTime || ''))
    .slice(0, 5);

  const handlePunchInClick = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      playPunchSound('in');
      await onPunchIn(siteName, notes);
      setSiteName('');
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePunchOutClick = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      playPunchSound('out');
      await onPunchOut(notes);
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* 1. 打卡核心卡片 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-6 shadow-xs text-center space-y-5">
        <div>
          <div className="text-xs text-[#706458] font-medium">{dateString}</div>
          <div className="text-4xl sm:text-5xl font-mono font-black text-[#2B2521] tracking-wider my-2">{timeString}</div>
          <div className="inline-flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <span className="text-xs text-[#706458]">出勤人員：</span>
            <span className="font-bold text-[#2B2521] text-sm">{currentEmployee.name}</span>
            <button type="button" onClick={onOpenSwitchUser} className="px-2.5 py-1 text-[11px] font-bold text-[#4A3D32] bg-[#EAE3DA] hover:bg-[#DFD6C9] border border-[#D4C9BC] rounded-xl transition-all active:scale-95 flex items-center gap-1 shadow-2xs"><Users className="w-3 h-3 text-[#6E5D4F]" /><span>換人打卡</span></button>
          </div>
        </div>

        {!isCurrentlyWorking ? (
          <div className="space-y-3">
            <div className="space-y-2 text-left">
              <div>
                <label className="block text-xs font-semibold text-[#54473C] mb-1">今日施工案場名稱</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#998D80] absolute left-3 top-3" />
                  <input type="text" placeholder="請填寫施工案場（例如：民權路門市、大安案場）" value={siteName} onChange={(e) => setSiteName(e.target.value)} className="w-full text-xs sm:text-sm border border-[#E6E1D8] rounded-xl pl-9 pr-4 py-2.5 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#54473C] mb-1">打卡工作備註 <span className="text-[#998D80] font-normal">(選填)</span></label>
                <input type="text" placeholder="備註說明（無可留空）" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-xs sm:text-sm border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]" />
              </div>
            </div>
            <button onClick={handlePunchInClick} disabled={isSubmitting} className="w-full py-4 rounded-2xl bg-[#2B2521] hover:bg-[#1E1916] text-white font-black text-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50">
              {isSubmitting ? '打卡同步中...' : '上班打卡'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E6E1D8] text-xs text-left space-y-1">
              <div className="flex items-center justify-between"><span className="text-[#706458]">上班打卡時間：</span><span className="font-mono font-bold text-[#2B2521]">{latestRecord?.clockInTime}</span></div>
              <div className="flex items-center justify-between"><span className="text-[#706458]">施工案場：</span><span className="font-bold text-[#2B2521]">{latestRecord?.siteName || '未指定案場'}</span></div>
            </div>
            <div className="text-left">
              <label className="block text-xs font-semibold text-[#54473C] mb-1">下班工作備註 / 施工進度回報 <span className="text-[#998D80] font-normal">(選填)</span></label>
              <input type="text" placeholder="例如：櫃體組裝完畢、明日待收尾" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full text-xs sm:text-sm border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]" />
            </div>
            <button onClick={handlePunchOutClick} disabled={isSubmitting} className="w-full py-4 rounded-2xl bg-[#6E5D4F] hover:bg-[#5C4D40] text-white font-black text-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50">
              {isSubmitting ? '打卡同步中...' : '下班打卡'}
            </button>
          </div>
        )}
      </div>

      {/* 2. 本日出勤打卡狀態 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#6E5D4F]" /><h3 className="font-bold text-sm text-[#2B2521]">本日出勤打卡狀態</h3></div>
          <div>
            {!latestRecord ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">今日未出勤</span>
            ) : latestRecord.clockOutTime ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">可再次打卡</span>
            ) : isLatestMissing ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold animate-pulse">逾 19:00 缺卡異常</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold animate-pulse">施工出勤中</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <div className="text-[10px] text-[#706458] font-medium">最近一次上班</div>
            <div className="text-sm font-mono font-bold text-[#2B2521] mt-0.5">{latestRecord?.clockInTime || '--:--:--'}</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <div className="text-[10px] text-[#706458] font-medium">最近一次下班</div>
            <div className="text-sm font-mono font-bold text-[#2B2521] mt-0.5">
              {latestRecord?.clockOutTime ? (
                latestRecord.clockOutTime
              ) : isLatestMissing ? (
                <span className="text-rose-600">異常未打卡</span>
              ) : isCurrentlyWorking ? (
                '出勤中'
              ) : (
                '--:--:--'
              )}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <div className="text-[10px] text-[#706458] font-medium">本日總計工時</div>
            <div className="text-sm font-mono font-bold text-[#2B2521] mt-0.5">{totalDurationToday > 0 ? `${totalDurationToday} 小時` : '0 小時'}</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <div className="text-[10px] text-[#706458] font-medium">預估日薪工資</div>
            <div className="text-sm font-mono font-bold text-[#6E5D4F] mt-0.5">NT$ {totalWageToday.toLocaleString()}</div>
          </div>
        </div>

        {isCurrentlyWorking && (
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8] text-xs space-y-1.5">
            <div className="flex items-start gap-1.5"><span className="text-[#706458] shrink-0">施工案場：</span><span className="font-bold text-[#2B2521]">{latestRecord?.siteName || '未指定案場名稱'}</span></div>
            {latestRecord?.notes && (<div className="flex items-start gap-1.5"><span className="text-[#706458] shrink-0">工作備註：</span><span className="text-[#54473C]">{latestRecord.notes}</span></div>)}
            {isAdmin && latestRecord && (
              <div className="pt-1 text-right"><button type="button" onClick={() => onEditRecord(latestRecord)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E5D4F] hover:underline"><Edit3 className="w-3 h-3" /><span>管理員修正紀錄</span></button></div>
            )}
          </div>
        )}
      </div>

      {/* 3. 當月預估實領薪資卡片 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-[#706458]">當月預估實領薪資 ({currentTime.getMonth() + 1} 月)</div>
          {monthBonusTotal > 0 && (<div className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EAE3DA] text-[#4A3D32] border border-[#D4C9BC]"><Coins className="w-3 h-3 text-[#6E5D4F]" /><span>含加給 +NT${monthBonusTotal.toLocaleString()}</span></div>)}
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-2xl sm:text-3xl font-mono font-black text-[#2B2521]">NT$ {monthTotalSalary.toLocaleString()}</div>
          <div className="text-xs text-[#8A7D70]">出勤本薪: NT${monthWorkWage.toLocaleString()}</div>
        </div>
      </div>

      {/* 4. 近期出勤紀錄 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#6E5D4F]" /><h4 className="font-bold text-sm text-[#2B2521]">近期出勤紀錄</h4></div><span className="text-[11px] text-[#8A7D70]">最近 5 筆</span></div>
        {empRecentRecords.length === 0 ? (
          <div className="text-center py-5 text-xs text-[#998D80] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E6E1D8]">尚無近期出勤紀錄</div>
        ) : (
          <div className="divide-y divide-[#E6E1D8]">
            {empRecentRecords.map((r) => {
              const missing = checkIsMissingOut(r.date, r.clockOutTime);
              return (
                <div key={r.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2"><span className="font-mono font-bold text-[#2B2521]">{r.date}</span><span className="px-1.5 py-0.2 rounded bg-[#FAF8F5] border border-[#E6E1D8] text-[10px] text-[#706458]">{r.siteName || '一般出勤'}</span></div>
                    <div className="text-[11px] text-[#706458] mt-0.5">
                      {r.clockInTime} ~ {r.clockOutTime ? r.clockOutTime : (missing ? <span className="text-rose-600 font-bold">⚠️ 缺卡異常</span> : '🔨 出勤中')}
                      {r.durationHours ? ` · ${r.durationHours}h` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-[#6E5D4F]">NT$ {(r.calculatedWage || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-[#998D80]">{r.wageMultiplier ? `${r.wageMultiplier}工` : '1.0工'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
