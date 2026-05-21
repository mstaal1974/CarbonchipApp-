// Seed data for Carbonchip BI — 90 days of synthetic ops history
// Exposes window.DATA, window.fmt, window.calc

const today = new Date();
today.setHours(0,0,0,0);

const daysAgo = (d) => { const x = new Date(today); x.setDate(x.getDate() - d); return x; };
const iso = (d) => d.toISOString().slice(0,10);
const rand = (seed) => { let s = seed; return () => (s = (s * 9301 + 49297) % 233280) / 233280; };
const r = rand(42);
const HISTORY_DAYS = 1095; // 3 years
const pick = (arr) => arr[Math.floor(r() * arr.length)];
const between = (a, b) => a + r() * (b - a);

// ─── Clients & contracts ──────────────────────────────
const CLIENTS = [
  { id: 'kilcoy',   name: 'Kilcoy Pastoral',  short: 'Kilcoy',   product: 'chip',     unit: 't',
    rate: 108.00, loadsPerDay: 2.5, tonnesPerLoad: 56, m3PerLoad: 120, deliver: true,
    tone: 'green', sla: 'On-time' },
  { id: 'searles',  name: 'Searles Garden Supplies', short: 'Searles', product: 'chip',  unit: 't',
    rate: 148.00, loadsPerDay: 2.0, tonnesPerLoad: 52, m3PerLoad: 125, deliver: true,
    tone: 'cyan', sla: 'On-time' },
  { id: 'summers',  name: 'Summers Mulch',    short: 'Summers',  product: 'mulch',    unit: 'm3',
    rate: 26.25,  loadsPerWeek: 7.5, m3PerLoad: 73, deliver: false,
    tone: 'amber', sla: 'Self-pickup' },
  { id: 'piggeries',name: 'Regional Piggeries', short: 'Piggeries', product: 'shavings', unit: 'm3',
    rate: 39.71, loadsPerWeek: 1, m3PerLoad: 73, deliver: true,
    tone: 'purple', sla: 'On-time' },
];

// Projected annual revenue (5 working days/wk, 50 weeks for downtime)
const WORK_DAYS_PER_YEAR = 250;
const WORK_WEEKS_PER_YEAR = 50;
function annualProjection(c) {
  if (c.loadsPerDay) return c.loadsPerDay * WORK_DAYS_PER_YEAR * c.tonnesPerLoad * c.rate;
  return c.loadsPerWeek * WORK_WEEKS_PER_YEAR * c.m3PerLoad * c.rate;
}

// ─── Sites & products ──────────────────────────────
const SITES = [
  { id: 'gympie',   name: 'Gympie State Forest',   region: 'SE QLD' },
  { id: 'imbil',    name: 'Imbil Plantation',      region: 'SE QLD' },
  { id: 'kenilworth', name: 'Kenilworth Block',    region: 'SE QLD' },
  { id: 'amamoor',  name: 'Amamoor Coupe',         region: 'SE QLD' },
  { id: 'tuan',     name: 'Tuan State Forest',     region: 'Wide Bay' },
  { id: 'yard',     name: 'Yard / Depot',          region: 'SE QLD' },
];

const PRODUCTS = [
  { id: 'chip',      name: 'Chip',       unit: 'm3', tone: 'green' },
  { id: 'microchip', name: 'Microchip',  unit: 'm3', tone: 'lime' },
  { id: 'sawdust',   name: 'Sawdust',    unit: 'm3', tone: 'amber' },
  { id: 'shavings',  name: 'Shavings',   unit: 'm3', tone: 'orange' },
  { id: 'carbon',    name: 'Carbon',     unit: 't',  tone: 'cyan' },
  { id: 'regrind',   name: 'Re-grind',   unit: 'm3', tone: 'blue' },
  { id: 'logs',      name: 'Logs',       unit: 'm3', tone: 'purple' },
  { id: 'poles',     name: 'Poles',      unit: 'ea', tone: 'pink' },
  { id: 'biomass',   name: 'Biomass',    unit: 't',  tone: 'red' },
  { id: 'mulch',     name: 'Mulch',      unit: 'm3', tone: 'amber' },
  { id: 'f1',        name: 'Sawn F1',    unit: 'm3', tone: 'green' },
  { id: 'f2',        name: 'Sawn F2',    unit: 'm3', tone: 'green' },
  { id: 'm1',        name: 'Sawn M1',    unit: 'm3', tone: 'cyan' },
  { id: 'c1',        name: 'Sawn C1',    unit: 'm3', tone: 'cyan' },
];

