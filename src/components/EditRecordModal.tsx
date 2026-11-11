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
    record?.employeeId || initialEmployeeId || employees[0]?.id || ''
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

  // 當開啟視窗或傳入紀錄變更時同步設定表單
  useEffect(() => {
    if (record) {
      setEmployeeId(record.employeeId);
      setDate(record.date);
      setClockInTime(record.clockInTime);
      setClockOutTime(record.clockOutTime || '17:30:00');
      setSiteName(record.siteName);
      setWageMultiplier(record.wageMultiplier !== undefined ? record.wageMultiplier : 1.0);
      setCalculatedWage(record.calculatedWage || 3000);
      setNotes(record.notes || '');
      setAdminNote(record.adminNote || '管理員修正打卡時間');
    } else {
      const defaultEmpId = initialEmployeeId || employees[0]?.id || '';
      setEmployeeId(defaultEmpId);
      setDate(initialDate || new Date().toISOString().split('T')[0]);
      setClockInTime('08:00:00');
      setClockOutTime('17:30:00');
      setSiteName('板橋民權路華廈翻修');
      setWageMultiplier(1.0);
      const defaultEmp = employees.find((e) => e.id === defaultEmpId);
      setCalculatedWage(defaultEmp?.dailyRate || 3000);
      setNotes('');
