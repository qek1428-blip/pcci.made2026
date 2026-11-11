import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Persistent Data File
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'punch_records.json');

// Initial seed employees
const DEFAULT_EMPLOYEES = [
  {
    id: 'emp-admin',
    name: '薄老闆',
    role: 'admin',
    phone: '0912-345-678',
    dailyRate: 3800,
    workType: '工程總管 / 負責人',
    avatarColor: 'bg-amber-600',
    active: true,
    pin: '8888',
  },
  {
    id: 'emp-01',
    name: '阿明師傅',
    role: 'worker',
    phone: '0922-111-222',
    dailyRate: 3200,
    workType: '泥作師傅',
    avatarColor: 'bg-blue-600',
    active: true,
  },
  {
    id: 'emp-02',
    name: '大雄',
    role: 'worker',
    phone: '0933-222-333',
    dailyRate: 3000,
    workType: '水電師傅',
    avatarColor: 'bg-emerald-600',
    active: true,
  },
  {
    id: 'emp-03',
    name: '阿強',
    role: 'worker',
    phone: '0955-444-555',
    dailyRate: 3200,
    workType: '鐵工/結構',
    avatarColor: 'bg-purple-600',
    active: true,
  },
  {
    id: 'emp-04',
    name: '阿榮',
    role: 'worker',
    phone: '0966-555-666',
    dailyRate: 2600,
    workType: '日薪粗工',
    avatarColor: 'bg-orange-600',
    active: true,
  },
  {
    id: 'emp-05',
    name: '小陳',
    role: 'worker',
    phone: '0977-666-777',
    dailyRate: 2800,
    workType: '油漆/批土',
    avatarColor: 'bg-teal-600',
    active: true,
  },
];

// Helper to seed realistic punch records for November 2026
function generateSeedRecords() {
  const records = [];
  const sites = ['板橋民權路華廈翻修', '新莊副都心水電配管', '三重重陽路外牆拉皮', '中和廠房泥作泥水', '土城工業區鋼構工程'];

  // Seed November 1 to November 10, 2026
  for (let day = 1; day <= 10; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `2026-11-${dayStr}`;

    // Skip Sunday (Nov 1 is Sunday, Nov 8 is Sunday)
    if (day === 1 || day === 8) continue;

    for (const emp of DEFAULT_EMPLOYEES) {
      if (emp.id === 'emp-admin') continue; // Admin manages rather than daily punch

      // 85% attendance probability
      if ((day + emp.name.length) % 7 === 0) continue;

      const inHour = 7 + Math.floor(Math.random() * 2); // 7:45 - 8:15
      const inMin = Math.floor(Math.random() * 45);
      const clockIn = `${inHour < 10 ? '0' + inHour : inHour}:${inMin < 10 ? '0' + inMin : inMin}:00`;

      // If it's today (Nov 10), some workers are still working (no clock out yet)
      const isToday = day === 10;
      let clockOut = undefined;
      let durationHours = undefined;
      let wageMultiplier = 1.0;

      if (!isToday || emp.id === 'emp-01' || emp.id === 'emp-04') {
        const outHour = 17 + Math.floor(Math.random() * 2); // 17:00 - 18:30
        const outMin = Math.floor(Math.random() * 50);
        clockOut = `${outHour}:${outMin < 10 ? '0' + outMin : outMin}:00`;
        const diffMinutes = (outHour - inHour) * 60 + (outMin - inMin);
        durationHours = Number((diffMinutes / 60).toFixed(1));
        if (durationHours >= 9.5) {
          wageMultiplier = 1.25; // Overtime bonus
        }
      }

      const site = sites[(day + emp.name.charCodeAt(0)) % sites.length];

      records.push({
        id: `rec-202611${dayStr}-${emp.id}`,
        employeeId: emp.id,
        employeeName: emp.name,
        date: dateStr,
        clockInTime: clockIn,
        clockOutTime: clockOut,
        durationHours: durationHours,
        wageMultiplier: wageMultiplier,
        calculatedWage: Math.round(emp.dailyRate * wageMultiplier),
        siteName: site,
        location: {
          address: `新北市${site.slice(0, 2)}現場`,
        },
        notes: isToday && !clockOut ? '現場施工中' : '施工順利完成',
        source: 'mobile_ios',
        modifiedByAdmin: false,
        createdAt: `${dateStr}T${clockIn}Z`,
        updatedAt: `${dateStr}T${clockOut || clockIn}Z`,
      });
    }
  }

  return records;
}

// Ensure data file exists
function loadData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      companyName: '薄薄工程行',
      employees: DEFAULT_EMPLOYEES,
      records: generateSeedRecords(),
      settings: {
        adminPin: '8888',
        defaultSite: '板橋民權路工地',
        dailyWageStandard: 3000,
      },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading data file, re-initializing:', err);
    const initialData = {
      companyName: '薄薄工程行',
      employees: DEFAULT_EMPLOYEES,
      records: generateSeedRecords(),
      settings: {
        adminPin: '8888',
        defaultSite: '板橋民權路工地',
        dailyWageStandard: 3000,
      },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
}