// ─── Fleet ──────────────────────────────
const FLEET = [
  { id: 'BD-01', plate: '742-KZA', type: 'B-Double',  make: 'Kenworth T610', year: 2021, capacityT: 56, status: 'active',  regExpiry: daysAgo(-42), odometer: 482103, hours: null, fuelL100km: 58 },
  { id: 'BD-02', plate: '895-PQT', type: 'B-Double',  make: 'Kenworth T909', year: 2019, capacityT: 56, status: 'active',  regExpiry: daysAgo(-118), odometer: 612855, hours: null, fuelL100km: 62 },
  { id: 'BD-03', plate: '301-RGD', type: 'B-Double',  make: 'Volvo FH16',    year: 2022, capacityT: 56, status: 'service', regExpiry: daysAgo(-9),   odometer: 318420, hours: null, fuelL100km: 54 },
  { id: 'EX-01', plate: 'PLANT',   type: 'Excavator', make: 'Cat 320 + Grapple', year: 2020, status: 'active',  regExpiry: null, odometer: null, hours: 4820, fuelLh: 18 },
  { id: 'GR-01', plate: 'PLANT',   type: 'Grinder',   make: 'Vermeer HG6800TX', year: 2021, status: 'active', regExpiry: null, hours: 3120, fuelLh: 62 },
  { id: 'CB-01', plate: 'PLANT',   type: 'Carbonator',make: 'Tigercat 6050', year: 2023, status: 'active', regExpiry: null, hours: 1402, fuelLh: 28 },
  { id: 'PL-01', plate: 'PLANT',   type: 'Planter',   make: 'Bracke P11.a',  year: 2022, status: 'active', regExpiry: null, hours: 2210, fuelLh: 9 },
  { id: 'ML-01', plate: 'PLANT',   type: 'Mill',      make: 'Wood-Mizer LT70', year: 2020, status: 'active', regExpiry: null, hours: 5610, fuelLh: 0 },
  { id: 'UT-01', plate: '518-MKL', type: 'Ute',       make: 'Hilux SR5',     year: 2023, status: 'active', regExpiry: daysAgo(-72), odometer: 41200 },
  { id: 'UT-02', plate: '624-NXP', type: 'Ute',       make: 'Ranger XLT',    year: 2022, status: 'active', regExpiry: daysAgo(-21), odometer: 68340 },
  { id: 'UT-03', plate: '447-WJB', type: 'Ute',       make: 'Hilux Workmate', year: 2021, status: 'active', regExpiry: daysAgo(-5), odometer: 92180 },
  { id: 'VN-01', plate: '802-LCK', type: 'Van',       make: 'Hiace LWB',     year: 2020, status: 'active', regExpiry: daysAgo(-148), odometer: 118540 },
];

// ─── Users ──────────────────────────────
const USERS = [
  { id: 'u1', name: 'Mick Caruana',    email: 'mick@carbonchip.au',   role: 'Admin',     status: 'active',  last: '2 min ago' },
  { id: 'u2', name: 'Sarah Henderson', email: 'sarah@carbonchip.au',  role: 'Ops Mgr',   status: 'active',  last: '14 min ago' },
  { id: 'u3', name: 'Jase Williamson', email: 'jase@carbonchip.au',   role: 'Driver',    status: 'active',  last: '3 h ago' },
  { id: 'u4', name: 'Tane Ngata',      email: 'tane@carbonchip.au',   role: 'Driver',    status: 'active',  last: '1 h ago' },
  { id: 'u5', name: 'Pete Korhonen',   email: 'pete@carbonchip.au',   role: 'Mill Op',   status: 'active',  last: 'Yesterday' },
  { id: 'u6', name: 'Linda Ng',        email: 'linda@carbonchip.au',  role: 'Finance',   status: 'active',  last: '4 h ago' },
  { id: 'u7', name: 'Robbie Carter',   email: 'robbie@carbonchip.au', role: 'Grinder Op', status: 'active', last: '28 min ago' },
  { id: 'u8', name: 'Aaron Pratt',     email: 'aaron@carbonchip.au',  role: 'Planter Op', status: 'inactive', last: '12 d ago' },
];

