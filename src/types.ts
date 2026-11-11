export interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'worker';
  phone: string;
  dailyRate: number; // 日薪 (NT$)
  workType: string;  // 工種 (例如：泥作、水電、鐵工、粗工)
  avatarColor: string;
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
  durationHours?: number; // 工作時數
  wageMultiplier?: number; // 工數計算 (1.0 = 一工, 0.5 = 半工, 1.25 = 加班)
  calculatedWage?: number; // 預計薪資 (NT$)
  siteName: string; // 施工地點/建案
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  notes?: string;
  source: 'mobile_ios' | 'mobile_android' | 'mobile_web' | 'web' | 'manual_admin';
  modifiedByAdmin?: boolean;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyState {
  companyName: string;
  employees: Employee[];
  records: PunchRecord[];
  settings: {
    adminPin: string;
    defaultSite: string;
    dailyWageStandard: number;
  };
}
