import React, { useState } from 'react';
import { Employee, PunchRecord, BonusRecord } from '../types';
import { Shield, Plus, Coins, Trash2, Calendar, User, Search, DollarSign } from 'lucide-react';

interface AdminPanelProps {
  isAdmin: boolean;
  employees: Employee[];
  records: PunchRecord[];
  bonuses?: BonusRecord[];
  onOpenSwitchUser: () => void;
  onAddManualPunch: (dateStr: string, empId?: string) => void;
  onOpenAddBonus?: () => void;
  onDeleteBonus?: (id: string) => void;
  onAddEmployee: (emp: Partial<Employee>) => Promise<void>;
  onUpdateEmployee: (id: string, emp: Partial<Employee>) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onEditRecord: (record: PunchRecord) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isAdmin,
  employees,
  records,
  bonuses = [],
  onAddManualPunch,
  onOpenAddBonus,
  onDeleteBonus,
  onAddEmployee,
  onDeleteEmployee,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<'worker' | 'admin'>('worker');
  const [newEmpWorkType, setNewEmpWorkType] = useState('系統櫃安裝師傅');
  const [newEmpRate, setNewEmpRate] = useState(2600);
  const [newEmpPhone, setNewEmpPhone] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    await onAddEmployee({
      name: newEmpName.trim(),
      role: newEmpRole,
      workType: newEmpWorkType.trim(),
      dailyRate: Number(newEmpRate) || 2600,
      phone: newEmpPhone.trim(),
      active: true,
    });
    setNewEmpName('');
    setNewEmpPhone('');
  };

  return (
    <div className="space-y-4">
      {/* 頂部管理橫幅 (Taupe 咖啡褐，新增【薪資加給】功能按鈕) */}
      <div className="bg-[#2B2521] text-white rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-[#423932]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#423932] border border-[#54473C] flex items-center justify-center text-[#D4C9BC]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">管理人後台</h3>
            <p className="text-xs text-[#C4B8AB] mt-0.5">
              工時補登 · 薪資加給登記 · 員工名冊與出勤管理
            </p>
          </div>
        </div>

        {/* 雙按鈕：補登出勤 與 薪資加給 */}
        <div className="flex items-center gap-2">
          {onOpenAddBonus && (
            <button
              onClick={onOpenAddBonus}
              className="px-4 py-2 bg-[#EAE3DA] hover:bg-[#DFD6C9] text-[#2B2521] font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
            >
              <Coins className="w-4 h-4 text-[#6E5D4F]" />
              <span>薪資加給</span>
            </button>
          )}

          <button
            onClick={() => onAddManualPunch(todayStr)}
            className="px-4 py-2 bg-white hover:bg-[#FAF8F5] text-[#2B2521] font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 text-[#6E5D4F]" />
            <span>補登打卡紀錄</span>
          </button>
        </div>
      </div>

      {/* 薪資加給紀錄清單 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#6E5D4F]" />
            <h4 className="font-bold text-sm text-[#2B2521]">近期薪資加給紀錄</h4>
          </div>
          <span className="text-xs text-[#8A7D70]">
            已累計 {bonuses.length} 筆
          </span>
        </div>

        {bonuses.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#998D80] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E6E1D8]">
            目前尚無薪資加給紀錄，可點選上方「薪資加給」按鈕進行登記發放。
          </div>
        ) : (
          <div className="divide-y divide-[#E6E1D8] max-h-60 overflow-y-auto">
            {bonuses.map((b) => (
              <div key={b.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[#2B2521] flex items-center gap-2">
                    <span>{b.employeeName}</span>
                    <span className="text-[11px] font-mono font-bold text-[#6E5D4F]">
                      +NT${b.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#706458] mt-0.5">
                    {b.date} · {b.note}
                  </div>
                </div>

                {onDeleteBonus && (
                  <button
                    onClick={() => onDeleteBonus(b.id)}
                    className="p-1.5 text-[#998D80] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="刪除此筆加給"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 員工名冊新增與管理 */}
      <div className="bg-white rounded-3xl border border-[#E6E1D8] p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-[#6E5D4F]" />
          <h4 className="font-bold text-sm text-[#2B2521]">出勤員工名冊</h4>
        </div>

        {/* 新增員工表單 */}
        <form onSubmit={handleCreateEmployee} className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#E6E1D8] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <input
            type="text"
            required
            placeholder="姓名"
            value={newEmpName}
            onChange={(e) => setNewEmpName(e.target.value)}
            className="text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-white text-[#2B2521] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F]"
          />
          <input
            type="text"
            placeholder="工種 (例如: 安裝師傅)"
            value={newEmpWorkType}
            onChange={(e) => setNewEmpWorkType(e.target.value)}
            className="text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-white text-[#2B2521] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F]"
          />
          <input
            type="number"
            placeholder="約定日薪 (NT$)"
            value={newEmpRate}
            onChange={(e) => setNewEmpRate(Number(e.target.value))}
            className="text-xs border border-[#E6E1D8] rounded-xl px-3 py-2 bg-white font-mono text-[#2B2521] focus:outline-none focus:ring-2 focus:ring-[#6E5D4F]"
          />
          <button
            type="submit"
            className="py-2 text-xs font-bold text-white bg-[#6E5D4F] hover:bg-[#5C4D40] rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新增員工</span>
          </button>
        </form>

        {/* 現有人員清單 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {employees.map((emp) => (
            <div key={emp.id} className="p-3 bg-[#FAF8F5] border border-[#E6E1D8] rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#2B2521] flex items-center gap-1.5">
                  <span>{emp.name}</span>
                  {emp.role === 'admin' && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#D4C9BC] text-[#4A3D32] rounded font-semibold">
                      管理人
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#706458] mt-0.5">
                  {emp.workType} · NT${emp.dailyRate}/天
                </div>
              </div>

              {emp.role !== 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`確定要自名冊移除員工【${emp.name}】嗎？`)) {
                      onDeleteEmployee(emp.id);
                    }
                  }}
                  className="p-1.5 text-[#998D80] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