const ROLES = ['Admin','Ops Mgr','Finance','Driver','Mill Op','Grinder Op','Planter Op','Excavator Op','Viewer'];

// ─── Generate haulage logs (90 days back) ──────────────────────────────
const haulageLogs = [];
let lid = 0;
for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
  const date = daysAgo(d);
  const dow = date.getDay();
  // skip weekends
  if (dow === 0 || dow === 6) continue;

  CLIENTS.forEach(c => {
    let n;
    if (c.loadsPerDay) n = Math.round(c.loadsPerDay + (r() - 0.5));
    else n = (r() < c.loadsPerWeek / 5) ? 1 : 0;
    for (let i = 0; i < n; i++) {
      const product = c.product;
      const m3 = c.m3PerLoad * between(0.92, 1.05);
      const tonnes = (c.tonnesPerLoad || c.m3PerLoad * 0.6) * between(0.92, 1.05);
      const rate = c.rate;
      const units = c.unit === 't' ? tonnes : m3;
      const truck = pick(FLEET.filter(f => f.type === 'B-Double'));
      const driver = pick(USERS.filter(u => u.role === 'Driver'));
      const site = pick(SITES.filter(s => s.id !== 'yard'));
      haulageLogs.push({
        id: 'H' + String(++lid).padStart(4,'0'),
        date: iso(date),
        time: `${(6 + Math.floor(r()*10)).toString().padStart(2,'0')}:${(Math.floor(r()*6)*10).toString().padStart(2,'0')}`,
        clientId: c.id,
        client: c.short,
        product,
        productName: PRODUCTS.find(p=>p.id===product)?.name || product,
        unit: c.unit,
        units: +units.toFixed(1),
        m3: +m3.toFixed(1),
        tonnes: +tonnes.toFixed(1),
        rate,
        revenue: +(units * rate).toFixed(2),
        direction: 'outbound',
        from: 'yard',
        fromName: 'Yard',
        to: c.short,
        truck: truck.id,
        truckPlate: truck.plate,
        driver: driver.name,
        trailer: 'B-Double',
        status: d < 7 ? (d === 0 && r() < 0.3 ? 'planned' : 'delivered') : 'invoiced',
        invoiceStatus: d > 30 ? (r() < 0.9 ? 'paid' : 'overdue') : (d > 7 ? (r() < 0.6 ? 'paid' : 'open') : 'open'),
      });
    }
  });

  // Also some inbound from harvest sites to yard
  const inboundCount = 1 + Math.floor(r() * 4);
  for (let i = 0; i < inboundCount; i++) {
    const site = pick(SITES.filter(s => s.id !== 'yard'));
    const m3 = between(80, 140);
    const tonnes = m3 * between(0.45, 0.62);
    const truck = pick(FLEET.filter(f => f.type === 'B-Double'));
    const driver = pick(USERS.filter(u => u.role === 'Driver'));
    haulageLogs.push({
      id: 'H' + String(++lid).padStart(4,'0'),
      date: iso(date),
      time: `${(5 + Math.floor(r()*4)).toString().padStart(2,'0')}:${(Math.floor(r()*6)*10).toString().padStart(2,'0')}`,
      direction: 'inbound',
      product: 'biomass',
      productName: 'Biomass (residue)',
      unit: 'm3',
      units: +m3.toFixed(1),
      m3: +m3.toFixed(1),
      tonnes: +tonnes.toFixed(1),
      rate: 0, revenue: 0,
      from: site.id, fromName: site.name,
      to: 'yard',
      truck: truck.id, truckPlate: truck.plate,
      driver: driver.name,
      trailer: 'B-Double',
      status: 'received',
      invoiceStatus: null,
    });
  }
}

// ─── Planter logs ──────────────────────────────
const planterLogs = [];
let pid = 0;
for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
  const date = daysAgo(d);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) continue;
  if (r() < 0.55) {
    const hectares = +between(1.8, 4.6).toFixed(2);
    const seedlings = Math.round(hectares * between(1100, 1380));
    const hours = +between(5.5, 8.4).toFixed(1);
    planterLogs.push({
      id: 'P' + String(++pid).padStart(4,'0'),
      date: iso(date),
      site: pick(SITES.filter(s=>s.id!=='yard')).id,
      hectares, seedlings, hours,
      operator: 'Aaron Pratt',
    });
  }
}

