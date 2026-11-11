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

// 工時與工數計算函式：未滿4小時算0.5工，9小時扣1小時休息為1工
export const calculateWorkStats = (inTime: string, outTime: string, dailyRate: number) => {
  if (!inTime || !outTime) {
    return { durationHours: 0, wageMultiplier: 1.0, calculatedWage: dailyRate };
  }
  const [inH, inM = 0] = inTime.split(':').map(Number);
  const [outH, outM = 0] = outTime.split(':').map(Number);
  let diffMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  if (diffMinutes < 0) diffMinutes += 24 * 60; // 跨午夜防呆

  const rawHours = diffMinutes / 60;
  // 滿 5 小時扣除 1 小時休息時間（9小時在場 -> 8小時工時）
  let netHours = rawHours >= 5 ? Math.max(4, rawHours - 1) : rawHours;
  netHours = Math.round(netHours * 10) / 10;

  // 未滿 4 小時算 0.5 工，滿 4 小時算 1.0 工（暫時移除加班倍率）
  const wageMultiplier = rawHours < 4 ? 0.5 : 1.0;
  const calculatedWage = Math.round(dailyRate * wageMultiplier);

  return { durationHours: netHours, wageMultiplier, calculatedWage };
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

  const [employeeId, setEmployeeId] = useState(
    record?.employeeId || initialEmployeeId || employees[0]?.id || ''
  );
  const [date, setDate] = useState(
    record?.date || initialDate || new Date().toISOString().split('T')[0]
  );
  const [clockInTime, setClockInTime] = useState(
    record?.clockInTime || '08:00:00'
  );
  // 預設下班時間改為 17:00:00，若是建立模式且需留空可自由清空
  const [clockOutTime, setClockOutTime] = useState(
    record?.clockOutTime !== undefined ? record.clockOutTime : (isCreating ? '17:00:00' : '')
  );
  // 施工案場全面留空
  const [siteName, setSiteName] = useState(record?.siteName || '');
  const [wageMultiplier, setWageMultiplier] = useState<number>(
    record?.wageMultiplier !== undefined ? record.wageMultiplier : 1.0
  );
  const [calculatedWage, setCalculatedWage] = useState<number>(
    record?.calculatedWage || 3000
  );
  const [notes, setNotes] = useState(record?.notes || '');
  const [adminNote, setAdminNote] = useState(
    record?.adminNote || (isCreating ? '管理員手動補登' : '管理員修正打卡時間')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表單初始化同步
  useEffect(() => {
    if (record) {
      setEmployeeId(record.employeeId);
      setDate(record.date);
      setClockInTime(record.clockInTime);
      setClockOutTime(record.clockOutTime || '');
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
      setClockOutTime('17:00:00');
      setSiteName(''); // 施工案場留空
      setWageMultiplier(1.0);
      const defaultEmp = employees.find((e) => e.id === defaultEmpId);
      setCalculatedWage(defaultEmp?.dailyRate || 3000);
      setNotes('');
      setAdminNote('管理員手動補登');
    }
  }, [record, initialDate, initialEmployeeId, employees, isOpen]);

  // 當調整上下班時間或切換人員時，自動試算工數與工資
  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    const dailyRate = emp?.dailyRate || 3000;
    if (clockInTime && clockOutTime.trim()) {
      const stats = calculateWorkStats(clockInTime, clockOutTime.trim(), dailyRate);
      setWageMultiplier(stats.wageMultiplier);
      setCalculatedWage(stats.calculatedWage);
    } else {
      // 若下班留空，預設 1.0 工日薪
      setWageMultiplier(1.0);
      setCalculatedWage(dailyRate);
    }
  }, [employeeId, clockInTime, clockOutTime, employees]);

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
      if (cleanClockOut) {
        const stats = calculateWorkStats(clockInTime, cleanClockOut, emp?.dailyRate || 3000);
        durationHours = stats.durationHours;
      }

      await onSaveRecord({
        ...(record ? { id: record.id } : {}),
        employeeId: targetEmpId,
        employeeName: emp ? emp.name : '員工',
        date,
        clockInTime,
        // 若下班時間留空，則傳入空字串，使打卡鐘能識別為「尚未下班」
        clockOutTime: cleanClockOut || '',
        siteName: siteName.trim(),
        durationHours,
        wageMultiplier,
        calculatedWage,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">
                {isCreating ? '管理員手動補登打卡' : '管理員修正打卡時間與工數'}
              </h3>
              <p className="text-xs text-slate-400">
                薄薄工程行 · 僅管理員 (薄老闆) 具備此修改權限
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* 出勤人員與日期 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                出勤人員
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role === 'admin' ? '管理人' : emp.workType} · NT${emp.dailyRate}/天)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                打卡日期
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* 上下班時間 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                上班打卡時間
              </label>
              <input
                type="text"
                required
                placeholder="08:00:00"
                value={clockInTime}
                onChange={(e) => setClockInTime(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                下班打卡時間 <span className="text-slate-400 font-normal">(未下班請留空)</span>
              </label>
              <input
                type="text"
                placeholder="17:00:00 (留空即代表未下班)"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* 工數折算與計算工資（已移除加班選項） */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-blue-700"
              >
                <option value="1.0">1.0 工 (正常全日工)</option>
                <option value="0.5">0.5 工 (未滿4小時/半天工)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                核發日薪工資 (NT$)
              </label>
              <input
                type="number"
                step="50"
                value={calculatedWage}
                onChange={(e) => setCalculatedWage(Number(e.target.value))}
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* 施工案場（預設留空） */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              施工案場 / 地點 <span className="text-slate-400 font-normal">(選填)</span>
            </label>
            <input
              type="text"
              placeholder="請輸入施工案場名稱（無可留空）"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* 管理員備註 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              管理員修正事由備註
            </label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="例如：忘記打卡補登、現場提早收工補登"
              className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* 按鈕區 */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
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
                className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
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
