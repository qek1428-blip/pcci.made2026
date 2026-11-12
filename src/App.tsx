import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PunchClock } from './components/PunchClock';
import { CalendarView } from './components/CalendarView';
import { CloudSheetView } from './components/CloudSheetView';
import { AdminPanel } from './components/AdminPanel';
import { EditRecordModal, calculateWorkStats } from './components/EditRecordModal';
import { Employee, PunchRecord, BonusRecord, CompanyState } from './types';
import { Clock, Calendar, FileSpreadsheet, Shield, KeyRound, MessageSquareWarning, X, Check, Lock, RefreshCw, Send, Delete, Eye, EyeOff, LogOut, Coins, Plus, Trash2 } from 'lucide-react';
import { playPunchSound } from './utils/sound';

import splashImg from './assets/images/splash.jpg';
import boboLogo from './assets/images/bobo_logo.jpg';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhrpQIs-ygEFPOhVM8tafjpjSccqGMcsZ2-41WuxvEL-N9jXWi7eJVTpkKqD1wYEBX/exec';

const sanitizePin = (pinVal: any, defaultPin: string = '0000'): string => {
  if (pinVal === null || pinVal === undefined || pinVal === '') return defaultPin;
  let s = String(pinVal).trim();
  if (/^\d+$/.test(s) && s.length < 4) {
    s = s.padStart(4, '0');
  }
  return s;
};

const formatRecordDate = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return str;
};