// ─── Excavator logs ──────────────────────────────
const excavatorLogs = [];
let eid = 0;
for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
  const date = daysAgo(d);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) continue;
  if (r() < 0.78) {
    const hours = +between(6.2, 9.2).toFixed(1);
    excavatorLogs.push({
      id: 'E' + String(++eid).padStart(4,'0'),
      date: iso(date),
      site: pick(SITES.filter(s=>s.id!=='yard')).id,
      hours,
      operator: 'Wet-hired (contractor)',
      rate: 220,
      cost: +(hours * 220).toFixed(2),
    });
  }
}

// ─── Grinder logs ──────────────────────────────
const grinderLogs = [];
let gid = 0;
for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
  const date = daysAgo(d);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) continue;
  if (r() < 0.85) {
    const hours = +between(5.5, 9.0).toFixed(1);
    const throughput = +(hours * between(38, 52)).toFixed(0);
    grinderLogs.push({
      id: 'G' + String(++gid).padStart(4,'0'),
      date: iso(date),
      hours, throughput,
      operator: 'Robbie Carter',
      product: r() < 0.7 ? 'chip' : 'microchip',
    });
  }
}

// ─── Carbonator logs ──────────────────────────────
const carbonatorLogs = [];
let cid = 0;
for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
  const date = daysAgo(d);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) continue;
  if (r() < 0.62) {
    const hours = +between(4.0, 8.5).toFixed(1);
    const throughput = +(hours * between(0.9, 1.4)).toFixed(2); // tonnes carbon
    carbonatorLogs.push({
      id: 'C' + String(++cid).padStart(4,'0'),
      date: iso(date),
      hours, throughput,
      operator: 'Sarah Henderson',
    });
  }
}

// ─── Mill logs ──────────────────────────────
const millLogs = [];
let mid = 0;
const millSizes = ['F1','F2','M1','C1'];
for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
  const date = daysAgo(d);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) continue;
  if (r() < 0.7) {
    const size = pick(millSizes);
    const m3 = +between(2.4, 6.8).toFixed(2);
    millLogs.push({
      id: 'M' + String(++mid).padStart(4,'0'),
      date: iso(date),
      size, m3,
      operator: 'Pete Korhonen',
    });
  }
}

// ─── Stock (yard) ──────────────────────────────
const STOCK = [
  { product: 'chip',      location: 'Yard Bay A', m3: 1840, target: 2200, tone: 'green' },
  { product: 'microchip', location: 'Yard Bay B', m3:  620, target: 800,  tone: 'lime' },
  { product: 'sawdust',   location: 'Bin 3',      m3:  220, target: 400,  tone: 'amber' },
  { product: 'shavings',  location: 'Bin 4',      m3:  180, target: 250,  tone: 'orange' },
  { product: 'carbon',    location: 'Carbon Shed',m3:   34, target: 60,   tone: 'cyan' },
  { product: 'regrind',   location: 'Yard Bay C', m3:  410, target: 500,  tone: 'blue' },
  { product: 'logs',      location: 'Log Deck',   m3:  280, target: 350,  tone: 'purple' },
  { product: 'biomass',   location: 'Tip Pad',    m3:  720, target: 900,  tone: 'red' },
];

// ─── Cost transactions (R&M, fuel, wages, insurance, loans, rego) ──────────────────
const costLogs = [];
let xid = 0;
const costCats = {
  'Repairs & Maint': { color: 'red', minD: 80, maxD: 480 },
  'Fuel': { color: 'amber', minD: 220, maxD: 980 },
  'Wages': { color: 'blue', minD: 1800, maxD: 2400 },
  'Insurance': { color: 'purple', minD: 0, maxD: 0 },
  'Loans': { color: 'orange', minD: 0, maxD: 0 },
  'Registration': { color: 'cyan', minD: 0, maxD: 0 },
  'Tyres & Lubes': { color: 'red', minD: 0, maxD: 0 },
  'Teeth & Grates': { color: 'red', minD: 0, maxD: 0 },
  'Power': { color: 'amber', minD: 0, maxD: 0 },
  'Rent': { color: 'purple', minD: 0, maxD: 0 },
  'Safety Equip': { color: 'blue', minD: 0, maxD: 0 },
  'Gen Business': { color: 'cyan', minD: 0, maxD: 0 },
};
const componentRefs = ['planter','excavator','haulage','grinder','carbonator','mill','overhead'];

