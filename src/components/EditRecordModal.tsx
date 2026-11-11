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
    record?.employeeId || initialEmployeeId || employees[1]?.id || ''
  );
  const [date, setDate] = useState(
    record?.date || initialDate || new Date().toISOString().split('T')[0]
  );
  const [clockInTime, setClockInTime] = useState(
    record?.clockInTime || '08:00:00'
  );
  const [clockOutTime, setClockOutTime] = useState(
    record?.clockOutTime || '17:30:00'
  );
  const [siteName, setSiteName] = useState(
    record?.siteName || '板橋民權路華廈翻修'
  );
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

  // Sync state if record prop changes
  useEffect(() => {
    if (record) {
      setEmployeeId(record.employeeId);
      setDate(record.date);
      setClockInTime(record.clockInTime);
      setClockOutTime(record.clockOutTime || '');
      setSiteName(record.siteName);
      setWageMultiplier(record.wageMultiplier !== undefined ? record.wageMultiplier : 1.0);
      setCalculatedWage(record.calculatedWage || 3000);
      setNotes(record.notes || '');
      setAdminNote(record.adminNote || '管理員修正打卡時間');
    } else {
      if (initialDate) setDate(initialDate);
      if (initialEmployeeId) setEmployeeId(initialEmployeeId);
    }
  }, [record, initialDate, initialEmployeeId]);

  // Recalculate estimated wage whenever employee or multiplier changes
  useEffect(() => {
    const emp = employees.find((e) => e.id === employeeId);
    if (emp) {
      setCalculatedWage(Math.round(emp.dailyRate * wageMultiplier));
    }
  }, [employeeId, wageMultiplier, employees]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const emp = employees.find((e) => e.id === employeeId);
      await onSaveRecord({
        ...(record ? { id: record.id } : {}),
        employeeId,
        employeeName: emp ? emp.name : '員工',
        date,
        clockInTime,
        clockOutTime: clockOutTime || undefined,
        siteName,
        wageMultiplier,
        calculatedWage,
        notes,
        adminNote,
        modifiedByAdmin: true,
      });
      playPunchSound('in');
      onClose();
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
          {/* Employee & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                出勤員工
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              >
                {employees
                  .filter((e) => e.role === 'worker')
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.workType} · NT${emp.dailyRate}/天)
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

          {/* Clock In & Clock Out Times */}
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
                下班打卡時間 (未打請留空)
              </label>
              <input
                type="text"
                placeholder="17:30:00"
                value={clockOutTime}
                onChange={(e) => setClockOutTime(e.target.value)}
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Wage Multiplier & Calculated Wage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                工數折算 (工)
              </label>
              <select
                value={wageMultiplier}
                onChange={(e) => setWageMultiplier(Number(e.target.value))}
                className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-blue-700"
              >
                <option value="1.0">1.0 工 (正常全日工)</option>
                <option value="0.5">0.5 工 (半天工)</option>
                <option value="1.25">1.25 工 (加班/夜間)</option>
                <option value="1.5">1.5 工 (重大搶工加班)</option>
                <option value="2.0">2.0 工 (雙工特勤)</option>
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

          {/* Site name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              施工案場 / 地點
            </label>
            <input
              type="text"
              required
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Admin Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              管理員修正事由備註
            </label>
            <input
              type="text"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="例如：員工忘記打卡、現場加班半小時補登"
              className="w-full text-xs sm:text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Footer Action Buttons */}
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
