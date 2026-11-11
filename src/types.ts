export interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'worker';
  workType: string;
  dailyRate: number;
  phone?: string;
  avatarColor?: string;
  active: boolean;
  pin?: string;
}

export interface PunchRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  clockInTime: string; // HH:mm:ss
  clockOutTime?: string; // HH:mm:ss
  siteName?: string;
  notes?: string;
  source?: 'mobile_web' | 'desktop' | 'admin_manual';
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  durationHours?: number;
  wageMultiplier?: number;
  calculatedWage?: number;
  modifiedByAdmin?: boolean;
  adminNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 薪資加給資料型態
export interface BonusRecord {
  id: string;
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  amount: number;
  note: string;
  createdAt?: string;
}

export interface CompanyState {
  employees: Employee[];
  records: PunchRecord[];
  bonuses?: BonusRecord[];
  settings?: {
    adminPin?: string;
  };
}
