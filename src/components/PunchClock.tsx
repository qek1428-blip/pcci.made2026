import React, { useState, useEffect } from 'react';
import { Employee, PunchRecord, BonusRecord } from '../types';
import { Clock, MapPin, CheckCircle2, ChevronRight, Coins } from 'lucide-react';
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

  // 計算當月加給總額 (員工無須打卡即可自動加總)
  const empMonthBonuses = bonuses.filter(
    (b) => b.employeeId === currentEmployee.id && b.date.startsWith(currentMonthPrefix)
  );

  const monthBonusTotal = empMonthBonuses.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const monthTotalSalary = monthWorkWage + monthBonusTotal;

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
      {/* 打卡主卡片 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-6 shadow-xs text-center space-y-5">
        <div>
          <div className="text-xs text-[#706458] font-medium">{dateString}</div>
          <div className="text-4xl sm:text-5xl font-mono font-black text-[#2B2521] tracking-wider my-2">
            {timeString}
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#E6E1D8] text-xs text-[#54473C]">
            <span>當前出勤人員：</span>
            <span className="font-bold text-[#2B2521]">{currentEmployee.name}</span>
          </div>
        </div>

        {/* 打卡動作區 */}
        {!isClockedIn ? (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="今日案場名稱（選填）"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full text-xs sm:text-sm border border-[#E6E1D8] rounded-xl px-4 py-2.5 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
            />
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
            <div className="p-3 bg-[#EAE3DA]/50 rounded-2xl border border-[#D4C9BC] text-xs text-[#4A3D32]">
              上班時間：<span className="font-mono font-bold">{todayRecord?.clockInTime}</span>
              {todayRecord?.siteName && <span> · 案場：{todayRecord.siteName}</span>}
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
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>今日上下班打卡均已順利完成！辛苦了！</span>
          </div>
        )}
      </div>

      {/* 當月預估實領薪資卡片 (含自動加總之薪資加給) */}
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
    </div>
  );
};
