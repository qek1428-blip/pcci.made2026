import React, { useState, useEffect, useMemo } from 'react';
import { Employee, PunchRecord } from '../types';
import {
  Clock,
  MapPin,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  Shield,
  Edit2,
  Trash2,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { playPunchSound } from '../utils/sound';

interface PunchClockProps {
  currentEmployee: Employee;
  todayRecord?: PunchRecord;
  records?: PunchRecord[];
  onPunchIn: (siteName: string, notes: string, locationStr?: string) => Promise<void>;
  onPunchOut: (notes?: string) => Promise<void>;
  isAdmin: boolean;
  onOpenSwitchUser: () => void;
  onEditRecord?: (record: PunchRecord) => void;
}

// Helper to extract unique sites from records within the last 14 days
const getRecentSitesFromRecords = (recordsList?: PunchRecord[]): string[] => {
  if (!recordsList || recordsList.length === 0) return ['板橋民權路華廈翻修'];
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];

  const recent = recordsList
    .filter((r) => r.date >= fourteenDaysAgoStr && r.siteName?.trim())
    .map((r) => r.siteName.trim());

  const unique = Array.from(new Set(recent));
  return unique.length > 0 ? unique : ['板橋民權路華廈翻修'];
};

export const PunchClock: React.FC<PunchClockProps> = ({
  currentEmployee,
  todayRecord,
  records = [],
  onPunchIn,
  onPunchOut,
  isAdmin,
  onOpenSwitchUser,
  onEditRecord,
}) => {
  const [time, setTime] = useState(new Date());

  // Dynamic sites management (persisted in localStorage + recent 2 weeks auto-retained)
  const [sites, setSites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bobb_construction_sites');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return getRecentSitesFromRecords(records);
  });

  const recentTwoWeeksSet = useMemo(() => {
    return new Set(getRecentSitesFromRecords(records));
  }, [records]);

  // Sync sites with recent 2 weeks on first records load
  useEffect(() => {
    if (records && records.length > 0) {
      setSites((prev) => {
        const recentSites = getRecentSitesFromRecords(records);
        const merged = Array.from(new Set([...prev, ...recentSites]));
        if (merged.length !== prev.length) {
          try {
            localStorage.setItem('bobb_construction_sites', JSON.stringify(merged));
          } catch {
            // ignore
          }
          return merged;
        }
        return prev;
      });
    }
  }, [records]);

  const saveSites = (newSites: string[]) => {
    setSites(newSites);
    try {
      localStorage.setItem('bobb_construction_sites', JSON.stringify(newSites));
    } catch {
      // ignore
    }
  };

  const [selectedSite, setSelectedSite] = useState(
    todayRecord?.siteName || sites[0] || '板橋民權路華廈翻修'
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSiteValue, setNewSiteValue] = useState('');
  const [punchNotes, setPunchNotes] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [locationText, setLocationText] = useState(
    todayRecord?.location?.address || '新北市現場施工'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Live Clock Tick
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync site if today's record exists
  useEffect(() => {
    if (todayRecord?.siteName) {
      setSelectedSite(todayRecord.siteName);
    }
  }, [todayRecord]);

  const timeString = time.toLocaleTimeString('zh-TW', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const dateString = time.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  // GPS Location fetcher
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationText('瀏覽器不支援 GPS');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        setLocationText(`GPS 定位 (${lat}, ${lng}) - 案場打卡`);
        setIsLocating(false);
      },
      () => {
        // Fallback default
        setLocationText('現場打卡（施工區域內）');
        setIsLocating(false);
      },
      { timeout: 5000 }
    );
  };

  const handleClockInAction = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onPunchIn(selectedSite, punchNotes, locationText);
      playPunchSound('in');
      setSuccessToast(`【上班打卡完成】${currentEmployee.name} 已於 ${timeString} 打上班卡！`);
      setTimeout(() => setSuccessToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOutAction = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onPunchOut(punchNotes);
      playPunchSound('out');
      setSuccessToast(`【下班打卡完成】${currentEmployee.name} 今日工時已儲存至雲端表單！`);
      setTimeout(() => setSuccessToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine attendance status
  const isPunchedIn = Boolean(todayRecord);
  const isPunchedOut = Boolean(todayRecord?.clockOutTime);

  // Compute live elapsed time if clocked in and not clocked out
  let elapsedMinutes = 0;
  if (isPunchedIn && !isPunchedOut && todayRecord?.clockInTime) {
    const [inH, inM] = todayRecord.clockInTime.split(':').map(Number);
    const nowH = time.getHours();
    const nowM = time.getMinutes();
    elapsedMinutes = Math.max(0, (nowH - inH) * 60 + (nowM - inM));
  }
  const elapsedHoursText = `${Math.floor(elapsedMinutes / 60)} 小時 ${elapsedMinutes % 60} 分鐘`;

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-500 text-white shadow-lg flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div className="font-semibold text-sm sm:text-base">{successToast}</div>
        </div>
      )}

      {/* Main Digital Clock Card (Black background, responsive date, no watermark) */}
      <div className="bg-black text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
          <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white truncate">
              {dateString}
            </span>
          </div>

          <div className="flex items-center shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-white/10 text-slate-200 border border-white/10 whitespace-nowrap">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
              雲端打卡機連線中
            </span>
          </div>
        </div>

        {/* Big Live Digital Clock Display */}
        <div className="text-center py-3 sm:py-5">
          <div className="text-5xl xs:text-6xl sm:text-7xl font-mono font-bold tracking-tight text-white tabular-nums drop-shadow-md">
            {timeString}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-2">
            領日薪制 · 實際打卡時間作為每日工數與工資依據
          </p>
        </div>

        {/* Current Employee Profile Pill without thumbnail */}
        <div className="mt-4 pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base sm:text-lg">
                {currentEmployee.name}
              </span>
              {isAdmin ? (
                <span className="text-[11px] font-bold text-amber-300 bg-amber-950/80 border border-amber-600/50 px-2 py-0.5 rounded-md">
                  管理人
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-300 bg-slate-700/60 px-2 py-0.5 rounded-md">
                  {currentEmployee.workType}
                </span>
              )}
            </div>
            <p className="text-xs text-orange-300/90 font-mono mt-0.5">
              日薪標準：NT$ {currentEmployee.dailyRate.toLocaleString()} / 天
            </p>
          </div>

          <button
            onClick={onOpenSwitchUser}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            換人打卡 ⇄
          </button>
        </div>
      </div>

      {/* Today Punch Status Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-600" />
            本日出勤打卡狀態
          </span>
          {isPunchedOut ? (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              ✓ 今日已完成下班打卡
            </span>
          ) : isPunchedIn ? (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              現場施工中 · 累計 {elapsedHoursText}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
              尚未打上班卡
            </span>
          )}
        </h3>

        {/* Detailed Times Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500">上班打卡</div>
            <div className="text-lg font-mono font-bold text-slate-900 mt-1">
              {todayRecord?.clockInTime || '--:--:--'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500">下班打卡</div>
            <div className="text-lg font-mono font-bold text-slate-900 mt-1">
              {todayRecord?.clockOutTime || '--:--:--'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500">本日工時</div>
            <div className="text-lg font-mono font-bold text-orange-600 mt-1">
              {todayRecord?.durationHours !== undefined
                ? `${todayRecord.durationHours} 小時`
                : isPunchedIn
                ? `${(elapsedMinutes / 60).toFixed(1)} h (進行中)`
                : '-'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-xs text-slate-500">預估當日工數薪資</div>
            <div className="text-lg font-mono font-bold text-emerald-700 mt-1">
              {todayRecord?.calculatedWage
                ? `NT$ ${todayRecord.calculatedWage.toLocaleString()}`
                : isPunchedIn
                ? `1.0 工 (NT$ ${currentEmployee.dailyRate.toLocaleString()})`
                : '-'}
            </div>
          </div>
        </div>

        {todayRecord?.modifiedByAdmin && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              此筆紀錄由管理員 (薄老闆) 審核修訂
            </span>
            {isAdmin && onEditRecord && (
              <button
                onClick={() => onEditRecord(todayRecord)}
                className="text-amber-900 font-semibold underline text-xs"
              >
                再編輯
              </button>
            )}
          </div>
        )}
      </div>

      {/* Punch Action Control Box */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">施工案場</h3>
          <span className="text-[11px] text-slate-400">
            點選案場打卡 · 支援自訂與編輯
          </span>
        </div>

        {/* Site Picker & Management */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sites.map((site, idx) => {
              const isSelected = selectedSite === site;
              const isEditing = editingIndex === idx;
              const isRecent = recentTwoWeeksSet.has(site);

              if (isEditing) {
                return (
                  <div
                    key={`edit-${idx}`}
                    className="p-2 rounded-xl border-2 border-orange-400 bg-orange-50/50 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = editingValue.trim();
                          if (trimmed) {
                            const updated = [...sites];
                            const oldName = updated[idx];
                            updated[idx] = trimmed;
                            saveSites(updated);
                            if (selectedSite === oldName) setSelectedSite(trimmed);
                          }
                          setEditingIndex(null);
                        } else if (e.key === 'Escape') {
                          setEditingIndex(null);
                        }
                      }}
                      autoFocus
                      className="flex-1 px-2.5 py-1 text-xs bg-white border border-orange-300 rounded-lg focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const trimmed = editingValue.trim();
                        if (trimmed) {
                          const updated = [...sites];
                          const oldName = updated[idx];
                          updated[idx] = trimmed;
                          saveSites(updated);
                          if (selectedSite === oldName) setSelectedSite(trimmed);
                        }
                        setEditingIndex(null);
                      }}
                      title="儲存名稱"
                      className="p-1 rounded-md bg-orange-600 text-white hover:bg-orange-700 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIndex(null);
                      }}
                      title="取消"
                      className="p-1 rounded-md bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={site}
                  onClick={() => {
                    if (!isPunchedOut) {
                      setSelectedSite(site);
                      playPunchSound('tap');
                    }
                  }}
                  className={`group relative px-3 py-2.5 rounded-xl text-xs font-medium border transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/90 text-orange-950 font-bold shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate min-w-0 pr-2">
                    <span className="shrink-0">📍</span>
                    <span className="truncate">{site}</span>
                    {isRecent && (
                      <span className="shrink-0 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-normal">
                        近兩週
                      </span>
                    )}
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIndex(idx);
                        setEditingValue(site);
                      }}
                      title="修改案場名稱"
                      className="p-1 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-100/60 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sites.length <= 1) {
                          alert('至少需保留一個施工案場');
                          return;
                        }
                        const updated = sites.filter((_, i) => i !== idx);
                        saveSites(updated);
                        if (selectedSite === site) {
                          setSelectedSite(updated[0] || '');
                        }
                      }}
                      title="刪除案場"
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Site Row */}
          {!isAddingSite ? (
            <button
              type="button"
              onClick={() => setIsAddingSite(true)}
              className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-bold transition-colors cursor-pointer pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              新增施工案場
            </button>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="輸入新案場名稱 (如：汐止民生路外牆防水)"
                value={newSiteValue}
                onChange={(e) => setNewSiteValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = newSiteValue.trim();
                    if (trimmed) {
                      if (!sites.includes(trimmed)) {
                        const updated = [...sites, trimmed];
                        saveSites(updated);
                      }
                      setSelectedSite(trimmed);
                      setNewSiteValue('');
                      setIsAddingSite(false);
                    }
                  } else if (e.key === 'Escape') {
                    setIsAddingSite(false);
                    setNewSiteValue('');
                  }
                }}
                autoFocus
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = newSiteValue.trim();
                  if (trimmed) {
                    if (!sites.includes(trimmed)) {
                      const updated = [...sites, trimmed];
                      saveSites(updated);
                    }
                    setSelectedSite(trimmed);
                    setNewSiteValue('');
                    setIsAddingSite(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-bold bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors cursor-pointer"
              >
                新增
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingSite(false);
                  setNewSiteValue('');
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {/* Location & GPS Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
            <span className="font-medium text-slate-700">案場定位：</span>
            <span>{locationText}</span>
          </div>
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={isLocating}
            className="text-orange-600 hover:text-orange-700 font-semibold underline text-left sm:text-right"
          >
            {isLocating ? '抓取定位中...' : '重新抓取 GPS'}
          </button>
        </div>

        {/* Daily Remarks / Work note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            工作備註 (選填，如：今日進材料 / 加班 / 灌漿)
          </label>
          <div className="relative">
            <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={punchNotes}
              onChange={(e) => setPunchNotes(e.target.value)}
              placeholder="例如：提早進料、防水塗佈第一道完成"
              disabled={isPunchedOut}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Large Tactile Punch Buttons */}
        <div className="pt-2">
          {!isPunchedIn ? (
            /* Punch In Button */
            <button
              onClick={handleClockInAction}
              disabled={isSubmitting}
              className="w-full py-4 sm:py-5 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] text-white font-bold text-xl sm:text-2xl shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <span className="tracking-wider">上班</span>
            </button>
          ) : !isPunchedOut ? (
            /* Punch Out Button */
            <button
              onClick={handleClockOutAction}
              disabled={isSubmitting}
              className="w-full py-4 sm:py-5 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold text-xl sm:text-2xl shadow-lg shadow-slate-900/25 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="tracking-wider">下班</span>
            </button>
          ) : (
            /* Completed Banner */
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-emerald-900 text-base">
                今日上下班打卡皆已完成！
              </h4>
              <p className="text-xs text-emerald-700 mt-1">
                打卡紀錄已自動同步存至薄薄工程行雲端表單。
              </p>
              {isAdmin && todayRecord && onEditRecord && (
                <button
                  onClick={() => onEditRecord(todayRecord)}
                  className="mt-3 px-4 py-1.5 text-xs font-semibold bg-white text-emerald-800 rounded-lg border border-emerald-300 hover:bg-emerald-50"
                >
                  管理員修正此筆打卡
                </button>
              )}
            </div>
          )}
        </div>

        {/* Construction Notice footer */}
        <div className="text-xs text-slate-500 flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
          <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
          <span>
            <strong>出勤規範說明：</strong> 本工程行師傅及員工採日薪制核算。員工本人僅可打上班與下班卡，無法自行修改歷史打卡紀錄；如有遺漏或時間需修正，請於次日前向管理人（薄老闆）回報進行系統補登。
          </span>
        </div>
      </div>
    </div>
  );
};