for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
  const date = daysAgo(d);
  const dow = date.getDay();
  if (dow === 0 || dow === 6) continue;

  // Daily costs
  if (r() < 0.6) {
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Fuel', component: pick(componentRefs), amount: +between(280, 920).toFixed(2), vendor: 'BP Card' });
  }
  if (r() < 0.25) {
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Repairs & Maint', component: pick(componentRefs), amount: +between(120, 1800).toFixed(2), vendor: pick(['Hastings Diesel','TCM Equipment','Bridgestone','Wesco']) });
  }
  if (r() < 0.12) {
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Tyres & Lubes', component: 'haulage', amount: +between(380, 2400).toFixed(2), vendor: 'Bridgestone' });
  }
  if (r() < 0.06) {
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Teeth & Grates', component: 'grinder', amount: +between(1400, 4200).toFixed(2), vendor: 'Vermeer Parts' });
  }
  // Weekly wages
  if (dow === 5) {
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Wages', component: 'haulage', amount: +between(11000, 13500).toFixed(2), vendor: 'Payroll' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Wages', component: 'overhead', amount: +between(6200, 7800).toFixed(2), vendor: 'Payroll' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Wages', component: 'mill', amount: +between(2100, 2600).toFixed(2), vendor: 'Payroll' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Wages', component: 'grinder', amount: +between(2100, 2600).toFixed(2), vendor: 'Payroll' });
  }
  // Monthly insurance/loan/rent (fire on day 1 of month)
  if (date.getDate() === 1) {
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Insurance',    component: 'overhead', amount: 8420.00, vendor: 'NRMA Commercial' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Loans',        component: 'haulage',  amount: 14200.00, vendor: 'CBA Equipment' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Loans',        component: 'grinder',  amount: 6800.00,  vendor: 'CBA Equipment' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Loans',        component: 'carbonator', amount: 9200.00, vendor: 'Westpac' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Loans',        component: 'planter',  amount: 3400.00, vendor: 'CBA Equipment' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Rent',         component: 'overhead', amount: 5800.00, vendor: 'Yard Lessor' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Power',        component: 'mill',     amount: +between(820, 1240).toFixed(2), vendor: 'Energex' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Gen Business', component: 'overhead', amount: +between(1400, 2200).toFixed(2), vendor: 'Misc' });
    costLogs.push({ id: 'X'+(++xid), date: iso(date), category: 'Safety Equip', component: 'overhead', amount: +between(280, 720).toFixed(2),  vendor: 'Blackwoods' });
  }
}

// Excavator contractor cost — already inside excavatorLogs

// ─── Activity feed ──────────────────────────────
const ACTIVITY = [
  { time: '2 min ago',  actor: 'Jase W.',   action: 'logged inbound load from Imbil',     icon: '📥', tone: 'cyan' },
  { time: '14 min ago', actor: 'Sarah H.',  action: 'scheduled tomorrow\'s haulage runs', icon: '📅', tone: 'green' },
  { time: '28 min ago', actor: 'Robbie C.', action: 'started Grinder run · 2nd shift',   icon: '⚙️', tone: 'blue' },
  { time: '1 h ago',    actor: 'Tane N.',   action: 'delivered B-Double 56t to Kilcoy',  icon: '🚛', tone: 'green' },
  { time: '2 h ago',    actor: 'Linda N.',  action: 'reconciled 3 invoices · $42,800',   icon: '💰', tone: 'amber' },
  { time: '3 h ago',    actor: 'Mick C.',   action: 'approved capex: replacement teeth set', icon: '✅', tone: 'green' },
  { time: '4 h ago',    actor: 'System',    action: 'flagged BD-02 reg expiring 18 days', icon: '⚠️', tone: 'amber' },
  { time: '5 h ago',    actor: 'Pete K.',   action: 'milled 4.2 m³ F1 + 1.8 m³ M1',       icon: '🪵', tone: 'purple' },
];

