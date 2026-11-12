import React, { useState, useEffect } from 'react';
import { PunchRecord, Employee } from '../types';
import { Shield, Clock, MapPin, Trash2, X, Check, DollarSign } from 'lucide-react';
import { playPunchSound } from '../utils/sound';

interface EditRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: PunchRecord | null;
  employees: Employee[];
  onSaveRecord: (updatedData: Partial<PunchRecord>) => Promise<void>;
  onDeleteRecord?: (recordId: string) => Promise<void>;
  initialDate?: string;
  initialEmployeeId?: string;
}

// 工時與工數精確計算：少於4小時算0.5工(折半)，滿5小時扣1小時休息為1工
export const calculateWorkStats = (inTime: string, outTime: string, dailyRate: number) => {
  if (!inTime || !outTime.trim()) {
    return { durationHours: 0, wageMultiplier: 1.0, calculatedWage: dailyRate };
  }
  const [inH = 0, inM = 0, inS = 0] = inTime.split(':').map(Number);
  const [outH = 0, outM = 0, outS = 0] = outTime.split(':').map(Number);
  let diffSeconds = (outH * 3600 + outM * 60 + outS) - (inH * 3600 + inM * 60 + inS);
  if (diffSeconds < 0) diffSeconds += 24 * 3600; // 跨天防呆

  const rawHours = diffSeconds / 3600;

  // 滿 5 小時以上扣除 1 小時休息時間（9小時在場 -> 8小時實計）
  let netHours = rawHours >= 5 ? Math.max(4, rawHours - 1) : rawHours;
  let durationHours = Math.round(netHours * 10) / 10;
  if (rawHours > 0 && durationHours === 0) durationHours = 0.1; // 極短時間打卡至少計 0.1 小時

  // 未滿 4 小時算 0.5 工，滿 4 小時算 1.0 工
  const wageMultiplier = rawHours < 4 ? 0.5 : 1.0;
  const calculatedWage = Math.round(dailyRate * wageMultiplier);

  return { durationHours, wageMultiplier, calculatedWage };
};

