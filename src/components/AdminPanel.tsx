import React, { useState } from 'react';
import { Employee, PunchRecord } from '../types';
import {
  Shield,
  UserPlus,
  Lock,
  PlusCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Phone,
  Briefcase,
  DollarSign,
  User,
  X,
  Check,
} from 'lucide-react';
import { playPunchSound } from '../utils/sound';

interface AdminPanelProps {
  isAdmin: boolean;
  employees: Employee[];
  records: PunchRecord[];
  onOpenSwitchUser: () => void;
  onAddManualPunch: (dateStr: string, employeeId?: string) => void;
  onAddEmployee: (empData: Partial<Employee>) => Promise<void>;
  onUpdateEmployee: (id: string, empData: Partial<Employee>) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onEditRecord: (record: PunchRecord) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isAdmin,
  employees,
  records,
  onOpenSwitchUser,
  onAddManualPunch,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onEditRecord,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'employees'>('status');

  // Expanded accordion item id (null if all closed)
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Add Employee Modal state
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpRate, setNewEmpRate] = useState('3000');
  const [newEmpType, setNewEmpType] = useState('泥作師傅');
  const [newEmpRole, setNewEmpRole] = useState<'worker' | 'admin'>('worker');

  // Edit Employee Modal state
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRate, setEditRate] = useState('3000');
  const [editType, setEditType] = useState('泥作師傅');
  const [editRole, setEditRole] = useState<'worker' | 'admin'>('worker');

  // Today's date YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.date === todayStr);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center max-w-lg mx-auto space-y-4 my-8">
        <div className="w-16 h-16 rounded-full bg-taupe-100 text-taupe-700 mx-auto flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">
          管理員專屬權限
        </h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          薄薄工程行考勤系統已設定權限保護：現場員工僅能打卡與查看每月紀錄，<strong>無法自行修改上下班時間</strong>。如需補登、調整工數或管理人員名冊，請由管理人 (薄老闆) 解鎖。
        </p>
        <button
          onClick={onOpenSwitchUser}
          className="px-6 py-3 bg-taupe-600 hover:bg-taupe-700 text-white font-bold rounded-xl text-sm shadow-sm transition-all inline-flex items-center gap-2"
        >
          <Shield className="w-4 h-4" />
          <span>輸入管理員密碼解鎖</span>
        </button>
      </div>
    );
  }

  // Toggle accordion item
  const handleToggleExpand = (empId: string) => {
    playPunchSound('tap');
    setExpandedEmpId((prev) => (prev === empId ? null : empId));
  };

  // Open Edit Modal prefilled
  const handleOpenEdit = (emp: Employee) => {
    playPunchSound('tap');
    setEditingEmp(emp);
    setEditName(emp.name);
    setEditPhone(emp.phone);
    setEditRate(String(emp.dailyRate));
    setEditType(emp.workType);
    setEditRole(emp.role);
  };

  // Submit Edit Employee
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp || !editName.trim()) return;

    await onUpdateEmployee(editingEmp.id, {
      name: editName.trim(),
      phone: editPhone.trim(),
      dailyRate: Number(editRate) || 3000,
      workType: editType.trim(),
      role: editRole,
    });

    playPunchSound('in');
    setEditingEmp(null);
  };

  // Delete Employee
  const handleDelete = async (emp: Employee) => {
    if (emp.role === 'admin') {
      alert('無法刪除最高管理員 (薄老闆)');
      return;
    }
    if (window.confirm(`確定要將員工「${emp.name}」自薄薄工程行名冊中刪除嗎？`)) {
      playPunchSound('tap');
      await onDeleteEmployee(emp.id);
      if (expandedEmpId === emp.id) {
        setExpandedEmpId(null);
      }
    }
  };

  // Submit Add Employee
  const handleSaveNewEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;

    await onAddEmployee({
      name: newEmpName.trim(),
      phone: newEmpPhone.trim(),
      dailyRate: Number(newEmpRate) || 3000,
      workType: newEmpType.trim(),
      role: newEmpRole,
      active: true,
    });

    setNewEmpName('');
    setNewEmpPhone('');
    setNewEmpRate('3000');
    setNewEmpRole('worker');
    setShowAddEmpModal(false);
    playPunchSound('in');
  };

  // Dynamic admin name from employee roster
  const adminEmp = employees.find((e) => e.role === 'admin');
  const adminName = adminEmp ? adminEmp.name : '管理人';

  return (
    <div className="space-y-6">
      {/* Admin Header Banner */}
      <div className="bg-gradient-to-r from-taupe-600 to-taupe-600 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-taupe-200" />
          <h2 className="text-base sm:text-lg font-bold">管理人後台</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddManualPunch(todayStr)}
            className="px-3.5 py-2 rounded-xl bg-white text-taupe-900 font-bold text-xs hover:bg-taupe-50 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-taupe-700" />
            <span>補登打卡紀錄</span>
          </button>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => {
            playPunchSound('tap');
            setActiveTab('status');
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'status'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          打卡狀態
        </button>

        <button
          onClick={() => {
            playPunchSound('tap');
            setActiveTab('employees');
          }}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === 'employees'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          員工名冊
        </button>
      </div>

      {/* Tab 1: Real-Time Worker Status Live Board */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees
              .filter((e) => e.role === 'worker')
              .map((emp) => {
                const todayRec = todayRecords.find((r) => r.employeeId === emp.id);
                const isWorking = todayRec && !todayRec.clockOutTime;
                const isFinished = todayRec && Boolean(todayRec.clockOutTime);

                return (
                  <div
                    key={emp.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isWorking
                        ? 'border-taupe-300 bg-taupe-50/40 shadow-xs'
                        : isFinished
                        ? 'border-lime-１00 bg-white shadow-xs'
                        : 'border-slate-200 bg-slate-50/60 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {emp.name}
                        </div>
                        <div className="text-xs text-slate-500">{emp.workType}</div>
                      </div>

                      {isWorking ? (
                        <span className="text-[11px] font-bold text-taupe-700 bg-taupe-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-taupe-500 animate-ping" />
                          現場施工中
                        </span>
                      ) : isFinished ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-lime-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          已完成下班
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                          今日未打卡
                        </span>
                      )}
                    </div>

                    {todayRec ? (
                      <div className="text-xs space-y-1.5 bg-white/80 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex justify-between">
                          <span className="text-slate-500">上班打卡:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {todayRec.clockInTime}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">下班打卡:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {todayRec.clockOutTime || '尚未下班'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">施工案場:</span>
                          <span className="font-medium text-slate-700 truncate max-w-[140px]">
                            {todayRec.siteName}
                          </span>
                        </div>
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => onEditRecord(todayRec)}
                            className="text-taupe-600 font-bold text-xs hover:underline"
                          >
                            修改今日紀錄 ➔
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 py-2 flex items-center justify-between">
                        <span>今日尚無打卡紀錄</span>
                        <button
                          onClick={() => onAddManualPunch(todayStr, emp.id)}
                          className="text-xs font-bold text-taupe-600 hover:underline"
                        >
                          + 幫他補登打卡
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab 2: Employee Management (Mobile-Optimized Dropdown / Accordion List) */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          {/* Header & Add Button */}
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">人員名冊管理</h3>
              <p className="text-xs text-slate-500">
                點選可展開查看明細與編輯
              </p>
            </div>
            <button
              onClick={() => {
                playPunchSound('tap');
                setShowAddEmpModal(true);
              }}
              className="px-3.5 py-2 bg-taupe-600 hover:bg-taupe-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>新增員工</span>
            </button>
          </div>

          {/* Collapsible Dropdown List (No thumbnails, Name & Daily Rate on top) */}
          <div className="space-y-2">
            {employees.map((emp) => {
              const isExpanded = expandedEmpId === emp.id;

              return (
                <div
                  key={emp.id}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    isExpanded
                      ? 'border-taupe-400 bg-taupe-50/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Top Level Bar: Name on Left, Daily Rate on Right, Expand Chevron */}
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(emp.id)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors"
                  >
                    {/* Left: Name */}
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">
                        {emp.name}
                      </span>
                      {emp.role === 'admin' && (
                        <span className="text-[11px] font-bold text-taupe-700 bg-taupe-100 px-2 py-0.5 rounded">
                          管理人
                        </span>
                      )}
                    </div>

                    {/* Right: Daily Rate & Chevron (No thumbnails) */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-700 text-sm sm:text-base tabular-nums">
                        NT$ {emp.dailyRate.toLocaleString()}
                        <span className="text-xs text-slate-500 font-normal"> / 天</span>
                      </span>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-taupe-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 bg-slate-50/60">
                      <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-400 block mb-0.5">工種專長</span>
                          <span className="font-semibold text-slate-800">
                            {emp.workType || '一般工務'}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-400 block mb-0.5">連絡電話</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {emp.phone || '未填寫'}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-400 block mb-0.5">系統權限</span>
                          <span className="font-semibold text-slate-800">
                            {emp.role === 'admin' ? '管理人 (具修改與匯出權限)' : '現場員工 (僅打卡與查看)'}
                          </span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                          <span className="text-slate-400 block mb-0.5">日薪核算標準</span>
                          <span className="font-mono font-bold text-emerald-700">
                            NT$ {emp.dailyRate.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Management Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2">
                        {emp.role !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(emp)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>刪除此人員</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-taupe-400" />
                          <span>修改人員資料</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  修改人員資料 ({editingEmp.name})
                </h3>
                <p className="text-xs text-slate-500">
                  可隨時修改姓名、工種、電話與每日工資
                </p>
              </div>
              <button
                onClick={() => setEditingEmp(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  員工姓名
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  連絡電話
                </label>
                <input
                  type="text"
                  placeholder="0912-345-678"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    工種 / 專長
                  </label>
                  <input
                    type="text"
                    required
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    placeholder="如：泥作師傅、水電"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    日薪標準 (NT$)
                  </label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={editRate}
                    onChange={(e) => setEditRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500 font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  系統身分權限
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500"
                >
                  <option value="worker">現場員工 (僅打卡與查看)</option>
                  <option value="admin">工程行管理人 (全權修改與管理)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 text-xs font-bold text-white bg-taupe-600 rounded-xl hover:bg-taupe-700 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>儲存變更</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">新增員工 / 師傅</h3>
                <p className="text-xs text-slate-500">
                  由管理人建立新進同仁名冊與日薪標準
                </p>
              </div>
              <button
                onClick={() => setShowAddEmpModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewEmployee} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  員工姓名
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：王小明"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  連絡電話
                </label>
                <input
                  type="text"
                  placeholder="例如：0912-345-678"
                  value={newEmpPhone}
                  onChange={(e) => setNewEmpPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    工種 / 專長
                  </label>
                  <select
                    value={newEmpType}
                    onChange={(e) => setNewEmpType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500"
                  >
                    <option value="泥作師傅">泥作師傅</option>
                    <option value="水電師傅">水電師傅</option>
                    <option value="鐵工師傅">鐵工師傅</option>
                    <option value="油漆師傅">油漆師傅</option>
                    <option value="木工師傅">木工師傅</option>
                    <option value="粗工/雜工">粗工/雜工</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    日薪標準 (NT$)
                  </label>
                  <input
                    type="number"
                    step="100"
                    required
                    value={newEmpRate}
                    onChange={(e) => setNewEmpRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500 font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  權限設定
                </label>
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-taupe-500"
                >
                  <option value="worker">現場員工 (僅打卡與查看)</option>
                  <option value="admin">工程行管理人 (全權修改與管理)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 text-xs font-bold text-white bg-taupe-600 rounded-xl hover:bg-taupe-700 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>確認新增</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