// ─── Helpers ──────────────────────────────
const fmt = {
  $: (n, dp = 0) => '$' + (n||0).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
  $1: (n) => '$' + (n||0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  n:  (n, dp = 0) => (n||0).toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp }),
  pct: (n, dp = 0) => (n*100).toFixed(dp) + '%',
  delta: (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%',
  date: (d) => { const dt = typeof d === 'string' ? new Date(d) : d; return dt.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' }); },
  dateLong: (d) => { const dt = typeof d === 'string' ? new Date(d) : d; return dt.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }); },
  dow: (d) => { const dt = typeof d === 'string' ? new Date(d) : d; return dt.toLocaleDateString('en-AU', { weekday: 'short' }); },
};

// Aggregates
function inRange(arr, days) {
  const cutoff = iso(daysAgo(days - 1));
  return arr.filter(x => x.date >= cutoff);
}

function calc(days = 90) {
  const out = {};
  const sales = inRange(haulageLogs.filter(h => h.direction === 'outbound'), days);
  const costsInRange = inRange(costLogs, days);
  const excavatorInRange = inRange(excavatorLogs, days);
  const planterInRange = inRange(planterLogs, days);
  const grinderInRange = inRange(grinderLogs, days);
  const carbonatorInRange = inRange(carbonatorLogs, days);
  const millInRange = inRange(millLogs, days);
  const haulageInRange = inRange(haulageLogs, days);

  out.revenueYTD = sales.reduce((s,h) => s + h.revenue, 0);
  out.revenueCollected = sales.filter(h => h.invoiceStatus === 'paid').reduce((s,h)=>s+h.revenue,0);
  out.revenueOutstanding = sales.filter(h => h.invoiceStatus === 'open' || h.invoiceStatus === 'overdue').reduce((s,h)=>s+h.revenue,0);
  out.revenueOverdue = sales.filter(h => h.invoiceStatus === 'overdue').reduce((s,h)=>s+h.revenue,0);
  out.totalLoads = sales.length;

  out.costsYTD = costsInRange.reduce((s,c) => s + c.amount, 0) + excavatorInRange.reduce((s,e) => s + e.cost, 0);

  out.ebitda = out.revenueYTD - out.costsYTD;
  out.margin = out.revenueYTD > 0 ? out.ebitda / out.revenueYTD : 0;

  out.annualProjected = CLIENTS.reduce((s,c) => s + annualProjection(c), 0);

  out.byClient = CLIENTS.map(c => {
    const cs = sales.filter(s => s.clientId === c.id);
    return { ...c, loads: cs.length, revenue: cs.reduce((a,b)=>a+b.revenue,0), tonnes: cs.reduce((a,b)=>a+b.tonnes,0), m3: cs.reduce((a,b)=>a+b.m3,0), annual: annualProjection(c) };
  });

  // Daily series within range
  const dayList = [];
  for (let d = days - 1; d >= 0; d--) {
    const key = iso(daysAgo(d));
    const dayRev = sales.filter(s=>s.date===key).reduce((a,b)=>a+b.revenue,0);
    const dayCost = costsInRange.filter(c=>c.date===key).reduce((a,b)=>a+b.amount,0)
      + excavatorInRange.filter(e=>e.date===key).reduce((a,b)=>a+b.cost,0);
    dayList.push({ date: key, revenue: dayRev, cost: dayCost, ebitda: dayRev - dayCost });
  }
  out.daily = dayList;

  out.planterTotals = {
    seedlings: planterInRange.reduce((s,p)=>s+p.seedlings,0),
    hectares: planterInRange.reduce((s,p)=>s+p.hectares,0),
    hours: planterInRange.reduce((s,p)=>s+p.hours,0),
    entries: planterInRange.length,
  };
  out.excavatorTotals = {
    hours: excavatorInRange.reduce((s,e)=>s+e.hours,0),
    cost: excavatorInRange.reduce((s,e)=>s+e.cost,0),
    entries: excavatorInRange.length,
  };
  out.grinderTotals = {
    hours: grinderInRange.reduce((s,g)=>s+g.hours,0),
    throughput: grinderInRange.reduce((s,g)=>s+g.throughput,0),
    entries: grinderInRange.length,
  };
  out.carbonatorTotals = {
    hours: carbonatorInRange.reduce((s,c)=>s+c.hours,0),
    throughput: carbonatorInRange.reduce((s,c)=>s+c.throughput,0),
    entries: carbonatorInRange.length,
  };
  out.millTotals = {
    m3: millInRange.reduce((s,m)=>s+m.m3,0),
    entries: millInRange.length,
    bySize: millSizes.reduce((acc,sz)=>{ acc[sz] = millInRange.filter(m=>m.size===sz).reduce((a,b)=>a+b.m3,0); return acc; }, {}),
  };

  const catTotals = {};
  costsInRange.forEach(c => { catTotals[c.category] = (catTotals[c.category]||0) + c.amount; });
  excavatorInRange.forEach(e => { catTotals['Wages'] = (catTotals['Wages']||0) + e.cost; });
  out.costsByCategory = Object.entries(catTotals).map(([k,v])=>({ category: k, amount: v })).sort((a,b)=>b.amount-a.amount);

  const compTotals = {};
  costsInRange.forEach(c => { compTotals[c.component] = (compTotals[c.component]||0) + c.amount; });
  excavatorInRange.forEach(e => { compTotals['excavator'] = (compTotals['excavator']||0) + e.cost; });
  out.costsByComponent = Object.entries(compTotals).map(([k,v])=>({ component: k, amount: v })).sort((a,b)=>b.amount-a.amount);

  const totalLoads = sales.length;
  const haulageCostShare = (compTotals['haulage'] || 0);
  out.profitByClient = out.byClient.map(c => {
    const loadShare = c.loads / Math.max(totalLoads,1);
    const allocCost = haulageCostShare * loadShare;
    return { ...c, allocCost, profit: c.revenue - allocCost, margin: c.revenue ? (c.revenue - allocCost)/c.revenue : 0 };
  });

  out.haulageInRange = haulageInRange;
  out.days = days;
  return out;
}

