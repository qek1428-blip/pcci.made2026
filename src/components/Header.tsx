import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { ChevronDown } from 'lucide-react';
import boboLogo from '../assets/images/bobo_logo.jpg';

interface HeaderProps {
  currentEmployee: Employee;
  employees: Employee[];
  isAdmin: boolean;
  onOpenSwitchUser: () => void;
  onToggleAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentEmployee,
  employees,
  isAdmin,
  onOpenSwitchUser,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('zh-TW', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateStr = currentTime.toLocaleDateString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <header
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E6E1D8] transition-all"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-black border border-[#2B2521] flex items-center justify-center shrink-0 shadow-sm">
            <img
              src={boboLogo}
              alt="薄薄工程行"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#2B2521] text-base tracking-tight leading-none">
                薄薄工程行
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-[#EAE3DA] text-[#4A3D32] border border-[#D4C9BC] rounded leading-none">
                打卡系統
              </span>
            </div>
            <p className="text-[10px] text-[#706458] hidden sm:block mt-0.5">
              日薪制員工考勤 · 雲端表單即時同步
            </p>
          </div>
        </div>

        {/* Right Zone: User Switcher & Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block mr-1">
            <div className="text-sm font-mono font-bold text-[#2B2521] tabular-nums">
              {timeStr}
            </div>
            <div className="text-xs text-[#706458]">
              {dateStr}
            </div>
          </div>

          {(() => {
            const activeEmployee =
              employees.find((e) => e.id === currentEmployee.id) || currentEmployee;
            const isBoss = activeEmployee.role === 'admin' || isAdmin;
            const roleLabel = isBoss ? '管理人' : '員工';

            return (
              <button
                onClick={onOpenSwitchUser}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E6E1D8] bg-white hover:bg-[#FAF8F5] active:scale-[0.98] transition-all text-left shadow-2xs"
                title="點擊切換打卡人員或管理員"
              >
                <div className="text-left flex flex-col">
                  <span className="text-xs sm:text-sm font-bold text-[#2B2521] leading-tight">
                    {activeEmployee.name}
                  </span>
                  <span className={`text-[9px] sm:text-[10px] leading-tight font-medium ${isBoss ? 'text-[#6E5D4F]' : 'text-[#8A7D70]'}`}>
                    {roleLabel}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#998D80] shrink-0" />
              </button>
            );
          })()}
        </div>
      </div>
    </header>
  );
};