function saveData(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save data:', err);
  }
}

// ----------------- API Endpoints -----------------

// 1. Get All Initial State (Company info, employees, records, settings)
app.get('/api/state', (req: Request, res: Response) => {
  const data = loadData();
  res.json({
    success: true,
    data,
  });
});

// 2. Punch In (上班打卡)
app.post('/api/punch/in', (req: Request, res: Response) => {
  const { employeeId, date, time, siteName, location, notes, source } = req.body;
  if (!employeeId || !date || !time) {
    return res.status(400).json({ success: false, error: '缺少必要欄位' });
  }

  const data = loadData();
  const emp = data.employees.find((e: any) => e.id === employeeId);
  if (!emp) {
    return res.status(404).json({ success: false, error: '找不到該員工' });
  }

  // Check if already clocked in for this date
  const existing = data.records.find(
    (r: any) => r.employeeId === employeeId && r.date === date
  );

  if (existing) {
    return res.status(400).json({
      success: false,
      error: `員工 ${emp.name} 於 ${date} 已有打卡紀錄（${existing.clockInTime}）`,
      record: existing,
    });
  }

  const newRecord = {
    id: `rec-${date.replace(/-/g, '')}-${employeeId}-${Date.now().toString().slice(-4)}`,
    employeeId,
    employeeName: emp.name,
    date,
    clockInTime: time,
    clockOutTime: undefined,
    durationHours: undefined,
    wageMultiplier: 1.0,
    calculatedWage: emp.dailyRate,
    siteName: siteName || '薄薄工程行工地現場',
    location: location || null,
    notes: notes || '',
    source: source || 'mobile_web',
    modifiedByAdmin: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.records.unshift(newRecord);
  saveData(data);

  res.json({
    success: true,
    message: `【上班打卡成功】${emp.name} 於 ${time} 完成上班打卡！`,
    record: newRecord,
  });
});

// 3. Punch Out (下班打卡)
app.post('/api/punch/out', (req: Request, res: Response) => {
  const { employeeId, date, time, notes } = req.body;
  if (!employeeId || !date || !time) {
    return res.status(400).json({ success: false, error: '缺少必要欄位' });
  }

  const data = loadData();
  const emp = data.employees.find((e: any) => e.id === employeeId);
  const recordIndex = data.records.findIndex(
    (r: any) => r.employeeId === employeeId && r.date === date
  );

  if (recordIndex === -1) {
    return res.status(400).json({
      success: false,
      error: '今日尚未打上班卡，無法打下班卡。請先打上班卡或由管理人補登。',
    });
  }

  const record = data.records[recordIndex];
  if (record.clockOutTime) {
    return res.status(400).json({
      success: false,
      error: `今日已完成下班打卡（${record.clockOutTime}），如需修改請由管理人操作。`,
      record,
    });
  }

  record.clockOutTime = time;
  if (notes) {
    record.notes = record.notes ? `${record.notes} | ${notes}` : notes;
  }

  // Calculate hours worked
  try {
    const [inH, inM] = record.clockInTime.split(':').map(Number);
    const [outH, outM] = time.split(':').map(Number);
    const diffMin = (outH - inH) * 60 + (outM - inM);
    const hours = Math.max(0, Number((diffMin / 60).toFixed(1)));
    record.durationHours = hours;

    // Wage multiplier logic for day wage
    const dailyRate = emp ? emp.dailyRate : 3000;
    if (hours < 4.5) {
      record.wageMultiplier = 0.5; // 半天工
    } else if (hours >= 10) {
      record.wageMultiplier = 1.3; // 加班
    } else {
      record.wageMultiplier = 1.0; // 一工
    }
    record.calculatedWage = Math.round(dailyRate * record.wageMultiplier);
  } catch (err) {
    console.error('Calculation error:', err);
  }

  record.updatedAt = new Date().toISOString();
  saveData(data);

  res.json({
    success: true,
    message: `【下班打卡成功】${record.employeeName} 於 ${time} 下班，本日累計工時 ${record.durationHours ?? '-'} 小時。`,
    record,
  });
});

// 4. Admin Update / Modify Record (管理員修改紀錄)
app.put('/api/records/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updatePayload = req.body;

  const data = loadData();
  const index = data.records.findIndex((r: any) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: '紀錄不存在' });
  }

  const existing = data.records[index];
  const emp = data.employees.find((e: any) => e.id === (updatePayload.employeeId || existing.employeeId));

  // Recalculate duration if times modified
  let durationHours = updatePayload.durationHours !== undefined ? updatePayload.durationHours : existing.durationHours;
  const inTime = updatePayload.clockInTime || existing.clockInTime;
  const outTime = updatePayload.clockOutTime !== undefined ? updatePayload.clockOutTime : existing.clockOutTime;

  if (inTime && outTime) {
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const diff = (outH - inH) * 60 + (outM - inM);
    durationHours = Math.max(0, Number((diff / 60).toFixed(1)));
  }

  const wageMultiplier = updatePayload.wageMultiplier !== undefined ? updatePayload.wageMultiplier : existing.wageMultiplier;
  const dailyRate = emp ? emp.dailyRate : 3000;
  const calculatedWage = updatePayload.calculatedWage !== undefined ? updatePayload.calculatedWage : Math.round(dailyRate * wageMultiplier);

  data.records[index] = {
    ...existing,
    ...updatePayload,
    durationHours,
    wageMultiplier,
    calculatedWage,
    modifiedByAdmin: true,
    updatedAt: new Date().toISOString(),
  };

  saveData(data);
  res.json({
    success: true,
    message: '管理員已成功修正紀錄！',
    record: data.records[index],
  });
});