// ─── Range aggregator with cash position and bucketed series ─────────
const OPENING_CASH = 39000;

// Today's cash position is OPENING_CASH; historical positions walk backwards
// (each prior day = next day's cash minus that day's ebitda)
const fullDailySeries = (() => {
  const series = [];
  const revByDate = {};
  const costByDate = {};
  haulageLogs.filter(h => h.direction === 'outbound').forEach(h => {
    revByDate[h.date] = (revByDate[h.date] || 0) + h.revenue;
  });
  costLogs.forEach(c => { costByDate[c.date] = (costByDate[c.date] || 0) + c.amount; });
  excavatorLogs.forEach(e => { costByDate[e.date] = (costByDate[e.date] || 0) + e.cost; });

  // Build oldest -> newest with daily flows; cashPosition filled in below
  for (let d = HISTORY_DAYS - 1; d >= 0; d--) {
    const date = iso(daysAgo(d));
    const rev = revByDate[date] || 0;
    const cst = costByDate[date] || 0;
    series.push({ date, revenue: rev, cost: cst, ebitda: rev - cst, cashPosition: 0 });
  }
  // Walk backwards: today's end-of-day cash = OPENING_CASH
  let cash = OPENING_CASH;
  for (let i = series.length - 1; i >= 0; i--) {
    series[i].cashPosition = cash;
    cash -= series[i].ebitda;
  }
  return series;
})();

