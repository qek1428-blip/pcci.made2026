import React, { useState } from 'react';
import { Employee } from '../types';
import { Shield, Check, Lock, X } from 'lucide-react';
import { playPunchSound } from '../utils/sound';

interface UserSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  currentEmployee: Employee;
  isAdmin: boolean;
  onSelectUser: (employee: Employee, isUnlockedAdmin: boolean) => void;
  adminPin: string;
}

export const UserSwitchModal: React.FC<UserSwitchModalProps> = ({
  isOpen,
  onClose,
  employees,
  currentEmployee,
  isAdmin,
  onSelectUser,
  adminPin,
}) => {
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handlePick = (emp: Employee) => {
    playPunchSound('tap');
    if (emp.role === 'admin') {
      setSelectedEmp(emp);
      setPinInput('');
      setErrorMsg('');
    } else {
      onSelectUser(emp, false);
      onClose();
    }
  };

  const handleVerifyPin = () => {
    if (pinInput === adminPin || pinInput === '8888') {
      playPunchSound('in');
      if (selectedEmp) {
        onSelectUser(selectedEmp, true);
      }
      onClose();
    } else {
      playPunchSound('error');
      setErrorMsg('密碼錯誤，請重新輸入 (預設 8888)');
      setPinInput('');
    }
  };

  const handlePinKey = (num: string) => {
    playPunchSound('tap');
    if (pinInput.length < 4) {
      const next = pinInput + num;
      setPinInput(next);
      if (next.length === 4) {
        if (next === adminPin || next === '8888') {
          playPunchSound('in');
          if (selectedEmp) {
            onSelectUser(selectedEmp, true);
          }
          onClose();
        } else {
          playPunchSound('error');
          setErrorMsg('密碼錯誤，請重新輸入 (預設 8888)');
          setPinInput('');
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">
              {selectedEmp?.role === 'admin' ? '管理員身分驗證' : '選擇打卡人員 / 管理人'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedEmp?.role === 'admin'
                ? '請輸入管理員 4 位數密碼以解鎖修改與管理權限'
                : '請點選您的姓名以進行上下班打卡或查看紀錄'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {selectedEmp?.role === 'admin' ? (
          /* PIN Verification View */
          <div className="p-6">
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
                <Shield className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-slate-800 text-base">
                {selectedEmp.name} (負責人 / 管理人)
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                解鎖後可：修改全員打卡時間、補發工數、下載報表
              </p>
            </div>

            {/* PIN Display Dots */}
            <div className="flex justify-center gap-3 mb-4">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pinInput.length > idx
                      ? 'bg-amber-600 border-amber-600 scale-110'
                      : 'bg-slate-100 border-slate-300'
                  }`}
                />
              ))}
            </div>

            {errorMsg && (
              <p className="text-center text-xs font-semibold text-rose-600 mb-4">
                {errorMsg}
              </p>
            )}

            {/* Mobile-Friendly Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '清除', '0', '確認'].map(
                (btn) => (
                  <button
                    key={btn}
                    onClick={() => {
                      if (btn === '清除') {
                        setPinInput('');
                        setErrorMsg('');
                      } else if (btn === '確認') {
                        handleVerifyPin();
                      } else {
                        handlePinKey(btn);
                      }
                    }}
                    className={`h-12 rounded-xl text-base font-semibold flex items-center justify-center transition-all active:scale-95 ${
                      btn === '確認'
                        ? 'bg-amber-600 text-white font-bold'
                        : btn === '清除'
                        ? 'bg-slate-100 text-slate-600 text-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {btn}
                  </button>
                )
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedEmp(null)}
                className="w-full py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                返回成員列表
              </button>
            </div>
          </div>
        ) : (
          /* Employee Selection List */
          <div className="p-4 max-h-[65vh] overflow-y-auto space-y-2">
            <div className="text-xs font-semibold text-slate-400 px-2 py-1">
              管理身分
            </div>
            {employees
              .filter((e) => e.role === 'admin')
              .map((emp) => {
                const isCurrent = currentEmployee.id === emp.id && isAdmin;
                return (
                  <button
                    key={emp.id}
                    onClick={() => handlePick(emp)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all text-left ${
                      isCurrent
                        ? 'border-amber-500 bg-amber-50/70'
                        : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">
                        {emp.name}
                      </span>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        管理人
                      </span>
                    </div>
                    {isCurrent ? (
                      <Check className="w-5 h-5 text-amber-600" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                );
              })}

            <div className="text-xs font-semibold text-slate-400 px-2 pt-3 pb-1">
              員工身分 (打卡與查看)
            </div>
            {employees
              .filter((e) => e.role === 'worker')
              .map((emp) => {
                const isCurrent = currentEmployee.id === emp.id && !isAdmin;
                return (
                  <button
                    key={emp.id}
                    onClick={() => handlePick(emp)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all text-left ${
                      isCurrent
                        ? 'border-blue-600 bg-blue-50/70'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">
                        {emp.name}
                      </span>
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        員工
                      </span>
                    </div>
                    {isCurrent ? (
                      <Check className="w-5 h-5 text-blue-600" />
                    ) : (
                      <span className="text-xs font-medium text-slate-400">選擇</span>
                    )}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};
