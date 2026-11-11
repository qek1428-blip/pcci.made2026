import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PunchClock } from './components/PunchClock';
import { CalendarView } from './components/CalendarView';
import { CloudSheetView } from './components/CloudSheetView';
import { AdminPanel } from './components/AdminPanel';
import { UserSwitchModal } from './components/UserSwitchModal';
import { EditRecordModal, calculateWorkStats } from './components/EditRecordModal';
import { Employee, PunchRecord, CompanyState } from './types';
import { Clock, Calendar, FileSpreadsheet, Shield } from 'lucide-react';
import { playPunchSound } from './utils/sound';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhrpQIs-ygEFPOhVM8tafjpjSccqGMcsZ2-41WuxvEL-N9jXWi7eJVTpkKqD1wYEBX/exec';

// 格式化日期為 YYYY-MM-DD
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

// 格式化時間為 HH:mm:ss
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

  // 彈跳視窗狀態
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PunchRecord | null>(null);
  const [manualDate, setManualDate] = useState<string | undefined>();
  const [manualEmployeeId, setManualEmployeeId] = useState<string | undefined>();

  // 安全傳送資料至 Google 試算表
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
      console.error('傳送至 Google 試算表發生錯誤:', err);
    }
  };

  // 從 Google 試算表取得最新資料
  const fetchState = async () => {
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL);
      const json = await res.json();
      if (json.success && json.data) {
        const data: CompanyState = json.data;
        if (data.employees && data.employees.length > 0) {
          const sanitizedEmployees = data.employees.map((emp) => {
            const isBoss = emp.role === 'admin' || emp.name === '吳昱勳';
            return {
              ...emp,
              role: isBoss ? ('admin' as const) : ('worker' as const),
              active: true,
            };
          });

          setEmployees(sanitizedEmployees);

          if (!currentEmployee) {
            const defaultUser = sanitizedEmployees[0];
            setCurrentEmployee(defaultUser);
            setIsAdmin(defaultUser.role === 'admin');
          } else {
            const updated = sanitizedEmployees.find((e) => e.id === currentEmployee.id);
            if (updated) setCurrentEmployee(updated);
          }
        }

        if (data.records) {
          const sanitizedRecords: PunchRecord[] = data.records.map((r: any) => ({
            ...r,
            date: formatRecordDate(r.date),
            clockInTime: formatRecordTime(r.clockInTime),
            clockOutTime: r.clockOutTime ? formatRecordTime(r.clockOutTime) : '',
            durationHours: Number(r.durationHours) || 0,
            wageMultiplier: Number(r.wageMultiplier) || 1.0,
            calculatedWage: Number(r.calculatedWage) || 0,
          }));
          setRecords(sanitizedRecords);
        }

        if (data.settings?.adminPin) {
          setAdminPin(data.settings.adminPin);
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

  // 1. 上班打卡
  const handlePunchIn = async (siteName: string, notes: string, locationStr?: string) => {
    if (!currentEmployee) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const tempRecord: PunchRecord = {
      id: `rec-${todayStr}-${currentEmployee.id}`,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      date: todayStr,
      clockInTime: timeStr,
      clockOutTime: '',
      siteName,
      notes,
      source: 'mobile_web',
      durationHours: 0,
      wageMultiplier: 1.0,
      calculatedWage: currentEmployee.dailyRate,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    setRecords((prev) => [tempRecord, ...prev.filter((r) => r.id !== tempRecord.id)]);

    await sendToGoogleSheet({
      action: 'punchIn',
      employeeId: currentEmployee.id,
      date: todayStr,
      time: timeStr,
      siteName,
      notes,
      locationStr,
    });
  };

  // 2. 下班打卡（動態計算工時與工數，不再寫死 8.5 小時）
  const handlePunchOut = async (notes?: string) => {
    if (!currentEmployee) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const todayRec = records.find((r) => r.employeeId === currentEmployee.id && r.date === todayStr);
    const inTime = todayRec?.clockInTime || timeStr;

    // 計算精準工時與工數
    const stats = calculateWorkStats(inTime, timeStr, currentEmployee.dailyRate);

    setRecords((prev) =>
      prev.map((r) => {
        if (r.employeeId === currentEmployee.id && r.date === todayStr) {
          return {
            ...r,
            clockOutTime: timeStr,
            durationHours: stats.durationHours,
            wageMultiplier: stats.wageMultiplier,
            calculatedWage: stats.calculatedWage,
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    await sendToGoogleSheet({
      action: 'punchOut',
      employeeId: currentEmployee.id,
      date: todayStr,
      time: timeStr,
      notes,
    });
  };

  // 3. 管理員儲存/補登紀錄
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

  // 4. 管理員刪除紀錄
  const handleDeleteRecord = async (recordId: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
    await sendToGoogleSheet({ action: 'deleteRecord', id: recordId });
  };

  // 5. 新增員工
  const handleAddEmployee = async (empData: Partial<Employee>) => {
    await sendToGoogleSheet({ action: 'addEmployee', employee: empData });
  };

  // 6. 更新員工資料
  const handleUpdateEmployee = async (id: string, empData: Partial<Employee>) => {
    setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...empData } : e)));
    if (currentEmployee?.id === id) {
      setCurrentEmployee((prev) => (prev ? { ...prev, ...empData } : null));
    }
  };

  // 7. 刪除員工
  const handleDeleteEmployee = async (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    await sendToGoogleSheet({ action: 'deleteEmployee', id });
  };

  const handleOpenEditRecord = (record: PunchRecord) => {
    if (!isAdmin) {
      alert('⚠️ 權限提醒：現場員工僅能查看紀錄，無法修改。需由管理人 (吳昱勳) 執行修正。');
      return;
    }
    setEditingRecord(record);
    setManualDate(undefined);
    setManualEmployeeId(undefined);
    setIsEditModalOpen(true);
  };

  const handleOpenManualPunch = (dateStr: string, empId?: string) => {
    if (!isAdmin) {
      alert('⚠️ 需管理人權限才可進行手動補登。');
      return;
    }
    setEditingRecord(null);
    setManualDate(dateStr);
    setManualEmployeeId(empId);
    setIsEditModalOpen(true);
  };

  const handleSelectUser = (emp: Employee, isUnlockedAdmin: boolean) => {
    setCurrentEmployee(emp);
    setIsAdmin(isUnlockedAdmin || emp.role === 'admin');
  };

  if (!currentEmployee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold">薄薄工程行打卡系統載入中...</h2>
          <p className="text-xs text-slate-400">正在連接 Google 雲端考勤資料庫</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-900 pb-20 sm:pb-8">
      <Header
        currentEmployee={currentEmployee}
        employees={employees}
        isAdmin={isAdmin}
        onOpenSwitchUser={() => setIsUserSwitchOpen(true)}
        onToggleAdmin={() => setIsUserSwitchOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
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
            onOpenSwitchUser={() => setIsUserSwitchOpen(true)}
            onEditRecord={handleOpenEditRecord}
          />
        )}
        {activeTab === 'calendar' && (
          <CalendarView
            records={records}
            employees={employees}
            currentEmployee={currentEmployee}
            isAdmin={isAdmin}
            onEditRecord={handleOpenEditRecord}
            onAddManualPunch={handleOpenManualPunch}
          />
        )}
        {activeTab === 'sheet' && (
          <CloudSheetView
            records={records}
            employees={employees}
            isAdmin={isAdmin}
            onEditRecord={handleOpenEditRecord}
          />
        )}
        {activeTab === 'admin' && (
          <AdminPanel
            isAdmin={isAdmin}
            employees={employees}
            records={records}
            onOpenSwitchUser={() => setIsUserSwitchOpen(true)}
            onAddManualPunch={handleOpenManualPunch}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onEditRecord={handleOpenEditRecord}
          />
        )}
      </main>

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

      <UserSwitchModal
        isOpen={isUserSwitchOpen}
        onClose={() => setIsUserSwitchOpen(false)}
        employees={employees}
        currentEmployee={currentEmployee}
        isAdmin={isAdmin}
        onSelectUser={handleSelectUser}
        adminPin={adminPin}
      />
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