// 5. Admin Create Manual Record (管理員補登卡)
app.post('/api/records/manual', (req: Request, res: Response) => {
  const { employeeId, date, clockInTime, clockOutTime, siteName, notes, wageMultiplier, calculatedWage } = req.body;
  if (!employeeId || !date || !clockInTime) {
    return res.status(400).json({ success: false, error: '缺少必要欄位' });
  }

  const data = loadData();
  const emp = data.employees.find((e: any) => e.id === employeeId);
  if (!emp) {
    return res.status(404).json({ success: false, error: '員工不存在' });
  }

  let durationHours = undefined;
  if (clockInTime && clockOutTime) {
    const [inH, inM] = clockInTime.split(':').map(Number);
    const [outH, outM] = clockOutTime.split(':').map(Number);
    const diff = (outH - inH) * 60 + (outM - inM);
    durationHours = Math.max(0, Number((diff / 60).toFixed(1)));
  }

  const multiplier = wageMultiplier !== undefined ? wageMultiplier : (durationHours && durationHours < 4.5 ? 0.5 : 1.0);
  const wage = calculatedWage !== undefined ? calculatedWage : Math.round(emp.dailyRate * multiplier);

  const newRecord = {
    id: `rec-manual-${date.replace(/-/g, '')}-${employeeId}-${Date.now().toString().slice(-4)}`,
    employeeId,
    employeeName: emp.name,
    date,
    clockInTime,
    clockOutTime: clockOutTime || undefined,
    durationHours,
    wageMultiplier: multiplier,
    calculatedWage: wage,
    siteName: siteName || '薄薄工程行工地',
    notes: notes || '管理員補登',
    source: 'manual_admin',
    modifiedByAdmin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.records.unshift(newRecord);
  saveData(data);

  res.json({
    success: true,
    message: `已為 ${emp.name} 補登 ${date} 打卡紀錄！`,
    record: newRecord,
  });
});

// 6. Admin Delete Record (管理員刪除紀錄)
app.delete('/api/records/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const data = loadData();
  const beforeCount = data.records.length;
  data.records = data.records.filter((r: any) => r.id !== id);

  if (data.records.length === beforeCount) {
    return res.status(404).json({ success: false, error: '紀錄不存在' });
  }

  saveData(data);
  res.json({ success: true, message: '紀錄已成功刪除' });
});

// 7. Manage Employees (新增/編輯員工)
app.post('/api/employees', (req: Request, res: Response) => {
  const { name, role, phone, dailyRate, workType, pin } = req.body;
  if (!name || !dailyRate) {
    return res.status(400).json({ success: false, error: '姓名與日薪為必填' });
  }

  const data = loadData();
  const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-orange-600', 'bg-teal-600', 'bg-indigo-600', 'bg-rose-600'];
  const newEmp = {
    id: `emp-${Date.now().toString().slice(-6)}`,
    name,
    role: role || 'worker',
    phone: phone || '',
    dailyRate: Number(dailyRate) || 2800,
    workType: workType || '泥水工程',
    avatarColor: colors[Math.floor(Math.random() * colors.length)],
    active: true,
    pin: pin || '',
  };

  data.employees.push(newEmp);
  saveData(data);
  res.json({ success: true, message: `已新增員工 ${name}`, employee: newEmp });
});

app.put('/api/employees/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const data = loadData();
  const index = data.employees.findIndex((e: any) => e.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: '員工不存在' });
  }

  data.employees[index] = {
    ...data.employees[index],
    ...req.body,
  };

  saveData(data);
  res.json({ success: true, message: '員工資料更新成功', employee: data.employees[index] });
});

app.delete('/api/employees/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const data = loadData();
  const emp = data.employees.find((e: any) => e.id === id);
  if (!emp) {
    return res.status(404).json({ success: false, error: '員工不存在' });
  }
  if (emp.role === 'admin') {
    return res.status(400).json({ success: false, error: '無法刪除工程行最高管理員' });
  }
  data.employees = data.employees.filter((e: any) => e.id !== id);
  saveData(data);
  res.json({ success: true, message: `已成功刪除員工 ${emp.name}` });
});

// Vite Middleware Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[薄薄工程行打卡系統] 伺服器啟動於 port ${PORT}`);
  });
}

startServer();
