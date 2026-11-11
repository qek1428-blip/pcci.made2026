import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PunchClock } from './components/PunchClock';
import { CalendarView } from './components/CalendarView';
import { CloudSheetView } from './components/CloudSheetView';
import { AdminPanel } from './components/AdminPanel';
import { UserSwitchModal } from './components/UserSwitchModal';
import { EditRecordModal } from './components/EditRecordModal';
import { Employee, PunchRecord, CompanyState } from './types';
import { Clock, Calendar, FileSpreadsheet, Shield } from 'lucide-react';
import { playPunchSound } from './utils/sound';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhrpQIs-ygEFPOhVM8tafjpjSccqGMcsZ2-41WuxvEL-N9jXWi7eJVTpkKqD1wYEBX/exec';

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

  // 從 Google 試算表取得最新資料
  const fetchState = async () => {
    try {
      const res = await fetch(GOOGLE_SCRIPT_URL);
      const json = await res.json();
      if (json.success && json.data) {
        const data: CompanyState = json.data;
        setEmployees(data.employees);
        setRecords(data.records);
        if (data.settings?.adminPin) {
          setAdminPin(data.settings.adminPin);
        }
        if (!currentEmployee && data.employees.length > 0) {
          const firstWorker = data.employees.find((e) => e.role === 'worker') || data.employees[0];
          setCurrentEmployee(firstWorker);
          setIsAdmin(firstWorker.role === 'admin');
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
      siteName,
      notes,
      source: 'mobile_web',
      wageMultiplier: 1.0,
      calculatedWage: currentEmployee.dailyRate,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    setRecords((prev) => [tempRecord, ...prev.filter((r) => r.id !== tempRecord.id)]);

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'punchIn',
          employeeId: currentEmployee.id,
          date: todayStr,
          time: timeStr,
          siteName,
          notes,
          locationStr,
        }),
      });
      fetchState();
    } catch (err) {
      console.error('同步至 Google 試算表失敗', err);
    }
  };

  // 2. 下班打卡
  const handlePunchOut = async (notes?: string) => {
    if (!currentEmployee) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setRecords((prev) =>
      prev.map((r) => {
        if (r.employeeId === currentEmployee.id && r.date === todayStr) {
          return {
            ...r,
            clockOutTime: timeStr,
            durationHours: 8.5,
            updatedAt: now.toISOString(),
          };
        }
        return r;
      })
    );

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'punchOut',
          employeeId: currentEmployee.id,
          date: todayStr,
          time: timeStr,
          notes,
        }),
      });
      fetchState();
    } catch (err) {
      console.error('下班同步失敗', err);
    }
  };

  // 3. 管理員儲存/補登紀錄
  const handleSaveRecord = async (data: Partial<PunchRecord>) => {
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'saveRecord', record: data }),
      });
      fetchState();
    } catch (err) {
      console.error('儲存紀錄失敗', err);
    }
  };

  // 4. 管理員刪除紀錄
  const handleDeleteRecord = async (recordId: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== recordId));
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteRecord', id: recordId }),
      });
    } catch (err) {
      console.error('刪除失敗', err);
    }
  };

  // 5. 新增員工
  const handleAddEmployee = async (empData: Partial<Employee>) => {
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'addEmployee', employee: empData }),
      });
      fetchState();
    } catch (err) {
      console.error('新增員工失敗', err);
    }
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
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteEmployee', id }),
      });
    } catch (err) {
      console.error('刪除員工失敗', err);
    }
  };

  const handleOpenEditRecord = (record: PunchRecord) => {
    if (!isAdmin) {
      alert('⚠️ 權限提醒：現場員工僅能查看紀錄，無法修改。需由管理人 (薄老闆) 執行修正。');
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
            onAddManualPunch={handleOpen
