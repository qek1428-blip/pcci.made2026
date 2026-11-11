import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PunchClock } from './components/PunchClock';
import { CalendarView } from './components/CalendarView';
import { CloudSheetView } from './components/CloudSheetView';
import { AdminPanel } from './components/AdminPanel';
import { EditRecordModal, calculateWorkStats } from './components/EditRecordModal';
import { Employee, PunchRecord, CompanyState } from './types';
import { Clock, Calendar, FileSpreadsheet, Shield, KeyRound, MessageSquareWarning, X, Check, Lock, RefreshCw, Send, Delete, Eye, EyeOff, LogOut } from 'lucide-react';
import { playPunchSound } from './utils/sound';

import splashImg from './assets/images/splash.jpg';
import boboLogo from './assets/images/bobo_logo.jpg';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyhrpQIs-ygEFPOhVM8tafjpjSccqGMcsZ2-41WuxvEL-N9jXWi7eJVTpkKqD1wYEBX/exec';

// PIN 碼格式化防呆：嚴格確保 4 位數
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
