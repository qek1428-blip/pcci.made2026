import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PunchClock } from './components/PunchClock';
import { CalendarView } from './components/CalendarView';
import { CloudSheetView } from './components/CloudSheetView';
import { AdminPanel } from './components/AdminPanel';
import { EditRecordModal, calculateWorkStats } from './components/EditRecordModal';
import { Employee, PunchRecord, CompanyState } from './types';
import { Clock, Calendar, FileSpreadsheet, Shield, KeyRound, MessageSquareWarning, X, Check, Lock, RefreshCw, Send, Delete, Crown } from 'lucide-react';
import { playPunchSound } from './utils/sound';

import splashImg from './assets/images/splash.jpg';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhrpQIs-ygEFPOhVM8tafjpjSccqGMcsZ2-41WuxvEL-N9jXWi7eJVTpkKqD1wYEBX/exec';

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
  const [adminPin, setAdminPin] = useState('8888');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'punch' | 'calendar' | 'sheet' | 'admin'>('punch');

  // 補登編輯彈窗
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PunchRecord | null>(null);
  const [manualDate, setManualDate] = useState<string | undefined>();
  const [manualEmployeeId, setManualEmployeeId] = useState<string | undefined>();

  // 身分切換與 PIN 碼驗證彈窗
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState(false);
  const [selectedTargetUser, setSelectedTargetUser] = useState<Employee | null>(null);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');

  // 修改個人密碼彈窗 (員工/個人)
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [activePinField, setActivePinField] = useState<'old' | 'new' | 'confirm'>('old');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState(false);

  // 管理員專屬修改密碼彈窗
  const [isAdminChangePinOpen, setIsAdminChangePinOpen] = useState(false);
  const [adminNewPin, setAdminNewPin] = useState('');
  const [adminPinSuccess, setAdminPinSuccess] = useState(false);

  // 問題回報彈窗
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState('打卡異常');
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
            return {
              ...emp,
              role: isBoss ? ('admin' as const) : ('worker' as const),
              active: true,
              pin: (emp as any).pin ? String((emp as any).pin).trim() : (isBoss ? '8888' : '0000'),
            } as any;
          });

          setEmployees(loadedEmployees);

          if (!currentEmployee) {
            const defaultUser = loadedEmployees[0];
            setCurrentEmployee(defaultUser);
            setIsAdmin(defaultUser.role === 'admin');
          } else {
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

        if (data.settings?.adminPin) {
          setAdminPin(String(data.settings.adminPin).trim());
        }
      }
    } catch (err) {
      console.error('Google 試算表連線失敗:', err);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const currentTodayRecord = records.find(
    (r) => r.employeeId === currentEmployee?.id && r.date === todayStr
  );

  // 上班打卡
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

  // 下班打卡
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

  // 補登 / 修正紀錄
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

  // 驗證 PIN 碼切換人員
  const handleConfirmSwitchWithPin = () => {
    if (!selectedTargetUser) return;

    if (isAdmin && selectedTargetUser.role !== 'admin') {
      setCurrentEmployee(selectedTargetUser);
      setIsUserSwitchOpen(false);
      setSelectedTargetUser(null);
      setInputPin('');
      return;
    }

    const expectedPin = (selectedTargetUser as any).pin || (selectedTargetUser.role === 'admin' ? adminPin : '0000');

    if (inputPin.trim() === expectedPin || inputPin.trim() === adminPin) {
      setCurrentEmployee(selectedTargetUser);
      setIsAdmin(selectedTargetUser.role === 'admin' || inputPin.trim() === adminPin);
      setIsUserSwitchOpen(false);
      setSelectedTargetUser(null);
      setInputPin('');
      setPinError('');
      playPunchSound('in');
    } else {
      setPinError('PIN 碼錯誤！(預設員工: 0000 / 管理員: 8888)');
      playPunchSound('tap');
    }
  };

  // 管理員專屬：修改管理員 (吳昱勳) PIN 碼
  const handleAdminChangePinConfirm = async () => {
    if (adminNewPin.length < 4) {
      alert('管理員 PIN 碼至少需 4 位數！');
      return;
    }
    const boss = employees.find((e) => e.role === 'admin' || e.name === '吳昱勳');
    setAdminPin(adminNewPin);
    if (boss) {
      setEmployees((prev) =>
        prev.map((e) => (e.id === boss.id ? { ...e, pin: adminNewPin } as any : e))
      );
      await sendToGoogleSheet({ action: 'updatePin', employeeId: boss.id, pin: adminNewPin });
    }
    await sendToGoogleSheet({ action: 'updateAdminPin', newPin: adminNewPin });

    setAdminPinSuccess(true);
    setTimeout(() => {
      setIsAdminChangePinOpen(false);
      setAdminPinSuccess(false);
      setAdminNewPin('');
    }, 1200);
  };

  // 管理員一鍵重設員工 PIN 碼為 0000
  const handleResetUserPin = async (empId: string) => {
    if (!isAdmin) {
      alert('需管理員權限才可重設密碼！');
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    if (window.confirm(`確定要將員工【${emp.name}】的 PIN 碼重設為「0000」嗎？`)) {
      setEmployees((prev) =>
        prev.map((e) => (e.id === empId ? { ...e, pin: '0000' } as any : e))
      );
      await sendToGoogleSheet({ action: 'updatePin', employeeId: empId, pin: '0000' });
      alert(`已成功將 ${emp.name} 的密碼重設為 0000！`);
    }
  };

  // 修改個人密碼送出
  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmployee) return;

    const currentPin = (currentEmployee as any).pin || (currentEmployee.role === 'admin' ? adminPin : '0000');

    if (oldPin.trim() !== currentPin && (!isAdmin || oldPin.trim() !== adminPin)) {
      setChangePinError('舊密碼輸入不正確！');
      return;
    }

    if (newPin.length < 4) {
      setChangePinError('新密碼長度至少需 4 位數字！');
      return;
    }

    if (newPin !== confirmNewPin) {
      setChangePinError('兩次輸入的新密碼不一致！');
      return;
    }

    if (currentEmployee.role === 'admin' || currentEmployee.name === '吳昱勳') {
      setAdminPin(newPin);
      await sendToGoogleSheet({ action: 'updateAdminPin', newPin });
      await sendToGoogleSheet({ action: 'updatePin', employeeId: currentEmployee.id, pin: newPin });
    } else {
      await sendToGoogleSheet({ action: 'updatePin', employeeId: currentEmployee.id, pin: newPin });
    }

    setEmployees((prev) =>
      prev.map((e) => (e.id === currentEmployee.id ? { ...e, pin: newPin } as any : e))
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

  // 送出問題回報信件至 pcci.made2026@gmail.com
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

  // 獨立可重用的螢幕虛擬數字鍵盤元件 (ATM / POS 樣式，點擊不跳手機鍵盤)
  const VirtualKeypad = ({
    onDigit,
    onDelete,
    onClear,
  }: {
    onDigit: (d: string) => void;
    onDelete: () => void;
    onClear: () => void;
  }) => (
    <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto select-none pt-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => { playPunchSound('tap'); onDigit(String(num)); }}
          className="h-12 rounded-2xl bg-slate-100 hover:bg-orange-50 active:bg-orange-200 active:scale-95 text-lg font-bold text-slate-800 transition-all flex items-center justify-center shadow-xs"
        >
          {num}
        </button>
      ))}
      <button
        type="button"
        onClick={() => { playPunchSound('tap'); onClear(); }}
        className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-xs font-semibold text-slate-600 transition-all flex items-center justify-center shadow-xs"
      >
        清除
      </button>
      <button
        type="button"
        onClick={() => { playPunchSound('tap'); onDigit('0'); }}
        className="h-12 rounded-2xl bg-slate-100 hover:bg-orange-50 active:bg-orange-200 active:scale-95 text-lg font-bold text-slate-800 transition-all flex items-center justify-center shadow-xs"
      >
        0
      </button>
      <button
        type="button"
        onClick={() => { playPunchSound('tap'); onDelete(); }}
        className="h-12 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 active:scale-95 transition-all flex items-center justify-center shadow-xs"
      >
        <Delete className="w-5 h-5" />
      </button>
    </div>
  );

  // 載入畫面
  if (!currentEmployee) {
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-900 pb-20 sm:pb-8">
      {/* 頂端標題導覽列 */}
      <Header
        currentEmployee={currentEmployee}
        employees={employees}
        isAdmin={isAdmin}
        onOpenSwitchUser={() => {
          setSelectedTargetUser(null);
          setInputPin('');
          setPinError('');
          setIsUserSwitchOpen(true);
        }}
        onToggleAdmin={() => {
          setSelectedTargetUser(null);
          setInputPin('');
          setPinError('');
          setIsUserSwitchOpen(true);
        }}
      />

      {/* 快捷操作條（修改個人密碼 / 回報問題） */}
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 pt-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors shadow-2xs font-medium"
          >
            <KeyRound className="w-3.5 h-3.5 text-orange-600" />
            <span>修改個人 PIN 碼</span>
          </button>
        </div>

        <button
          onClick={() => {
            setReportSuccess(false);
            setReportDesc('');
            setReportPhone(currentEmployee.phone || '');
            setIsReportModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-300 text-amber-900 rounded-xl hover:bg-amber-500/20 transition-colors shadow-2xs font-medium"
        >
          <MessageSquareWarning className="w-3.5 h-3.5 text-amber-700" />
          <span>回報問題給老闆</span>
        </button>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4">
        {/* 電腦版分頁標籤列 */}
        <div className="hidden sm:flex items-center gap-1.5 p-1.5 bg-slate-200/80 rounded-2xl mb-6 max-w-xl mx-auto shadow-inner">
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('punch'); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'punch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-orange-600" />
            <span>打卡鐘</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('calendar'); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>打卡日曆</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('sheet'); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'sheet' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>雲端表單</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('admin'); }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'admin' ? 'bg-white text-amber-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-600" />
            <span>管理後台</span>
          </button>
        </div>

        {activeTab === 'punch' && (
          <PunchClock
            currentEmployee={currentEmployee}
            todayRecord={currentTodayRecord}
            records={records}
            onPunchIn={handlePunchIn}
            onPunchOut={handlePunchOut}
            isAdmin={isAdmin}
            onOpenSwitchUser={() => {
              setSelectedTargetUser(null);
              setInputPin('');
              setPinError('');
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
            {/* 管理員專屬：管理員本人密碼修改卡片 */}
            {isAdmin && (
              <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent rounded-2xl border border-amber-300 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>管理員專屬 PIN 碼 (吳昱勳)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold">
                        目前 PIN: {adminPin}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      具備所有員工免密碼切換、紀錄修改、薪資補登與密碼重設的最高權限。
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminNewPin('');
                    setAdminPinSuccess(false);
                    setIsAdminChangePinOpen(true);
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>修改管理員密碼</span>
                </button>
              </div>
            )}

            <AdminPanel
              isAdmin={isAdmin}
              employees={employees}
              records={records}
              onOpenSwitchUser={() => {
                setSelectedTargetUser(null);
                setInputPin('');
                setPinError('');
                setIsUserSwitchOpen(true);
              }}
              onAddManualPunch={(dateStr, empId) => {
                setEditingRecord(null);
                setManualDate(dateStr);
                setManualEmployeeId(empId);
                setIsEditModalOpen(true);
              }}
              onAddEmployee={handleAddEmployee}
              onUpdateEmployee={handleUpdateEmployee}
              onDeleteEmployee={handleDeleteEmployee}
              onEditRecord={(record) => {
                setEditingRecord(record);
                setIsEditModalOpen(true);
              }}
            />

            {/* 管理員專屬：重設員工密碼控制區 */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <KeyRound className="w-4 h-4 text-orange-600" />
                  <h4 className="font-bold text-sm text-slate-900">員工密碼管理 (忘記 PIN 碼重設)</h4>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  若員工忘記打卡 PIN 碼，管理人可在此一鍵將該名員工的 PIN 碼恢復為預設值「0000」。
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {employees.filter((e) => e.role !== 'admin').map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                      <div>
                        <div className="text-xs font-bold text-slate-800">{emp.name}</div>
                        <div className="text-[10px] text-slate-500">目前 PIN: {(emp as any).pin || '0000'}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleResetUserPin(emp.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>重設 0000</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 手機底部導覽列 */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
        <div className="grid grid-cols-4 h-16 items-center">
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('punch'); }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'punch' ? 'text-orange-600' : 'text-slate-400'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">打卡鐘</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('calendar'); }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'calendar' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">打卡日曆</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('sheet'); }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'sheet' ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">雲端表單</span>
          </button>
          <button
            onClick={() => { playPunchSound('tap'); setActiveTab('admin'); }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'admin' ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">管理後台</span>
          </button>
        </div>
      </nav>

      {/* 1. 身分切換與 PIN 碼驗證彈窗 (含純觸控螢幕數字鍵盤) */}
      {isUserSwitchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">切換打卡人員</h3>
                <p className="text-xs text-slate-400">請選取姓名並輸入專屬 PIN 碼</p>
              </div>
              <button onClick={() => setIsUserSwitchOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!selectedTargetUser ? (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">管理身分</div>
                  {employees.filter((e) => e.role === 'admin').map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => { setSelectedTargetUser(emp); setInputPin(''); setPinError(''); }}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-left transition-colors"
                    >
                      <div className="font-bold text-amber-950 text-sm flex items-center gap-2">
                        <span>{emp.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-semibold">管理人</span>
                      </div>
                      <Lock className="w-4 h-4 text-amber-700" />
                    </button>
                  ))}

                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 pt-2">員工身分</div>
                  {employees.filter((e) => e.role !== 'admin').map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => { setSelectedTargetUser(emp); setInputPin(''); setPinError(''); }}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{emp.name}</div>
                        <div className="text-xs text-slate-500">{emp.workType} · NT${emp.dailyRate}/天</div>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center py-1">
                    <div className="text-xs text-slate-500">正在切換至</div>
                    <div className="text-lg font-bold text-slate-900">{selectedTargetUser.name}</div>
                    <div className="text-xs text-orange-600 mt-0.5">
                      {selectedTargetUser.role === 'admin' ? '管理員 PIN 碼 (預設: 8888)' : '員工打卡 PIN 碼 (預設: 0000)'}
                    </div>
                  </div>

                  {/* 密碼顯示圓點區 (完全不跳系統鍵盤) */}
                  <div className="flex justify-center items-center gap-3 py-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-4 h-4 rounded-full border-2 transition-all ${
                          inputPin.length > idx
                            ? 'bg-orange-600 border-orange-600 scale-110 shadow-xs'
                            : 'bg-slate-100 border-slate-300'
                        }`}
                      />
                    ))}
                  </div>

                  {pinError && <div className="text-xs text-rose-600 text-center font-semibold">{pinError}</div>}

                  {/* 螢幕虛擬數字鍵盤 */}
                  <VirtualKeypad
                    onDigit={(d) => {
                      if (inputPin.length < 6) {
                        setInputPin((prev) => prev + d);
                        setPinError('');
                      }
                    }}
                    onDelete={() => {
                      setInputPin((prev) => prev.slice(0, -1));
                      setPinError('');
                    }}
                    onClear={() => {
                      setInputPin('');
                      setPinError('');
                    }}
                  />

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTargetUser(null)}
                      className="flex-1 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
                    >
                      重新選擇
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSwitchWithPin}
                      className="flex-1 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl flex items-center justify-center gap-1 shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>確認切換</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. 管理員 (吳昱勳) 專屬修改密碼彈窗 (內建螢幕數字鍵盤) */}
      {isAdminChangePinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-5 py-4 bg-amber-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-base">修改管理員 (吳昱勳) PIN 碼</h3>
              </div>
              <button onClick={() => setIsAdminChangePinOpen(false)} className="text-amber-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500 text-center">請使用下方數字鍵輸入 4 位數新管理密碼：</p>

              {/* 圓點顯示 */}
              <div className="flex justify-center items-center gap-3 py-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      adminNewPin.length > idx
                        ? 'bg-amber-600 border-amber-600 scale-110 shadow-xs'
                        : 'bg-slate-100 border-slate-300'
                    }`}
                  />
                ))}
              </div>

              {adminPinSuccess && (
                <div className="text-xs text-emerald-600 text-center font-bold">✅ 管理員 PIN 碼已成功更新！</div>
              )}

              {/* 螢幕虛擬數字鍵盤 */}
              <VirtualKeypad
                onDigit={(d) => {
                  if (adminNewPin.length < 6) setAdminNewPin((prev) => prev + d);
                }}
                onDelete={() => setAdminNewPin((prev) => prev.slice(0, -1))}
                onClear={() => setAdminNewPin('')}
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdminChangePinOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleAdminChangePinConfirm}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center justify-center gap-1 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>確認儲存</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 修改個人密碼彈窗 (內建螢幕數字鍵盤) */}
      {isChangePinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-400" />
                <h3 className="font-bold text-base">修改個人 PIN 碼</h3>
              </div>
              <button onClick={() => setIsChangePinOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePinSubmit} className="p-5 space-y-3">
              <div className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-xl">
                當前人員：<span className="font-bold text-slate-900">{currentEmployee.name}</span>
              </div>

              {/* 欄位選擇切換（點選切換輸入對象，readOnly 絕不跳手機鍵盤） */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => setActivePinField('old')}
                  className={`p-2 rounded-xl border text-[11px] font-bold transition-all ${
                    activePinField === 'old'
                      ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-200'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
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
                      ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-200'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
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
                      ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-200'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  <div>再次確認</div>
                  <div className="font-mono text-xs">{confirmNewPin ? '••••' : '(輸入)'}</div>
                </button>
              </div>

              {changePinError && <div className="text-xs text-rose-600 font-semibold text-center">{changePinError}</div>}
              {changePinSuccess && <div className="text-xs text-emerald-600 font-semibold text-center">✅ 密碼修改成功！已儲存至雲端。</div>}

              {/* 螢幕虛擬數字鍵盤 */}
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
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs"
                >
                  確認修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. 問題回報彈窗（自動寄信給 pcci.made2026@gmail.com） */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base">回報問題給老闆</h3>
                  <p className="text-[11px] text-slate-400">訊息將即時寄達 pcci.made2026@gmail.com</p>
                </div>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendReport} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">回報人員</label>
                  <input
                    type="text"
                    disabled
                    value={currentEmployee.name}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">聯絡電話</label>
                  <input
                    type="tel"
                    placeholder="請輸入手機電話"
                    value={reportPhone}
                    onChange={(e) => setReportPhone(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">問題類別</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                >
                  <option value="打卡時間有誤/忘記打卡">打卡時間有誤 / 忘記打卡申請補登</option>
                  <option value="請假與現場排班異動">請假 / 案場排班異動通知</option>
                  <option value="工時與日薪計算疑問">工時與日薪計算疑問</option>
                  <option value="手機GPS定位/設備問題">手機定位或打卡系統異常</option>
                  <option value="其他施工現場建議事項">其他施工現場建議事項</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">問題詳細說明</label>
                <textarea
                  required
                  rows={4}
                  placeholder="請詳細描述遇到的狀況（例如：忘記打下班卡、今天在民權路工地提早收工等）..."
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  關閉
                </button>
                <button
                  type="submit"
                  disabled={isSendingReport}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingReport ? '正在寄送信件...' : '送出問題回報'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 補登編輯彈窗 */}
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