export const EditRecordModal: React.FC<EditRecordModalProps> = ({
  isOpen,
  onClose,
  record,
  employees,
  onSaveRecord,
  onDeleteRecord,
  initialDate,
  initialEmployeeId,
}) => {
  const isCreating = !record;

  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState('');
  const [clockInTime, setClockInTime] = useState('08:00:00');
  const [clockOutTime, setClockOutTime] = useState('');
  const [siteName, setSiteName] = useState('');
  const [wageMultiplier, setWageMultiplier] = useState<number>(1.0);
  const [calculatedWage, setCalculatedWage] = useState<number>(3000);
  const [notes, setNotes] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 僅在彈窗開啟時初始化一次，避免背景同步更新時覆蓋使用者正在編輯的內容
  useEffect(() => {
    if (!isOpen) return;

    if (record) {
      setEmployeeId(record.employeeId);
      setDate(record.date);
      setClockInTime(record.clockInTime);
      // 若原先尚未下班，保持為空字串，絕不自動帶入 17:00:00
      setClockOutTime(record.clockOutTime ? record.clockOutTime : '');
      setSiteName(record.siteName || '');
      setWageMultiplier(record.wageMultiplier !== undefined ? record.wageMultiplier : 1.0);
      setCalculatedWage(record.calculatedWage || 3000);
      setNotes(record.notes || '');
      setAdminNote(record.adminNote || '管理員修正打卡時間');
    } else {
      const defaultEmpId = initialEmployeeId || employees[0]?.id || '';
      setEmployeeId(defaultEmpId);
      setDate(initialDate || new Date().toISOString().split('T')[0]);
      setClockInTime('08:00:00');
      setClockOutTime(''); // 新增補登預設也留空，由使用者自由決定是否補下班卡
      setSiteName(''); // 施工案場預設留空
      setWageMultiplier(1.0);
      const defaultEmp = employees.find((e) => e.id === defaultEmpId);
      setCalculatedWage(defaultEmp?.dailyRate || 3000);
      setNotes('');
      setAdminNote('管理員手動補登');
    }
  }, [isOpen]);

  // 當使用者變更時間或人員時，自動重新計算工數與工資
  const handleTimeOrUserChange = (newEmpId: string, newIn: string, newOut: string) => {
    const emp = employees.find((e) => e.id === newEmpId);
    const dailyRate = emp?.dailyRate || 3000;
    if (newIn && newOut.trim()) {
      const stats = calculateWorkStats(newIn, newOut.trim(), dailyRate);
      setWageMultiplier(stats.wageMultiplier);
      setCalculatedWage(stats.calculatedWage);
    } else {
      setWageMultiplier(1.0);
      setCalculatedWage(dailyRate);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const targetEmpId = employeeId || employees[0]?.id;
    if (!targetEmpId) {
      alert('請先選擇出勤人員！');
      return;
    }

    setIsSubmitting(true);
    try {
      const emp = employees.find((e) => e.id === targetEmpId);
      const cleanClockOut = clockOutTime.trim();
      let durationHours = 0;
      let finalMultiplier = wageMultiplier;
      let finalWage = calculatedWage;

      if (cleanClockOut) {
        const stats = calculateWorkStats(clockInTime, cleanClockOut, emp?.dailyRate || 3000);
        durationHours = stats.durationHours;
        finalMultiplier = stats.wageMultiplier;
        finalWage = stats.calculatedWage;
      }

      await onSaveRecord({
        ...(record ? { id: record.id } : {}),
        employeeId: targetEmpId,
        employeeName: emp ? emp.name : '員工',
        date,
        clockInTime,
        clockOutTime: cleanClockOut, // 留空即代表出勤中
        siteName: siteName.trim(),
        durationHours,
        wageMultiplier: finalMultiplier,
        calculatedWage: finalWage,
        notes,
        adminNote,
        modifiedByAdmin: true,
      });
      playPunchSound('in');
      onClose();
    } catch (err) {
      console.error('儲存紀錄錯誤:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!record || !onDeleteRecord) return;
    if (window.confirm(`確定要刪除 ${record.employeeName} 於 ${record.date} 的打卡紀錄嗎？`)) {
      setIsSubmitting(true);
      try {
        await onDeleteRecord(record.id);
        playPunchSound('tap');
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-taupe-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-taupe-200">
        <div className="px-6 py-4 bg-taupe-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-taupe-400" />
            <div>
              <h3 className="font-bold text-base">
                {isCreating ? '管理員手動補登打卡' : '管理員修正打卡時間與工數'}
              </h3>
              <p className="text-xs text-taupe-400">
                薄薄工程行 · 僅管理員具備此修改權限
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-taupe-400 hover:text-white hover:bg-taupe-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 出勤人員與日期 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-taupe-700 mb-1">
                出勤人員
              </label>
              <select
                value={employeeId}
                onChange={(e) => {
                  const val = e.target.value;
                  setEmployeeId(val);
                  handleTimeOrUserChange(val, clockInTime, clockOutTime);
                }}
                required
                className="w-full text-xs sm:text-sm border border-taupe-300 rounded-xl px-3 py-2 bg-taupe-50 focus:outline-none focus:ring-2 focus:ring-taupe-500 font-medium"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role === 'admin' ? '管理人' : emp.workType} · NT${emp.dailyRate}/天)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-taupe-700 mb-1">
                打卡日期
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs sm:text-sm border border-taupe-300 rounded-xl px-3 py-2 bg-taupe-50 focus:outline-none focus:ring-2 focus:ring-taupe-500"
              />
            </div>
          </div>

          {/* 上下班時間 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-taupe-700 mb-1">
                上班打卡時間
              </label>
              <input
                type="text"
                required
                placeholder="08:00:00"
                value={clockInTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setClockInTime(val);
                  handleTimeOrUserChange(employeeId, val, clockOutTime);
                }}
                className="w-full text-xs sm:text-sm border border-taupe-300 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-taupe-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-taupe-700">
                  下班時間 <span className="text-taupe-400 font-normal">(留空=出勤中)</span>
                </label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setClockOutTime('');
                      handleTimeOrUserChange(employeeId, clockInTime, '');
                    }}
                    className="text-[10px] text-taupe-500 hover:text-taupe-600 underline"
                  >
                    清空(出勤中)
                  </button>
                  <span className="text-taupe-300 text-[10px]">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setClockOutTime('17:00:00');
                      handleTimeOrUserChange(employeeId, clockInTime, '17:00:00');
                    }}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    帶入17:00
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="留空即代表未下班"
                value={clockOutTime}
                onChange={(e) => {
                  const val = e.target.value;
                  setClockOutTime(val);
                  handleTimeOrUserChange(employeeId, clockInTime, val);
                }}
                className="w-full text-xs sm:text-sm border border-taupe-300 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-taupe-500"
              />
            </div>
          </div>

          {/* 工數折算與計算工資 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-taupe-700 mb-1">
                工數折算 (工)
              </label>
              <select
                value={wageMultiplier}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setWageMultiplier(m);
                  const emp = employees.find((x) => x.id === employeeId);
                  setCalculatedWage(Math.round((emp?.dailyRate || 3000) * m));
                }}
                className="w-full text-xs sm:text-sm border border-taupe-300 rounded-xl px-3 py-2 bg-taupe-50 focus:outline-none focus:ring-2 focus:ring-taupe-500 font-bold text-blue-700"
              >
                <option value="1.0">1.0 工 (正常全日工)</option>
                <option value="0.5">0.5 工 (未滿4小時/半天工)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-taupe-700 mb-1">
                核發日薪工資 (NT$)
              </label>
              <input
                type="number"
                step="50"
                value={calculatedWage}
                onChange={(e) => setCalculatedWage(Number(e.target.value))}
                className="w-full text-xs sm:text-sm border border-taupe-300 rounded-xl px-3 py-2 font-mono font-bold text-taupe-700 focus:outline-none focus:ring-2 focus:ring-taupe-500"
              />
            </div>
          </div>

          {/* 施工案場 */}
          <div>
            <label className="block text-xs font-semibold text-taupe-700 mb-1">
              施工案場 / 地點 <span className="text-taupe-400 font-normal">(選填)</span>
            </label>
            <input
              type="text"
              placeholder="請輸入施工案場名稱（無可留空）"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full text-xs sm:text-sm border border-taupe-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-taupe-500"
            />
          </div>

          {/* 管理員備註 */}
          <div>
            <label className="block text-xs font-semibold text-taupe-700 mb-1">
              管理員修正事由備註
            </label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="例如：忘記打卡補登、提早收工補登"
              className="w-full text-xs sm:text-sm border border-taupe-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-taupe-500"
            />
          </div>

          {/* 按鈕區 */}
          <div className="pt-3 border-t border-taupe-100 flex items-center justify-between">
            {!isCreating && onDeleteRecord ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>刪除此紀錄</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-taupe-600 border border-taupe-200 rounded-xl hover:bg-taupe-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-taupe-600 hover:bg-taupe-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>儲存至雲端</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
