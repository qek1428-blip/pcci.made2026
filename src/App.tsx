import React, { useState, useEffect, useTransition } from 'react';
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

export default function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [adminPin, setAdminPin] = useState('8888');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'punch' | 'calendar' | 'sheet' | 'admin'>('punch');

  // Modals
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PunchRecord | null>(null);
  const [manualDate, setManualDate] = useState<string | undefined>();
  const [manualEmployeeId, setManualEmployeeId] = useState<string | undefined>();

  // Fetch initial state from Express backend
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const data: CompanyState = json.data;
          setEmployees(data.employees);
          setRecords(data.records);
          if (data.settings?.adminPin) {
            setAdminPin(data.settings.adminPin);
          }

          // Set default user if not selected
          if (!currentEmployee) {
            // Default to first worker or admin
            const firstWorker = data.employees.find((e) => e.role === 'worker') || data.employees[0];
            setCurrentEmployee(firstWorker);
            setIsAdmin(firstWorker.role === 'admin');
          }
        }
      }
    } catch (err) {
      console.warn('API fetch failed, checking localStorage cache', err);
      // Fallback local storage
      const cached = localStorage.getItem('bobo_state');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setEmployees(parsed.employees || []);
          setRecords(parsed.records || []);
        } catch {
          // ignore
        }
      }
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Save cache to localStorage
  useEffect(() => {
    if (employees.length > 0) {
      localStorage.setItem(
        'bobo_state',
        JSON.stringify({ employees, records, adminPin })
      );
    }
  }, [employees, records, adminPin]);

  // Today's date YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Current employee's today record
  const currentTodayRecord = records.find(
    (r) => r.employeeId === currentEmployee?.id && r.date === todayStr
  );

  // 1. Clock In Handler
  const handlePunchIn = async (siteName: string, notes: string, locationStr?: string) => {
    if (!currentEmployee) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const res = await fetch('/api/punch/in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: currentEmployee.id,
          date: todayStr,
          time: timeStr,
          siteName,
          notes,
          location: { address: locationStr || '現場打卡' },
          source: 'mobile_web',
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setRecords((prev) => [resData.record, ...prev.filter((r) => r.id !== resData.record.id)]);
      } else {
        alert(resData.error || '打卡失敗，請重試');
      }
    } catch (err) {
      console.error('Punch in error:', err);
      // Offline fallback
      const offlineRecord: PunchRecord = {
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setRecords((prev) => [offlineRecord, ...prev]);
    }
  };

  // 2. Clock Out Handler
  const handlePunchOut = async (notes?: string) => {
    if (!currentEmployee) return;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const res = await fetch('/api/punch/out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: currentEmployee.id,
          date: todayStr,
          time: timeStr,
          notes,
        }),
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setRecords((prev) =>
          prev.map((r) => (r.id === resData.record.id ? resData.record : r))
        );
      } else {
        alert(resData.error || '下班打卡失敗');
      }
    } catch (err) {
      console.error('Punch out error:', err);
      setRecords((prev) =>
        prev.map((r) => {
          if (r.employeeId === currentEmployee.id && r.date === todayStr) {
            return {
              ...r,
              clockOutTime: timeStr,
              durationHours: 8.5,
              wageMultiplier: 1.0,
              calculatedWage: currentEmployee.dailyRate,
              updatedAt: new Date().toISOString(),
            };
          }
          return r;
        })
      );
    }
  };

  // 3. Admin Save Record (Update existing or create manual)
  const handleSaveRecord = async (data: Partial<PunchRecord>) => {
    try {
      if (data.id) {
        // Update existing
        const res = await fetch(`/api/records/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          setRecords((prev) =>
            prev.map((r) => (r.id === data.id ? resData.record : r))
          );
        }
      } else {
        // Create manual
        const res = await fetch('/api/records/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const resData = await res.json();
        if (res.ok && resData.success) {
          setRecords((prev) => [resData.record, ...prev]);
        }
      }
    } catch (err) {
      console.error('Save record error:', err);
      // Local state fallback
      if (data.id) {
        setRecords((prev) =>
          prev.map((r) => (r.id === data.id ? ({ ...r, ...data } as PunchRecord) : r))
        );
      } else {
        const fakeId = `rec-manual-${Date.now()}`;
        setRecords((prev) => [{ ...data, id: fakeId } as PunchRecord, ...prev]);
      }
    }
  };

  // 4. Admin Delete Record
  const handleDeleteRecord = async (recordId: string) => {
    try {
      const res = await fetch(`/api/records/${recordId}`, { method: 'DELETE' });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== recordId));
      }
    } catch {
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    }
  };

  // 5. Admin Add Employee
  const handleAddEmployee = async (empData: Partial<Employee>) => {
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empData),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setEmployees((prev) => [...prev, resData.employee]);
      }
    } catch {
      // Local fallback
      const fakeId = `emp-${Date.now()}`;
      setEmployees((prev) => [
        ...prev,
        {
          id: fakeId,
          name: empData.name || '新員工',
          dailyRate: empData.dailyRate || 3000,
          role: empData.role || 'worker',
          workType: empData.workType || '泥水工程',
          phone: empData.phone || '',
          avatarColor: 'bg-indigo-600',
          active: true,
        },
      ]);
    }
  };

  // 6. Admin Update Employee
  const handleUpdateEmployee = async (id: string, empData: Partial<Employee>) => {
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(empData),
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setEmployees((prev) =>
          prev.map((e) => (e.id === id ? resData.employee : e))
        );
        if (currentEmployee?.id === id) {
          setCurrentEmployee(resData.employee);
        }
      }
    } catch {
      setEmployees((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...empData } : e))
      );
      if (currentEmployee?.id === id) {
        setCurrentEmployee((prev) => (prev ? { ...prev, ...empData } : null));
      }
    }
  };

  // 7. Admin Delete Employee
  const handleDeleteEmployee = async (id: string) => {
    try {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setEmployees((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert(resData.error || '刪除失敗');
      }
    } catch {
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    }
  };

  // Open Edit Modal for a specific record
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

  // Open Manual Add Modal for a specific date
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

  // Handle Switch User / Role
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
          <p className="text-xs text-slate-400">正在連接雲端考勤資料庫</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-900 pb-20 sm:pb-8">
      {/* Top Header */}
      <Header
        currentEmployee={currentEmployee}
        employees={employees}
        isAdmin={isAdmin}
        onOpenSwitchUser={() => setIsUserSwitchOpen(true)}
        onToggleAdmin={() => setIsUserSwitchOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Desktop Navigation Segmented Control */}
        <div className="hidden sm:flex items-center gap-1.5 p-1.5 bg-slate-200/80 rounded-2xl mb-6 max-w-xl mx-auto shadow-inner">
          <button
            onClick={() => {
              playPunchSound('tap');
              setActiveTab('punch');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'punch'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-orange-600" />
            <span>打卡鐘</span>
          </button>

          <button
            onClick={() => {
              playPunchSound('tap');
              setActiveTab('calendar');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'calendar'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>打卡日曆</span>
          </button>

          <button
            onClick={() => {
              playPunchSound('tap');
              setActiveTab('sheet');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'sheet'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>雲端表單</span>
          </button>

          <button
            onClick={() => {
              playPunchSound('tap');
              setActiveTab('admin');
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'admin'
                ? 'bg-white text-amber-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-600" />
            <span>管理後台</span>
          </button>
        </div>

        {/* Tab 1: Punch Clock */}
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

        {/* Tab 2: Monthly Calendar */}
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

        {/* Tab 3: Cloud Spreadsheet View */}
        {activeTab === 'sheet' && (
          <CloudSheetView
            records={records}
            employees={employees}
            isAdmin={isAdmin}
            onEditRecord={handleOpenEditRecord}
          />
        )}

        {/* Tab 4: Admin Panel */}
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

      {/* Mobile Fixed Bottom Tab Bar (iOS / Android thumb ergonomics) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
        <div className="grid grid-cols-4 h-16 items-center">
          <button
            onClick={() => {
              playPunchSound('tap');
              setActiveTab('punch');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'punch' ? 'text-orange-600' : 'text-slate-400'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">打卡鐘</span>
          </button>

          <button
            onClick={() => {
              playPunchSound('tap');
              setActiveTab('calendar');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'calendar' ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">打卡日曆</span>
          </button>

          <button
            onClick={() => {
              playPunchSound('tap');
              setActiveTab('sheet');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'sheet' ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">雲端表單</span>
          </button>

          <button
            onClick={() => {
              playPunchSound('tap');
              setActiveTab('admin');
            }}
            className={`flex flex-col items-center justify-center h-full transition-colors ${
              activeTab === 'admin' ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-1">管理後台</span>
          </button>
        </div>
      </nav>

      {/* User Switch Modal */}
      <UserSwitchModal
        isOpen={isUserSwitchOpen}
        onClose={() => setIsUserSwitchOpen(false)}
        employees={employees}
        currentEmployee={currentEmployee}
        isAdmin={isAdmin}
        onSelectUser={handleSelectUser}
        adminPin={adminPin}
      />

      {/* Edit / Manual Punch Record Modal */}
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