const formatRecordTime = (val: any): string => {
  if (!val) return '';
  const str = String(val).trim();
  const timeMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0');
    const mm = timeMatch[2].padStart(2, '0');
    const ss = timeMatch[3] ? timeMatch[3].padStart(2, '0') : '00';
    return `${hh}:${mm}:${ss}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return str;
};

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [bonuses, setBonuses] = useState<BonusRecord[]>([]);
  const [adminPin, setAdminPin] = useState('8888');

  // 登入驗證狀態
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 門禁登入頁選人與 PIN 碼
  const [loginSelectedUser, setLoginSelectedUser] = useState<Employee | null>(null);
  const [loginInputPin, setLoginInputPin] = useState('');
  const [loginPinError, setLoginPinError] = useState('');

  const [activeTab, setActiveTab] = useState<'punch' | 'calendar' | 'sheet' | 'admin'>('punch');

  // 密碼遮蔽開關
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // 補登編輯彈窗
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PunchRecord | null>(null);
  const [manualDate, setManualDate] = useState<string | undefined>();
  const [manualEmployeeId, setManualEmployeeId] = useState<string | undefined>();

  // 薪資加給新增彈窗
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [bonusEmpId, setBonusEmpId] = useState('ALL');
  const [bonusDate, setBonusDate] = useState(new Date().toISOString().split('T')[0]);
  const [bonusAmount, setBonusAmount] = useState<number | ''>('');
  const [bonusNote, setBonusNote] = useState('');
  const [isSavingBonus, setIsSavingBonus] = useState(false);

  // 系統內切換人員彈窗
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState(false);
  const [switchTargetUser, setSwitchTargetUser] = useState<Employee | null>(null);
  const [switchInputPin, setSwitchInputPin] = useState('');
  const [switchPinError, setSwitchPinError] = useState('');

  // 管理後台未授權解鎖輸入框
  const [adminUnlockPin, setAdminUnlockPin] = useState('');
  const [adminUnlockError, setAdminUnlockError] = useState('');

  // 修改個人密碼彈窗
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [activePinField, setActivePinField] = useState<'old' | 'new' | 'confirm'>('old');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState(false);

  // 管理員修改指定成員 PIN 碼彈窗
  const [adminEditTarget, setAdminEditTarget] = useState<Employee | null>(null);
  const [adminTargetNewPin, setAdminTargetNewPin] = useState('');
  const [adminPinSuccess, setAdminPinSuccess] = useState(false);

  // 問題回報彈窗
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('打卡時間有誤/忘記打卡');
  const [reportPhone, setReportPhone] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const sendToGoogleSheet = async (payload: any) => {
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      setTimeout(() => {
        fetchState();
      }, 1500);
    } catch (err) {
      console.error('傳送至 Google 試算表失敗:', err);
    }
  };

  const fetchState = async () => {
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL);
      const json = await res.json();
      if (json.success && json.data) {
        const data: CompanyState = json.data;
        let loadedEmployees: Employee[] = [];

        if (data.employees && data.employees.length > 0) {
          loadedEmployees = data.employees.map((emp) => {
            const isBoss = emp.role === 'admin' || emp.name === '吳昱勳';
            const cleanPin = sanitizePin((emp as any).pin, isBoss ? '8888' : '0000');
            return {
              ...emp,
              role: isBoss ? ('admin' as const) : ('worker' as const),
              active: true,
              pin: cleanPin,
            } as any;
          });

          setEmployees(loadedEmployees);

          if (currentEmployee) {
            const updated = loadedEmployees.find((e) => e.id === currentEmployee.id);
            if (updated) setCurrentEmployee(updated);
          }
        }

        if (data.records) {
          const sanitizedRecords: PunchRecord[] = data.records.map((r: any) => {
            const dateStr = formatRecordDate(r.date);
            const inTimeStr = formatRecordTime(r.clockInTime);
            const outTimeStr = r.clockOutTime ? formatRecordTime(r.clockOutTime) : '';

            let durationHours = Number(r.durationHours) || 0;
            let wageMultiplier = Number(r.wageMultiplier) || 1.0;
            let calculatedWage = Number(r.calculatedWage) || 0;

            if (inTimeStr && outTimeStr) {
              const emp = loadedEmployees.find((e) => String(e.id) === String(r.employeeId));
              const baseRate = emp ? emp.dailyRate : (calculatedWage > 0 ? calculatedWage : 2600);
              const stats = calculateWorkStats(inTimeStr, outTimeStr, baseRate);
              durationHours = stats.durationHours;
              wageMultiplier = stats.wageMultiplier;
              calculatedWage = stats.calculatedWage;
            }

            return {
              ...r,
              date: dateStr,
              clockInTime: inTimeStr,
              clockOutTime: outTimeStr,
              durationHours,
              wageMultiplier,
              calculatedWage,
            };
          });

          setRecords(sanitizedRecords);
        }

        if (data.bonuses) {
          const sanitizedBonuses: BonusRecord[] = data.bonuses.map((b: any) => ({
            id: String(b.id),
            date: formatRecordDate(b.date),
            employeeId: String(b.employeeId),
            employeeName: String(b.employeeName),
            amount: Number(b.amount) || 0,
            note: String(b.note || ''),
            createdAt: String(b.createdAt || '')
          }));
          setBonuses(sanitizedBonuses);
        }

        if (data.settings?.adminPin) {
          setAdminPin(sanitizePin(data.settings.adminPin, '8888'));
        }
      }
    } catch (err) {
      console.error('Google 試算表連線失敗:', err);
    } finally {
      setIsDataLoaded(true);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const currentTodayRecord = records.find(
    (r) => r.employeeId === currentEmployee?.id && r.date === todayStr
  );

  // 首頁門禁：登入驗證
  const handleLoginSubmit = () => {
    if (!loginSelectedUser) return;

    const isBoss = loginSelectedUser.role === 'admin' || loginSelectedUser.name === '吳昱勳';
    const expectedPin = sanitizePin(
      (loginSelectedUser as any).pin,
      isBoss ? adminPin : '0000'
    );
    const cleanInput = sanitizePin(loginInputPin);

    if (cleanInput === expectedPin || (isBoss && cleanInput === sanitizePin(adminPin, '8888'))) {
      setCurrentEmployee(loginSelectedUser);
      setIsAdmin(isBoss);
      setIsAuthenticated(true);
      setLoginSelectedUser(null);
      setLoginInputPin('');
      setLoginPinError('');
      setActiveTab('punch');
      playPunchSound('in');
    } else {
      setLoginPinError('PIN 碼錯誤！(預設員工: 0000 / 管理員: 8888)');
      playPunchSound('tap');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentEmployee(null);
    setIsAdmin(false);
    setLoginSelectedUser(null);
    setLoginInputPin('');
    setLoginPinError('');
    setActiveTab('punch');
    playPunchSound('tap');
  };

  // 打卡相關
  const handlePunchIn = async (siteName: string, notes: string, locationStr?: string) => {
    if (!currentEmployee) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newRecord: PunchRecord = {
      id: `rec-${todayStr}-${currentEmployee.id}`,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      date: todayStr,
      clockInTime: timeStr,
      clockOutTime: '',
      siteName: siteName || '',
      notes: notes || '',
      source: 'mobile_web',
      durationHours: 0,
      wageMultiplier: 1.0,
      calculatedWage: currentEmployee.dailyRate,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    setRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);
    await sendToGoogleSheet({ action: 'saveRecord', record: newRecord });
  };

  const handlePunchOut = async (notes?: string) => {
    if (!currentEmployee) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const todayRec = records.find((r) => r.employeeId === currentEmployee.id && r.date === todayStr);
    const inTime = todayRec?.clockInTime || timeStr;
    const stats = calculateWorkStats(inTime, timeStr, currentEmployee.dailyRate);

    const updatedRecord: PunchRecord = {
      ...(todayRec || {
        id: `rec-${todayStr}-${currentEmployee.id}`,
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        date: todayStr,
        clockInTime: inTime,
        siteName: '',
      }),
      clockOutTime: timeStr,
      durationHours: stats.durationHours,
      wageMultiplier: stats.wageMultiplier,
      calculatedWage: stats.calculatedWage,
      notes: notes ? (todayRec?.notes ? `${todayRec.notes} | ${notes}` : notes) : (todayRec?.notes || ''),
      updatedAt: now.toISOString(),
    };

    setRecords((prev) =>
      prev.map((r) => (r.employeeId === currentEmployee.id && r.date === todayStr ? updatedRecord : r))
    );

    await sendToGoogleSheet({ action: 'saveRecord', record: updatedRecord });
  };

  // 補登 / 修正出勤紀錄
  const handleSaveRecord = async (data: Partial<PunchRecord>) => {
    const recordId = data.id || `rec-${data.date || todayStr}-${data.employeeId}-${Date.now()}`;
    const cleanClockOut = data.clockOutTime ? formatRecordTime(data.clockOutTime) : '';

    const newRecord: PunchRecord = {
      id: recordId,
      employeeId: data.employeeId || '',
      employeeName: data.employeeName || '員工',
      date: formatRecordDate(data.date || todayStr),
      clockInTime: formatRecordTime(data.clockInTime || '08:00:00'),
      clockOutTime: cleanClockOut,
      siteName: data.siteName || '',
      wageMultiplier: data.wageMultiplier !== undefined ? Number(data.wageMultiplier) : 1.0,
      calculatedWage: Number(data.calculatedWage) || 0,
      durationHours: Number(data.durationHours) || 0,
      notes: data.notes || '',
      adminNote: data.adminNote || '管理員手動補登',
      modifiedByAdmin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    } as PunchRecord;

    setRecords((prev) => {
      const exists = prev.some((r) => r.id === recordId);
      if (exists) {
        return prev.map((r) => (r.id === recordId ? { ...r, ...newRecord } : r));
      }
      return [newRecord, ...prev];
    });

    await sendToGoogleSheet({ action: 'saveRecord', record: newRecord });
  };

  const handleDeleteRecord = async (recordId: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
    await sendToGoogleSheet({ action: 'deleteRecord', id: recordId });
  };

  // 薪資加給送出 (支援單一員工或全員共同加給)
  const handleSaveBonusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('⚠️ 僅管理人 (薄老闆) 具備新增加給費用之權限！');
      return;
    }
    const numAmount = Number(bonusAmount);
    if (!numAmount || numAmount <= 0) {
      alert('請填寫有效的加給金額！');
      return;
    }

    setIsSavingBonus(true);
    try {
      const targets = bonusEmpId === 'ALL'
        ? employees
        : employees.filter((e) => e.id === bonusEmpId);

      for (const target of targets) {
        const newBonus: BonusRecord = {
          id: `bon-${bonusDate}-${target.id}-${Date.now()}`,
          date: bonusDate,
          employeeId: target.id,
          employeeName: target.name,
          amount: numAmount,
          note: bonusNote.trim() || '管理員薪資加給',
          createdAt: new Date().toISOString(),
        };

        setBonuses((prev) => [newBonus, ...prev]);
        await sendToGoogleSheet({ action: 'saveBonus', bonus: newBonus });
      }

      playPunchSound('in');
      setIsBonusModalOpen(false);
      setBonusAmount('');
      setBonusNote('');
    } catch (err) {
      console.error('新增加給失敗:', err);
    } finally {
      setIsSavingBonus(false);
    }
  };

  const handleDeleteBonus = async (bonusId: string) => {
    if (!isAdmin) {
      alert('⚠️ 僅管理人具備刪除加給權限！');
      return;
    }
    if (window.confirm('確定要刪除這筆加給費用嗎？')) {
      setBonuses((prev) => prev.filter((b) => b.id !== bonusId));
      await sendToGoogleSheet({ action: 'deleteBonus', id: bonusId });
      playPunchSound('tap');
    }
  };

  const handleAddEmployee = async (empData: Partial<Employee>) => {
    await sendToGoogleSheet({ action: 'addEmployee', employee: empData });
  };

  const handleUpdateEmployee = async (id: string, empData: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...empData } : e)));
    if (currentEmployee?.id === id) {
      setCurrentEmployee((prev) => (prev ? { ...prev, ...empData } : null));
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    await sendToGoogleSheet({ action: 'deleteEmployee', id });
  };

  // 切換人員
  const handleConfirmSwitchWithPin = () => {
    if (!switchTargetUser) return;

    const isTargetAdmin = switchTargetUser.role === 'admin' || switchTargetUser.name === '吳昱勳';
    const expectedPin = sanitizePin(
      (switchTargetUser as any).pin,
      isTargetAdmin ? adminPin : '0000'
    );
    const cleanInput = sanitizePin(switchInputPin);

    if (isAdmin && !isTargetAdmin) {
      setCurrentEmployee(switchTargetUser);
      setIsAdmin(false);
      if (activeTab === 'admin') setActiveTab('punch');
      setIsUserSwitchOpen(false);
      setSwitchTargetUser(null);
      setSwitchInputPin('');
      playPunchSound('in');
      return;
    }

    if (cleanInput === expectedPin || (isTargetAdmin && cleanInput === sanitizePin(adminPin, '8888'))) {
      setCurrentEmployee(switchTargetUser);
      setIsAdmin(isTargetAdmin);
      if (!isTargetAdmin && activeTab === 'admin') {
        setActiveTab('punch');
      }
      setIsUserSwitchOpen(false);
      setSwitchTargetUser(null);
      setSwitchInputPin('');
      setSwitchPinError('');
      playPunchSound('in');
    } else {
      setSwitchPinError('PIN 碼錯誤！(預設員工: 0000 / 管理員: 8888)');
      playPunchSound('tap');
    }
  };

  const handleUnlockAdmin = () => {
    if (sanitizePin(adminUnlockPin) === sanitizePin(adminPin, '8888')) {
      setIsAdmin(true);
      setAdminUnlockPin('');
      setAdminUnlockError('');
      playPunchSound('in');
    } else {
      setAdminUnlockError('管理員 PIN 碼錯誤！');
      playPunchSound('tap');
    }
  };

  const toggleRevealPin = (empId: string) => {
    setRevealedPins((prev) => ({
      ...prev,
      [empId]: !prev[empId],
    }));
  };

  const handleAdminChangeTargetPinConfirm = async () => {
    if (!adminEditTarget) return;
    const finalPin = sanitizePin(adminTargetNewPin);
    if (finalPin.length < 4) {
      alert('PIN 碼長度至少需 4 位數！');
      return;
    }

    const isBoss = adminEditTarget.role === 'admin' || adminEditTarget.name === '吳昱勳';

    if (isBoss) {
      setAdminPin(finalPin);
      await sendToGoogleSheet({ action: 'updateAdminPin', newPin: finalPin });
    }

    setEmployees((prev) =>
      prev.map((e) => (e.id === adminEditTarget.id ? { ...e, pin: finalPin } as any : e))
    );

    await sendToGoogleSheet({ action: 'updatePin', employeeId: adminEditTarget.id, pin: finalPin });

    setAdminPinSuccess(true);
    setTimeout(() => {
      setAdminEditTarget(null);
      setAdminPinSuccess(false);
      setAdminTargetNewPin('');
    }, 1200);
  };

  const handleResetUserPin = async (empId: string) => {
    if (!isAdmin) {
      alert('需管理員權限才可重設密碼！');
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;

    const isBoss = emp.role === 'admin' || emp.name === '吳昱勳';
    const targetPin = isBoss ? '8888' : '0000';

    if (window.confirm(`確定要將【${emp.name}】的 PIN 碼重設為「${targetPin}」嗎？`)) {
      setEmployees((prev) =>
        prev.map((e) => (e.id === empId ? { ...e, pin: targetPin } as any : e))
      );

      if (isBoss) {
        setAdminPin(targetPin);
        await sendToGoogleSheet({ action: 'updateAdminPin', newPin: targetPin });
      }

      await sendToGoogleSheet({ action: 'updatePin', employeeId: empId, pin: targetPin });
      alert(`已成功將 ${emp.name} 的 PIN 碼重設為 ${targetPin}！`);
    }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee) return;

    const isBoss = currentEmployee.role === 'admin' || currentEmployee.name === '吳昱勳';
    const currentPin = sanitizePin(
      (currentEmployee as any).pin,
      isBoss ? adminPin : '0000'
    );
    const cleanOld = sanitizePin(oldPin);
    const cleanNew = sanitizePin(newPin);
    const cleanConfirm = sanitizePin(confirmNewPin);

    if (cleanOld !== currentPin && (!isAdmin || cleanOld !== sanitizePin(adminPin, '8888'))) {
      setChangePinError('舊密碼輸入不正確！');
      return;
    }

    if (cleanNew.length < 4) {
      setChangePinError('新密碼長度至少需 4 位數字！');
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setChangePinError('兩次輸入的新密碼不一致！');
      return;
    }

    if (isBoss) {
      setAdminPin(cleanNew);
      await sendToGoogleSheet({ action: 'updateAdminPin', newPin: cleanNew });
    }

    await sendToGoogleSheet({ action: 'updatePin', employeeId: currentEmployee.id, pin: cleanNew });

    setEmployees((prev) =>
      prev.map((e) => (e.id === currentEmployee.id ? { ...e, pin: cleanNew } as any : e))
    );

    setChangePinSuccess(true);
    setTimeout(() => {
      setIsChangePinOpen(false);
      setChangePinSuccess(false);
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
      setChangePinError('');
    }, 1200);
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDesc.trim()) {
      alert('請輸入問題說明！');
      return;
    }

    setIsSendingReport(true);
    try {
      await sendToGoogleSheet({
        action: 'reportIssue',
        employeeName: currentEmployee?.name || '未具名',
        phone: reportPhone || currentEmployee?.phone || '',
        category: reportCategory,
        description: reportDesc,
      });

      setReportSuccess(true);
      setTimeout(() => {
        setIsReportModalOpen(false);
        setReportSuccess(false);
        setReportDesc('');
      }, 2000);
    } catch (err) {
      console.error('送出問題失敗:', err);
    } finally {
      setIsSendingReport(false);
    }
  };

  const VirtualKeypad = ({
    onDigit,
    onDelete,
    onClear,
  }: {
    onDigit: (d: string) => void;
    onDelete: () => void;
    onClear: () => void;
  }) => (
    <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto select-none pt-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => { playPunchSound('tap'); onDigit(String(num)); }}
          className="h-12 rounded-2xl bg-white border border-[#E6E1D8] hover:border-[#6E5D4F] hover:bg-[#F6F3EE] active:bg-[#EAE4DC] active:scale-95 text-lg font-bold text-[#2B2521] transition-all flex items-center justify-center shadow-xs"
        >
          {num}
        </button>
      ))}
      <button
        type="button"
        onClick={() => { playPunchSound('tap'); onClear(); }}
        className="h-12 rounded-2xl bg-[#EFEBE4] border border-[#E6E1D8] hover:bg-[#E4DED5] active:scale-95 text-xs font-semibold text-[#706458] transition-all flex items-center justify-center shadow-xs"
      >
        清除
      </button>
      <button
        type="button"
        onClick={() => { playPunchSound('tap'); onDigit('0'); }}
        className="h-12 rounded-2xl bg-white border border-[#E6E1D8] hover:border-[#6E5D4F] hover:bg-[#F6F3EE] active:bg-[#EAE4DC] active:scale-95 text-lg font-bold text-[#2B2521] transition-all flex items-center justify-center shadow-xs"
      >
        0
      </button>
      <button
        type="button"
        onClick={() => { playPunchSound('tap'); onDelete(); }}
        className="h-12 rounded-2xl bg-[#EFEBE4] border border-[#E6E1D8] hover:bg-rose-50 text-[#706458] hover:text-rose-600 active:scale-95 transition-all flex items-center justify-center shadow-xs"
      >
        <Delete className="w-5 h-5" />
      </button>
    </div>
  );

  // 開場名片載入
  if (!isDataLoaded) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="w-full max-w-[280px] flex flex-col items-center space-y-5">
          <div className="w-full overflow-hidden rounded-2xl shadow-2xl bg-black">
            <img src={splashImg} alt="專業系統櫃安裝" className="w-full h-auto object-contain" />
          </div>
          <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden relative shadow-inner">
            <div
              className="h-full bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)]"
              style={{ width: '45%', animation: 'runningLine 1.4s infinite ease-in-out' }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70 tracking-widest font-light pt-1">
            <div className="w-3.5 h-3.5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
            <span>雲端資料同步中...</span>
          </div>
          <style>{`
            @keyframes runningLine {
              0% { transform: translateX(-120%); }
              50% { transform: translateX(80%); }
              100% { transform: translateX(250%); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // 門禁鎖定頁 (Taupe 灰駝風格)
  if (!isAuthenticated || !currentEmployee) {
    return (
      <div className="min-h-screen bg-[#F6F4F0] flex items-center justify-center p-4 antialiased text-[#2B2521]">
        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_20px_50px_rgba(43,37,33,0.08)] border border-[#E6E1D8]">
          <div className="px-5 py-4 bg-[#2B2521] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden bg-black border border-[#423932] flex items-center justify-center p-0.5">
                <img src={boboLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight text-white">薄薄工程行打卡系統</h3>
                <p className="text-[11px] text-[#C4B8AB]">請選取您的身分並輸入 PIN 碼進入</p>
              </div>
            </div>
            <Lock className="w-4 h-4 text-[#C4B8AB] shrink-0" />
          </div>

          <div className="p-5 space-y-4">
            {!loginSelectedUser ? (
              <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-0.5">
                <div className="text-xs font-bold text-[#8A7D70] uppercase tracking-wider px-1">請點選出勤姓名</div>
                
                {employees.filter((e) => e.role === 'admin' || e.name === '吳昱勳').map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => { setLoginSelectedUser(emp); setLoginInputPin(''); setLoginPinError(''); }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-[#D4C9BC] bg-[#EAE3DA] hover:bg-[#DFD6C9] text-left transition-all shadow-2xs"
                  >
                    <div>
                      <div className="font-bold text-[#2B2521] text-sm flex items-center gap-1.5">
                        <span>{emp.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-[#D4C9BC] text-[#4A3D32] rounded font-semibold">管理人</span>
                      </div>
                      <div className="text-[11px] text-[#6E5D4F] mt-0.5 font-medium">薄老闆 · 最高權限管理</div>
                    </div>
                    <Lock className="w-4 h-4 text-[#6E5D4F]" />
                  </button>
                ))}

                {employees.filter((e) => e.role !== 'admin' && e.name !== '吳昱勳').map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => { setLoginSelectedUser(emp); setLoginInputPin(''); setLoginPinError(''); }}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-[#E6E1D8] bg-[#FAF8F5] hover:bg-[#F3EFEA] text-left transition-all"
                  >
                    <div>
                      <div className="font-bold text-[#2B2521] text-sm">{emp.name}</div>
                      <div className="text-xs text-[#706458]">{emp.workType} · NT${emp.dailyRate}/天</div>
                    </div>
                    <Lock className="w-4 h-4 text-[#998D80]" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center py-1">
                  <div className="text-xs text-[#8A7D70]">出勤身分確認</div>
                  <div className="text-xl font-bold text-[#2B2521] mt-0.5">{loginSelectedUser.name}</div>
                  <div className="text-xs text-[#6E5D4F] mt-1 font-medium bg-[#EAE3DA] inline-block px-3 py-0.5 rounded-full border border-[#D4C9BC]">
                    {loginSelectedUser.role === 'admin' || loginSelectedUser.name === '吳昱勳'
                      ? '請輸入管理員 PIN 碼 (預設: 8888)'
                      : '請輸入員工打卡 PIN 碼 (預設: 0000)'}
                  </div>
                </div>

                <div className="flex justify-center items-center gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${
                        loginInputPin.length > idx
                          ? 'bg-[#6E5D4F] border-[#6E5D4F] scale-110 shadow-xs'
                          : 'bg-[#EFEBE4] border-[#D6CEC3]'
                      }`}
                    />
                  ))}
                </div>

                {loginPinError && (
                  <div className="text-xs text-rose-600 text-center font-semibold bg-rose-50 py-1.5 px-3 rounded-xl border border-rose-200">{loginPinError}</div>
                )}

                <VirtualKeypad
                  onDigit={(d) => {
                    if (loginInputPin.length < 6) {
                      setLoginInputPin((prev) => prev + d);
                      setLoginPinError('');
                    }
                  }}
                  onDelete={() => {
                    setLoginInputPin((prev) => prev.slice(0, -1));
                    setLoginPinError('');
                  }}
                  onClear={() => {
                    setLoginInputPin('');
                    setLoginPinError('');
                  }}
                />

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setLoginSelectedUser(null); setLoginInputPin(''); }}
                    className="flex-1 py-2.5 text-xs font-semibold text-[#706458] border border-[#E6E1D8] rounded-xl hover:bg-[#F6F3EE]"
                  >
                    返回選人
                  </button>
                  <button
                    type="button"
                    onClick={handleLoginSubmit}
                    className="flex-1 py-2.5 text-xs font-bold text-white bg-[#2B2521] hover:bg-[#1E1916] rounded-xl flex items-center justify-center gap-1 shadow-xs transition-all active:scale-95"
                  >
                    <Check className="w-4 h-4 text-[#D4C9BC]" />
                    <span>確認進入</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 主畫面
  return (
    <div className="min-h-screen bg-[#F6F4F0] flex flex-col antialiased text-[#2B2521] pb-20 sm:pb-8">
      <Header
        currentEmployee={currentEmployee}
        employees={employees}
        isAdmin={isAdmin}
        onOpenSwitchUser={() => {
          setSwitchTargetUser(null);
          setSwitchInputPin('');
          setSwitchPinError('');
          setIsUserSwitchOpen(true);
        }}
        onToggleAdmin={() => {
          setSwitchTargetUser(null);
          setSwitchInputPin('');
          setSwitchPinError('');
          setIsUserSwitchOpen(true);
        }}
      />
{/* 快捷操作條：手機自適應排版 */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-2.5">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setOldPin('');
                setNewPin('');
                setConfirmNewPin('');
                setActivePinField('old');
                setChangePinError('');
                setChangePinSuccess(false);
                setIsChangePinOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#E6E1D8] text-[#54473C] rounded-xl hover:bg-[#FAF8F5] transition-colors shadow-2xs text-[11px] font-medium shrink-0"
            >
              <KeyRound className="w-3 h-3 text-[#6E5D4F]" />
              <span>修改 PIN 碼</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-[#E6E1D8] text-[#706458] hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors shadow-2xs text-[11px] font-medium shrink-0"
              title="登出並退回身分鎖定頁"
            >
              <LogOut className="w-3 h-3 text-[#998D80]" />
              <span>登出鎖定</span>
            </button>
          </div>

          <button
            onClick={() => {
              setReportSuccess(false);
              setReportDesc('');
              setReportPhone(currentEmployee.phone || '');
              setIsReportModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#EAE3DA] border border-[#D4C9BC] text-[#4A3D32] rounded-xl hover:bg-[#DFD6C9] transition-colors shadow-2xs text-[11px] font-medium shrink-0 ml-auto"
          >
            <MessageSquareWarning className="w-3 h-3 text-[#6E5D4F]" />
            <span>回報問題給老闆</span>
          </button>
        </div>
      </div>
        {/* 電腦版分頁標籤列 */}
        <div className="hidden sm:flex items-center gap-1.5 p-1.5 bg-white/90 border border-[#E6E1D8] rounded-2xl mb-6 max-w-xl mx-auto shadow-xs">
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('punch'); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'punch' ? 'bg-[#2B2521] text-white shadow-xs' : 'text-[#706458] hover:text-[#2B2521] hover:bg-[#F6F4F0]'
            }`}
          >
            <Clock className={`w-4 h-4 ${activeTab === 'punch' ? 'text-[#D4C9BC]' : 'text-[#998D80]'}`} />
            <span>打卡鐘</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('calendar'); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'calendar' ? 'bg-[#2B2521] text-white shadow-xs' : 'text-[#706458] hover:text-[#2B2521] hover:bg-[#F6F4F0]'
            }`}
          >
            <Calendar className={`w-4 h-4 ${activeTab === 'calendar' ? 'text-[#D4C9BC]' : 'text-[#998D80]'}`} />
            <span>打卡日曆</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('sheet'); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'sheet' ? 'bg-[#2B2521] text-white shadow-xs' : 'text-[#706458] hover:text-[#2B2521] hover:bg-[#F6F4F0]'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 ${activeTab === 'sheet' ? 'text-[#D4C9BC]' : 'text-[#998D80]'}`} />
            <span>雲端表單</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('admin'); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'admin' ? 'bg-[#2B2521] text-white shadow-xs' : 'text-[#706458] hover:text-[#2B2521] hover:bg-[#F6F4F0]'
            }`}
          >
            <Shield className={`w-4 h-4 ${activeTab === 'admin' ? 'text-[#D4C9BC]' : 'text-[#998D80]'}`} />
            <span>管理後台</span>
            {!isAdmin && <Lock className="w-3 h-3 text-[#998D80] ml-0.5" />}
          </button>
        </div>

        {activeTab === 'punch' && (
          <PunchClock
            currentEmployee={currentEmployee}
            todayRecord={currentTodayRecord}
            records={records}
            bonuses={bonuses}
            onPunchIn={handlePunchIn}
            onPunchOut={handlePunchOut}
            isAdmin={isAdmin}
            onOpenSwitchUser={() => {
              setSwitchTargetUser(null);
              setSwitchInputPin('');
              setSwitchPinError('');
              setIsUserSwitchOpen(true);
            }}
            onEditRecord={(record) => {
              if (!isAdmin) {
                alert('⚠️ 權限提醒：現場員工僅能查看紀錄，無法修改。需由管理人 (吳昱勳) 執行修正。');
                return;
              }
              setEditingRecord(record);
              setManualDate(undefined);
              setManualEmployeeId(undefined);
              setIsEditModalOpen(true);
            }}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarView
            records={records}
            bonuses={bonuses}
            employees={employees}
            currentEmployee={currentEmployee}
            isAdmin={isAdmin}
            onEditRecord={(record) => {
              if (!isAdmin) {
                alert('⚠️ 權限提醒：現場員工僅能查看紀錄，需管理人審核修改。');
                return;
              }
              setEditingRecord(record);
              setIsEditModalOpen(true);
            }}
            onAddManualPunch={(dateStr, empId) => {
              if (!isAdmin) {
                alert('⚠️ 需管理人權限才可進行手動補登。');
                return;
              }
              setEditingRecord(null);
              setManualDate(dateStr);
              setManualEmployeeId(empId);
              setIsEditModalOpen(true);
            }}
          />
        )}

        {activeTab === 'sheet' && (
          <CloudSheetView
            records={records}
            bonuses={bonuses}
            employees={employees}
            isAdmin={isAdmin}
            onEditRecord={(record) => {
              if (!isAdmin) {
                alert('⚠️ 僅管理人具備編輯表單紀錄權限。');
                return;
              }
              setEditingRecord(record);
              setIsEditModalOpen(true);
            }}
          />
        )}

        {activeTab === 'admin' && (
          <div className="space-y-4">
            {!isAdmin ? (
              <div className="bg-white border border-[#E6E1D8] rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#EAE3DA] border border-[#D4C9BC] text-[#6E5D4F] flex items-center justify-center mx-auto">
                  <Lock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-[#2B2521]">管理員專區已鎖定</h3>
                  <p className="text-xs text-[#706458] mt-1">
                    當前身分【{currentEmployee.name}】非管理人，無法直接查看敏感考勤與密碼設定。
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="請輸入管理員 PIN 碼解鎖"
                    value={adminUnlockPin}
                    onChange={(e) => { setAdminUnlockPin(e.target.value); setAdminUnlockError(''); }}
                    className="w-full text-center text-lg tracking-widest font-mono border border-[#D6CEC3] bg-[#FAF8F5] text-[#2B2521] rounded-xl py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6E5D4F]"
                  />
                  {adminUnlockError && <div className="text-xs text-rose-600 font-semibold">{adminUnlockError}</div>}
                  <button
                    type="button"
                    onClick={handleUnlockAdmin}
                    className="w-full py-2.5 text-xs font-bold text-white bg-[#2B2521] hover:bg-[#1E1916] rounded-xl shadow-xs transition-all active:scale-98"
                  >
                    驗證解鎖管理後台
                  </button>
                </div>
              </div>
            ) : (
              <>
                <AdminPanel
                  isAdmin={isAdmin}
                  employees={employees}
                  records={records}
                  bonuses={bonuses}
                  onOpenSwitchUser={() => {
                    setSwitchTargetUser(null);
                    setSwitchInputPin('');
                    setSwitchPinError('');
                    setIsUserSwitchOpen(true);
                  }}
                  onAddManualPunch={(dateStr, empId) => {
                    setEditingRecord(null);
                    setManualDate(dateStr);
                    setManualEmployeeId(empId);
                    setIsEditModalOpen(true);
                  }}
                  onOpenAddBonus={() => {
                    setBonusEmpId('ALL');
                    setBonusDate(todayStr);
                    setBonusAmount('');
                    setBonusNote('');
                    setIsBonusModalOpen(true);
                  }}
                  onDeleteBonus={handleDeleteBonus}
                  onAddEmployee={handleAddEmployee}
                  onUpdateEmployee={handleUpdateEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  onEditRecord={(record) => {
                    setEditingRecord(record);
                    setIsEditModalOpen(true);
                  }}
                />

                {/* 僅管理員可見：全體人員 PIN 碼管理 */}
                <div className="bg-white rounded-2xl border border-[#E6E1D8] p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <KeyRound className="w-4 h-4 text-[#6E5D4F]" />
                    <h4 className="font-bold text-sm text-[#2B2521]">全體人員 PIN 碼管理 (安全隱藏模式)</h4>
                  </div>
                  <p className="text-xs text-[#706458] mb-4">
                    密碼已預設遮蔽防窺，點擊右側眼睛圖示即可暫時查看明碼。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {employees.map((emp) => {
                      const isEmpAdmin = emp.role === 'admin' || emp.name === '吳昱勳';
                      const displayPin = sanitizePin((emp as any).pin, isEmpAdmin ? adminPin : '0000');
                      const isRevealed = revealedPins[emp.id] || false;

                      return (
                        <div
                          key={emp.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                            isEmpAdmin
                              ? 'border-[#D4C9BC] bg-[#EAE3DA]/60 shadow-2xs'
                              : 'border-[#E6E1D8] bg-[#FAF8F5]'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-[#2B2521] flex items-center gap-1.5">
                              <span>{emp.name}</span>
                              {isEmpAdmin && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-[#D4C9BC] text-[#4A3D32] rounded font-semibold">
                                  管理人
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#706458] font-mono mt-0.5 flex items-center gap-1.5">
                              <span>PIN:</span>
                              <span className="font-bold text-[#2B2521] tracking-wider">
                                {isRevealed ? displayPin : '••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPin(emp.id)}
                                className="text-[#998D80] hover:text-[#2B2521] p-0.5 rounded transition-colors"
                                title={isRevealed ? '點擊隱藏密碼' : '點擊查看明碼'}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAdminEditTarget(emp);
                                setAdminTargetNewPin('');
                                setAdminPinSuccess(false);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-[#54473C] bg-white border border-[#E6E1D8] hover:bg-[#F6F3EE] rounded-lg transition-colors shadow-2xs"
                            >
                              改密碼
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetUserPin(emp.id)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-0.5 ${
                                isEmpAdmin
                                  ? 'text-[#4A3D32] bg-[#D4C9BC] hover:bg-[#C7BAAB]'
                                  : 'text-[#54473C] bg-[#EAE3DA] hover:bg-[#DFD6C9]'
                              }`}
                              title={isEmpAdmin ? '恢復為 8888' : '恢復為 0000'}
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>{isEmpAdmin ? '重設 8888' : '重設 0000'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* 手機底部導覽列 */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E6E1D8] pb-safe">
        <div className="grid grid-cols-4 h-16 items-center">
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('punch'); }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'punch' ? 'text-[#2B2521] font-bold' : 'text-[#998D80]'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] mt-1">打卡鐘</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('calendar'); }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'calendar' ? 'text-[#2B2521] font-bold' : 'text-[#998D80]'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] mt-1">打卡日曆</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('sheet'); }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'sheet' ? 'text-[#2B2521] font-bold' : 'text-[#998D80]'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[10px] mt-1">雲端表單</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('admin'); }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'admin' ? 'text-[#2B2521] font-bold' : 'text-[#998D80]'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] mt-1">管理後台</span>
          </button>
        </div>
      </nav>

      {/* 薪資加給新增彈窗 (Taupe 暖駝色) */}
      {isBonusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2521]/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-[#E6E1D8]">
            <div className="px-5 py-4 bg-[#2B2521] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#D4C9BC]" />
                <div>
                  <h3 className="font-bold text-base text-white">薪資加給登記</h3>
                  <p className="text-[11px] text-[#C4B8AB]">僅管理員可登記 · 自動累計至員工當月預估薪資</p>
                </div>
              </div>
              <button onClick={() => setIsBonusModalOpen(false)} className="text-[#C4B8AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBonusSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#54473C] mb-1">發放對象</label>
                <select
                  value={bonusEmpId}
                  onChange={(e) => setBonusEmpId(e.target.value)}
                  className="w-full text-xs sm:text-sm border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] font-bold text-[#2B2521]"
                >
                  <option value="ALL">🌟 全體員工共同加給 (全員同時發放)</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role === 'admin' ? '管理人' : emp.workType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#54473C] mb-1">加給生效日期</label>
                  <input
                    type="date"
                    required
                    value={bonusDate}
                    onChange={(e) => setBonusDate(e.target.value)}
                    className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473C] mb-1">加給金額 (NT$)</label>
                  <input
                    type="number"
                    required
                    step="50"
                    placeholder="例如: 1000"
                    value={bonusAmount}
                    onChange={(e) => setBonusAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 font-mono font-bold text-[#2B2521] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#54473C]">加給項目說明 / 事由</label>
                  <span className="text-[10px] text-[#998D80]">點擊快速代入：</span>
                </div>
                {/* 快速常用標籤 */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['遠程油資貼補', '現場誤餐津貼', '特定案場趕工獎金', '重物搬運補貼', '全勤獎勵'].map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => setBonusNote(tag)}
                      className="px-2 py-0.5 text-[10px] rounded-lg bg-[#FAF8F5] border border-[#E6E1D8] text-[#54473C] hover:bg-[#EAE3DA] hover:border-[#D4C9BC] transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="請填寫加給事由..."
                  value={bonusNote}
                  onChange={(e) => setBonusNote(e.target.value)}
                  className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] text-[#2B2521]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBonusModalOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-[#706458] border border-[#E6E1D8] rounded-xl hover:bg-[#FAF8F5]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSavingBonus}
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#6E5D4F] hover:bg-[#5C4D40] rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-[#D4C9BC]" />
                  <span>{isSavingBonus ? '同步存入雲端...' : '確認加給發放'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 系統內切換人員彈窗 */}
      {isUserSwitchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2521]/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#E6E1D8]">
            <div className="px-5 py-4 bg-[#2B2521] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">切換打卡人員</h3>
                <p className="text-xs text-[#C4B8AB]">請選取姓名並輸入專屬 PIN 碼</p>
              </div>
              <button onClick={() => setIsUserSwitchOpen(false)} className="text-[#C4B8AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!switchTargetUser ? (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  <div className="text-xs font-bold text-[#8A7D70] uppercase tracking-wider px-1">管理身分</div>
                  {employees.filter((e) => e.role === 'admin' || e.name === '吳昱勳').map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => { setSwitchTargetUser(emp); setSwitchInputPin(''); setSwitchPinError(''); }}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-[#D4C9BC] bg-[#EAE3DA] hover:bg-[#DFD6C9] text-left transition-colors"
                    >
                      <div className="font-bold text-[#2B2521] text-sm flex items-center gap-2">
                        <span>{emp.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#D4C9BC] text-[#4A3D32] rounded font-semibold">管理人</span>
                      </div>
                      <Lock className="w-4 h-4 text-[#6E5D4F]" />
                    </button>
                  ))}

                  <div className="text-xs font-bold text-[#8A7D70] uppercase tracking-wider px-1 pt-2">員工身分</div>
                  {employees.filter((e) => e.role !== 'admin' && e.name !== '吳昱勳').map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => { setSwitchTargetUser(emp); setSwitchInputPin(''); setSwitchPinError(''); }}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E6E1D8] hover:bg-[#F6F3EE] text-left transition-colors"
                    >
                      <div>
                        <div className="font-bold text-[#2B2521] text-sm">{emp.name}</div>
                        <div className="text-xs text-[#706458]">{emp.workType} · NT${emp.dailyRate}/天</div>
                      </div>
                      <Lock className="w-4 h-4 text-[#998D80]" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center py-1">
                    <div className="text-xs text-[#8A7D70]">正在切換至</div>
                    <div className="text-lg font-bold text-[#2B2521]">{switchTargetUser.name}</div>
                    <div className="text-xs text-[#6E5D4F] mt-0.5">
                      {switchTargetUser.role === 'admin' || switchTargetUser.name === '吳昱勳'
                        ? '管理員 PIN 碼 (預設: 8888)'
                        : '員工打卡 PIN 碼 (預設: 0000)'}
                    </div>
                  </div>

                  <div className="flex justify-center items-center gap-3 py-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-4 h-4 rounded-full border-2 transition-all ${
                          switchInputPin.length > idx
                            ? 'bg-[#6E5D4F] border-[#6E5D4F] scale-110 shadow-xs'
                            : 'bg-[#EFEBE4] border-[#D6CEC3]'
                        }`}
                      />
                    ))}
                  </div>

                  {switchPinError && <div className="text-xs text-rose-600 text-center font-semibold">{switchPinError}</div>}

                  <VirtualKeypad
                    onDigit={(d) => {
                      if (switchInputPin.length < 6) {
                        setSwitchInputPin((prev) => prev + d);
                        setSwitchPinError('');
                      }
                    }}
                    onDelete={() => {
                      setSwitchInputPin((prev) => prev.slice(0, -1));
                      setSwitchPinError('');
                    }}
                    onClear={() => {
                      setSwitchInputPin('');
                      setSwitchPinError('');
                    }}
                  />

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSwitchTargetUser(null)}
                      className="flex-1 py-2.5 text-xs font-semibold text-[#706458] border border-[#E6E1D8] rounded-xl hover:bg-[#F6F3EE]"
                    >
                      重新選擇
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSwitchWithPin}
                      className="flex-1 py-2.5 text-xs font-bold text-white bg-[#2B2521] hover:bg-[#1E1916] rounded-xl flex items-center justify-center gap-1 shadow-xs"
                    >
                      <Check className="w-4 h-4 text-[#D4C9BC]" />
                      <span>確認切換</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 管理員直接修改成員 PIN 碼彈窗 */}
      {adminEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2521]/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#E6E1D8]">
            <div className="px-5 py-4 bg-[#2B2521] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#D4C9BC]" />
                <h3 className="font-bold text-base">修改 PIN 碼：{adminEditTarget.name}</h3>
              </div>
              <button onClick={() => setAdminEditTarget(null)} className="text-[#C4B8AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-[#706458] text-center">請直接按下方數字鍵輸入 4 位數新 PIN 碼：</p>

              <div className="flex justify-center items-center gap-3 py-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      adminTargetNewPin.length > idx
                        ? 'bg-[#6E5D4F] border-[#6E5D4F] scale-110 shadow-xs'
                        : 'bg-[#EFEBE4] border-[#D6CEC3]'
                    }`}
                  />
                ))}
              </div>

              {adminPinSuccess && (
                <div className="text-xs text-emerald-600 text-center font-bold">
                  ✅ 已成功更新 {adminEditTarget.name} 的 PIN 碼！
                </div>
              )}

              <VirtualKeypad
                onDigit={(d) => {
                  if (adminTargetNewPin.length < 6) setAdminTargetNewPin((prev) => prev + d);
                }}
                onDelete={() => setAdminTargetNewPin((prev) => prev.slice(0, -1))}
                onClear={() => setAdminTargetNewPin('')}
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminEditTarget(null)}
                  className="flex-1 py-2.5 text-xs font-semibold text-[#706458] border border-[#E6E1D8] rounded-xl hover:bg-[#F6F3EE]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleAdminChangeTargetPinConfirm}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-[#2B2521] hover:bg-[#1E1916] rounded-xl flex items-center justify-center gap-1 shadow-xs"
                >
                  <Check className="w-4 h-4 text-[#D4C9BC]" />
                  <span>確認儲存</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 個人修改 PIN 碼彈窗 */}
      {isChangePinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2521]/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#E6E1D8]">
            <div className="px-5 py-4 bg-[#2B2521] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#D4C9BC]" />
                <h3 className="font-bold text-base">修改個人 PIN 碼</h3>
              </div>
              <button onClick={() => setIsChangePinOpen(false)} className="text-[#C4B8AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePinSubmit} className="p-5 space-y-3">
              <div className="text-xs text-[#54473C] bg-[#FAF8F5] p-2.5 rounded-xl border border-[#E6E1D8]">
                當前人員：<span className="font-bold text-[#2B2521]">{currentEmployee.name}</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => setActivePinField('old')}
                  className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    activePinField === 'old'
                      ? 'border-[#6E5D4F] bg-[#EAE3DA] text-[#4A3D32] ring-2 ring-[#D4C9BC]'
                      : 'border-[#E6E1D8] bg-[#FAF8F5] text-[#706458]'
                  }`}
                >
                  <div>舊密碼</div>
                  <div className="font-mono text-xs">{oldPin ? '••••' : '(輸入)'}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePinField('new')}
                  className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    activePinField === 'new'
                      ? 'border-[#6E5D4F] bg-[#EAE3DA] text-[#4A3D32] ring-2 ring-[#D4C9BC]'
                      : 'border-[#E6E1D8] bg-[#FAF8F5] text-[#706458]'
                  }`}
                >
                  <div>新密碼</div>
                  <div className="font-mono text-xs">{newPin ? '••••' : '(輸入)'}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePinField('confirm')}
                  className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    activePinField === 'confirm'
                      ? 'border-[#6E5D4F] bg-[#EAE3DA] text-[#4A3D32] ring-2 ring-[#D4C9BC]'
                      : 'border-[#E6E1D8] bg-[#FAF8F5] text-[#706458]'
                  }`}
                >
                  <div>再次確認</div>
                  <div className="font-mono text-xs">{confirmNewPin ? '••••' : '(輸入)'}</div>
                </button>
              </div>

              {changePinError && <div className="text-xs text-rose-600 font-semibold text-center">{changePinError}</div>}
              {changePinSuccess && <div className="text-xs text-emerald-600 font-semibold text-center">✅ 密碼修改成功！已儲存至雲端。</div>}

              <VirtualKeypad
                onDigit={(d) => {
                  setChangePinError('');
                  if (activePinField === 'old' && oldPin.length < 6) setOldPin((p) => p + d);
                  if (activePinField === 'new' && newPin.length < 6) setNewPin((p) => p + d);
                  if (activePinField === 'confirm' && confirmNewPin.length < 6) setConfirmNewPin((p) => p + d);
                }}
                onDelete={() => {
                  setChangePinError('');
                  if (activePinField === 'old') setOldPin((p) => p.slice(0, -1));
                  if (activePinField === 'new') setNewPin((p) => p.slice(0, -1));
                  if (activePinField === 'confirm') setConfirmNewPin((p) => p.slice(0, -1));
                }}
                onClear={() => {
                  setChangePinError('');
                  if (activePinField === 'old') setOldPin('');
                  if (activePinField === 'new') setNewPin('');
                  if (activePinField === 'confirm') setConfirmNewPin('');
                }}
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangePinOpen(false)}
                  className="flex-1 py-2 text-xs font-semibold text-[#706458] border border-[#E6E1D8] rounded-xl hover:bg-[#F6F3EE]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-[#6E5D4F] hover:bg-[#5C4D40] rounded-xl shadow-xs"
                >
                  確認修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 問題回報彈窗 */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2B2521]/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-[#E6E1D8]">
            <div className="px-5 py-4 bg-[#2B2521] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="w-5 h-5 text-[#D4C9BC]" />
                <div>
                  <h3 className="font-bold text-base">回報問題給老闆</h3>
                  <p className="text-[11px] text-[#C4B8AB]">訊息將即時寄達 pcci.made2026@gmail.com</p>
                </div>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="text-[#C4B8AB] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReport} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#54473C] mb-1">回報人員</label>
                  <input
                    type="text"
                    disabled
                    value={currentEmployee.name}
                    className="w-full text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-[#FAF8F5] font-bold text-[#2B2521]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#54473C] mb-1">聯絡電話</label>
                  <input
                    type="tel"
                    placeholder="請輸入手機電話"
                    value={reportPhone}
                    onChange={(e) => setReportPhone(e.target.value)}
                    className="w-full text-xs border border-[#D6CEC3] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6E5D4F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473C] mb-1">問題類別</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full text-xs border border-[#D6CEC3] rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#6E5D4F] font-semibold text-[#2B2521]"
                >
                  <option value="打卡時間有誤/忘記打卡">打卡時間有誤 / 忘記打卡申請補登</option>
                  <option value="請假與現場排班異動">請假 / 案場排班異動通知</option>
                  <option value="工時與日薪計算疑問">工時與日薪計算疑問</option>
                  <option value="手機GPS定位/設備問題">手機定位或打卡系統異常</option>
                  <option value="其他施工現場建議事項">其他施工現場建議事項</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#54473C] mb-1">問題詳細說明</label>
                <textarea
                  required
                  rows={4}
                  placeholder="請詳細描述遇到的狀況（例如：忘記打下班卡、今天在民權路工地提早收工等）..."
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  className="w-full text-xs border border-[#D6CEC3] rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#6E5D4F]"
                />
              </div>

              {reportSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold text-center">
                  ✅ 已成功寄出通知至負責人信箱！薄老闆將會收到郵件通知。
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-[#706458] border border-[#E6E1D8] rounded-xl hover:bg-[#F6F3EE]"
                >
                  關閉
                </button>
                <button
                  type="submit"
                  disabled={isSendingReport}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-[#6E5D4F] hover:bg-[#5C4D40] rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-[#D4C9BC]" />
                  <span>{isSendingReport ? '正在寄送信件...' : '送出問題回報'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 補登編輯彈窗 */}
      <EditRecordModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        record={editingRecord}
        employees={employees}
        onSaveRecord={handleSaveRecord}
        onDeleteRecord={handleDeleteRecord}
        initialDate={manualDate}
        initialEmployeeId={manualEmployeeId}
      />
    </div>
  );
}