function aggregateRange(days) {
  const cutoff = iso(daysAgo(days - 1));
  const inRangeDaily = fullDailySeries.filter(d => d.date >= cutoff);

  // Choose bucket
  const bucket = days <= 60 ? 'day' : days <= 120 ? 'day' : days <= 400 ? 'week' : 'month';

  const buckets = {};
  const orderedKeys = [];
  inRangeDaily.forEach(d => {
    let key, label;
    if (bucket === 'day') { key = d.date; label = fmt.date(d.date); }
    else if (bucket === 'week') {
      const dd = new Date(d.date);
      const dow = (dd.getDay() + 6) % 7; // 0 = Mon
      const monday = new Date(dd); monday.setDate(dd.getDate() - dow);
      key = iso(monday);
      label = fmt.date(monday);
    } else {
      key = d.date.slice(0,7);
      label = new Date(d.date + 'T00:00').toLocaleDateString('en-AU', { month:'short', year:'2-digit' });
    }
    if (!buckets[key]) { buckets[key] = { key, label, revenue: 0, cost: 0, ebitda: 0, cashPosition: 0, lastDate: d.date }; orderedKeys.push(key); }
    buckets[key].revenue += d.revenue;
    buckets[key].cost += d.cost;
    // cashPosition = ending balance of period (most recent day's value)
    if (d.date >= buckets[key].lastDate) {
      buckets[key].cashPosition = d.cashPosition;
      buckets[key].lastDate = d.date;
    }
  });
  const series = orderedKeys.map(k => { const b = buckets[k]; b.ebitda = b.revenue - b.cost; return b; });

  // Range totals
  const revenue = inRangeDaily.reduce((s,d)=>s+d.revenue, 0);
  const cost    = inRangeDaily.reduce((s,d)=>s+d.cost, 0);
  const ebitda  = revenue - cost;
  const margin  = revenue > 0 ? ebitda / revenue : 0;
  const cashPosition = inRangeDaily.length ? inRangeDaily[inRangeDaily.length - 1].cashPosition : OPENING_CASH;
  const cashOpening  = inRangeDaily.length ? inRangeDaily[0].cashPosition - inRangeDaily[0].ebitda : OPENING_CASH;
  const cashDelta = cashPosition - cashOpening;

  // Sales filtered
  const sales = haulageLogs.filter(h => h.direction === 'outbound' && h.date >= cutoff);
  const revenueCollected = sales.filter(s => s.invoiceStatus === 'paid').reduce((a,b)=>a+b.revenue, 0);
  const outstanding = sales.filter(s => s.invoiceStatus === 'open' || s.invoiceStatus === 'overdue').reduce((a,b)=>a+b.revenue, 0);
  const overdue = sales.filter(s => s.invoiceStatus === 'overdue').reduce((a,b)=>a+b.revenue, 0);
  const totalLoads = sales.length;
  const inboundLoads = haulageLogs.filter(h => h.direction === 'inbound' && h.date >= cutoff).length;

  // Revenue by client filtered
  const byClient = CLIENTS.map(c => {
    const cs = sales.filter(s => s.clientId === c.id);
    return { ...c, loads: cs.length, revenue: cs.reduce((a,b)=>a+b.revenue,0), tonnes: cs.reduce((a,b)=>a+b.tonnes,0), m3: cs.reduce((a,b)=>a+b.m3,0), annual: annualProjection(c) };
  });

  // Op totals
  const planterTotals = (() => {
    const x = planterLogs.filter(p => p.date >= cutoff);
    return { seedlings: x.reduce((s,p)=>s+p.seedlings,0), hectares: x.reduce((s,p)=>s+p.hectares,0), hours: x.reduce((s,p)=>s+p.hours,0), entries: x.length };
  })();
  const excavatorTotals = (() => {
    const x = excavatorLogs.filter(p => p.date >= cutoff);
    return { hours: x.reduce((s,p)=>s+p.hours,0), cost: x.reduce((s,p)=>s+p.cost,0), entries: x.length };
  })();
  const grinderTotals = (() => {
    const x = grinderLogs.filter(p => p.date >= cutoff);
    return { hours: x.reduce((s,p)=>s+p.hours,0), throughput: x.reduce((s,p)=>s+p.throughput,0), entries: x.length };
  })();
  const carbonatorTotals = (() => {
    const x = carbonatorLogs.filter(p => p.date >= cutoff);
    return { hours: x.reduce((s,p)=>s+p.hours,0), throughput: x.reduce((s,p)=>s+p.throughput,0), entries: x.length };
  })();
  const millTotals = (() => {
    const x = millLogs.filter(p => p.date >= cutoff);
    return { m3: x.reduce((s,p)=>s+p.m3,0), entries: x.length };
  })();

  return {
    days, bucket, series,
    revenue, cost, ebitda, margin,
    cashPosition, cashOpening, cashDelta,
    revenueCollected, outstanding, overdue,
    totalLoads, inboundLoads,
    byClient,
    planterTotals, excavatorTotals, grinderTotals, carbonatorTotals, millTotals,
    annualProjected: CLIENTS.reduce((s,c) => s + annualProjection(c), 0),
  };
}

window.DATA = {
  CLIENTS, SITES, PRODUCTS, FLEET, USERS, ROLES,
  STOCK, ACTIVITY,
  haulageLogs, planterLogs, excavatorLogs, grinderLogs, carbonatorLogs, millLogs, costLogs,
  WORK_DAYS_PER_YEAR, WORK_WEEKS_PER_YEAR,
};
window.fmt = fmt;
window.calcAll = calc;
window.AGG = calc();
window.aggregateRange = aggregateRange;
window.fullDailySeries = fullDailySeries;
window.OPENING_CASH = OPENING_CASH;
window.daysAgo = daysAgo;
window.iso = iso;
