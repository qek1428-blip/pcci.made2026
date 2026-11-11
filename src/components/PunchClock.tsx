import React, { useState, useEffect } from 'react';
import { Employee, PunchRecord, BonusRecord } from '../types';
import { Clock, MapPin, CheckCircle2, Users, Coins, Calendar, FileText, Edit3, ChevronRight } from 'lucide-react';
import { playPunchSound } from '../utils/sound';

interface PunchClockProps {
  currentEmployee: Employee;
  todayRecord?: PunchRecord;
  records: PunchRecord[];
  bonuses?: BonusRecord[];
  onPunchIn: (siteName: string, notes: string) => Promise<void>;
  onPunchOut: (notes?: string) => Promise<void>;
  isAdmin: boolean;
  onOpenSwitchUser: () => void;
  onEditRecord: (record: PunchRecord) => void;
}

export const PunchClock: React.FC<PunchClockProps> = ({
  currentEmployee,
  todayRecord,
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

  const timeString = currentTime.toLocaleTimeString('zh-TW', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateString = currentTime.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const isClockedIn = Boolean(todayRecord && todayRecord.clockInTime);
  const isClockedOut = Boolean(todayRecord && todayRecord.clockOutTime);

  // 計算當月出勤工資
  const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
  const empMonthRecords = records.filter(
    (r) => r.employeeId === currentEmployee.id && r.date.startsWith(currentMonthPrefix)
  );
  const monthWorkWage = empMonthRecords.reduce((sum, r) => sum + (Number(r.calculatedWage) || 0), 0);

  // 計算當月加給總額
  const empMonthBonuses = bonuses.filter(
    (b) => b.employeeId === currentEmployee.id && b.date.startsWith(currentMonthPrefix)
  );
  const monthBonusTotal = empMonthBonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const monthTotalSalary = monthWorkWage + monthBonusTotal;

  // 近期個人出勤紀錄（取最近 5 筆）
  const empRecentRecords = records
    .filter((r) => r.employeeId === currentEmployee.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
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
          <div className="text-4xl sm:text-5xl font-mono font-black text-[#2B2521] tracking-wider my-2">
            {timeString}
          </div>
          
          {/* 當前人員與【換人打卡】快捷按鈕 */}
          <div className="inline-flex items-center gap-2 p-1.5 pl-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <span className="text-xs text-[#706458]">出勤人員：</span>
            <span className="font-bold text-[#2B2521] text-sm">{currentEmployee.name}</span>
            <button
              type="button"
              onClick={onOpenSwitchUser}
              className="px-2.5 py-1 text-[11px] font-bold text-[#4A3D32] bg-[#EAE3DA] hover:bg-[#DFD6C9] border border-[#D4C9BC] rounded-xl transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
              title="切換打卡人員"
            >
              <Users className="w-3 h-3 text-[#6E5D4F]" />
              <span>換人打卡</span>
            </button>
          </div>
        </div>

        {/* 打卡互動操作區 */}
        {!isClockedIn ? (
          <div className="space-y-3">
            <div className="space-y-2 text-left">
              <div>
                <label className="block text-xs font-semibold text-[#54473C] mb-1">
                  今日施工案場名稱
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-[#998D80] absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="請填寫施工案場（例如：民權路門市、大安案場）"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full text-xs sm:text-sm border border-[#E6E1D8] rounded-xl pl-9 pr-4 py-2.5 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473C] mb-1">
                  打卡工作備註 <span className="text-[#998D80] font-normal">(選填)</span>
                </label>
                <input
                  type="text"
                  placeholder="備註說明（無可留空）"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
                />
              </div>
            </div>

            <button
              onClick={handlePunchInClick}
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-[#2B2521] hover:bg-[#1E1916] text-white font-black text-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? '打卡同步中...' : '上班打卡'}
            </button>
          </div>
        ) : !isClockedOut ? (
          <div className="space-y-3">
            <div className="p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#E6E1D8] text-xs text-left space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#706458]">上班打卡時間：</span>
                <span className="font-mono font-bold text-[#2B2521]">{todayRecord?.clockInTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#706458]">施工案場：</span>
                <span className="font-bold text-[#2B2521]">{todayRecord?.siteName || '未指定案場'}</span>
              </div>
            </div>

            <div className="text-left">
              <label className="block text-xs font-semibold text-[#54473C] mb-1">
                下班工作備註 / 施工進度回報 <span className="text-[#998D80] font-normal">(選填)</span>
              </label>
              <input
                type="text"
                placeholder="例如：櫃體組裝完畢、明日待收尾"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs sm:text-sm border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
              />
            </div>

            <button
              onClick={handlePunchOutClick}
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-[#6E5D4F] hover:bg-[#5C4D40] text-white font-black text-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? '打卡同步中...' : '下班打卡'}
            </button>
          </div>
        ) : (
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>今日上下班打卡均已順利完成！辛苦了！</span>
          </div>
        )}
      </div>

      {/* 2. 本日出勤打卡狀態 (詳細數據儀表板) */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#6E5D4F]" />
            <h3 className="font-bold text-sm text-[#2B2521]">本日出勤打卡狀態</h3>
          </div>
          <div>
            {!isClockedIn ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                今日未出勤
              </span>
            ) : !isClockedOut ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold animate-pulse">
                施工出勤中
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                已完成下班打卡
              </span>
            )}
          </div>
        </div>

        {/* 4 格統計數值 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <div className="text-[10px] text-[#706458] font-medium">上班打卡</div>
            <div className="text-sm font-mono font-bold text-[#2B2521] mt-0.5">
              {todayRecord?.clockInTime || '--:--:--'}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <div className="text-[10px] text-[#706458] font-medium">下班打卡</div>
            <div className="text-sm font-mono font-bold text-[#2B2521] mt-0.5">
              {todayRecord?.clockOutTime || (isClockedIn ? '出勤中' : '--:--:--')}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <div className="text-[10px] text-[#706458] font-medium">本日工時</div>
            <div className="text-sm font-mono font-bold text-[#2B2521] mt-0.5">
              {todayRecord?.durationHours ? `${todayRecord.durationHours} 小時` : '0 小時'}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8]">
            <div className="text-[10px] text-[#706458] font-medium">預估日薪工資</div>
            <div className="text-sm font-mono font-bold text-[#6E5D4F] mt-0.5">
              NT$ {(todayRecord?.calculatedWage || currentEmployee.dailyRate).toLocaleString()}
            </div>
          </div>
        </div>

        {/* 案場與備註資訊欄 */}
        {isClockedIn && (
          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E1D8] text-xs space-y-1.5">
            <div className="flex items-start gap-1.5">
              <span className="text-[#706458] shrink-0">施工案場：</span>
              <span className="font-bold text-[#2B2521]">{todayRecord?.siteName || '未指定案場名稱'}</span>
            </div>
            {todayRecord?.notes && (
              <div className="flex items-start gap-1.5">
                <span className="text-[#706458] shrink-0">工作備註：</span>
                <span className="text-[#54473C]">{todayRecord.notes}</span>
              </div>
            )}
            {isAdmin && todayRecord && (
              <div className="pt-1 text-right">
                <button
                  type="button"
                  onClick={() => onEditRecord(todayRecord)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E5D4F] hover:underline"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>管理員修正本日紀錄</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. 當月預估實領薪資卡片 (含加給自動累積) */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-[#706458]">
            當月預估實領薪資 ({new Date().getMonth() + 1} 月)
          </div>
          {monthBonusTotal > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EAE3DA] text-[#4A3D32] border border-[#D4C9BC]">
              <Coins className="w-3 h-3 text-[#6E5D4F]" />
              <span>含加給 +NT${monthBonusTotal.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="flex items-baseline justify-between">
          <div className="text-2xl sm:text-3xl font-mono font-black text-[#2B2521]">
            NT$ {monthTotalSalary.toLocaleString()}
          </div>
          <div className="text-xs text-[#8A7D70]">
            出勤本薪: NT${monthWorkWage.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 4. 近期個人出勤紀錄清單 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#6E5D4F]" />
            <h4 className="font-bold text-sm text-[#2B2521]">近期個人出勤紀錄</h4>
          </div>
          <span className="text-[11px] text-[#8A7D70]">最近 5 筆出勤</span>
        </div>

        {empRecentRecords.length === 0 ? (
          <div className="text-center py-5 text-xs text-[#998D80] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E6E1D8]">
            目前尚無近期出勤打卡紀錄
          </div>
        ) : (
          <div className="divide-y divide-[#E6E1D8]">
            {empRecentRecords.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#2B2521]">{r.date}</span>
                    <span className="px-1.5 py-0.2 rounded bg-[#FAF8F5] border border-[#E6E1D8] text-[10px] text-[#706458]">
                      {r.siteName || '一般出勤'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#706458] mt-0.5">
                    {r.clockInTime} ~ {r.clockOutTime || '未打下班卡'}
                    {r.durationHours ? ` · ${r.durationHours}小時` : ''}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-[#6E5D4F]">
                    NT$ {(r.calculatedWage || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[#998D80]">
                    {r.wageMultiplier ? `${r.wageMultiplier}工` : '1.0工'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
