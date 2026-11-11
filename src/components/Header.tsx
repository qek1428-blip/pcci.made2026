import React, { useState, useEffect } from 'react';
import { Employee } from '../types';
import { ChevronDown } from 'lucide-react';

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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center shrink-0 shadow-sm">
            <img
              src="/assets/aistudio/863124797_18147268753527563_3107301639635258165_n_8751ed07.jpg"
              alt="薄薄工程行"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                薄薄工程行
              </span>
              <span className="hidden sm:inline-block text-xs font-semibold px-2 py-0.5 bg-orange-100 text-orange-800 rounded">
                打卡系統
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              日薪制員工考勤 · 雲端表單即時同步
            </p>
          </div>
        </div>

        {/* Right Zone: User Switcher & Status Pill */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Clock on desktop */}
          <div className="text-right hidden sm:block mr-1">
            <div className="text-sm font-mono font-bold text-slate-900 tabular-nums">
              {timeStr}
            </div>
            <div className="text-xs text-slate-500">
              {dateStr}
            </div>
          </div>

          {/* Single stable Identity Button without thumbnail */}
          {(() => {
            const activeEmployee =
              employees.find((e) => e.id === currentEmployee.id) || currentEmployee;
            const roleLabel =
              activeEmployee.role === 'admin' || isAdmin ? '管理人' : '員工';

            return (
              <button
                onClick={onOpenSwitchUser}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-[0.98] transition-all text-left"
                title="點擊切換打卡人員或管理員"
              >
                <div className="text-left flex flex-col">
                  <span className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">
                    {activeEmployee.name}
                  </span>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    {roleLabel}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
              </button>
            );
          })()}
        </div>
      </div>
    </header>
  );
};
