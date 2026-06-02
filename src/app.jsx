// Main app shell — routes between the full BI dashboard and the standalone Input App.

function isInputAppMode() {
  try {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('app') === 'input') return true;
    if (window.location.hash === '#input') return true;
  } catch (e) {}
  return false;
}

function BIApp() {
  const [tab, setTab] = useState('dashboard');
  const [quickOpen, setQuickOpen] = useState(false);

  // Live clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Keyboard shortcut: cmd/ctrl-K opens quick entry, 1..7 switch tabs
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setQuickOpen(true); }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement === document.body) {
        if (e.key === '1') setTab('dashboard');
        if (e.key === '2') setTab('operations');
        if (e.key === '3') setTab('sales');
        if (e.key === '4') setTab('finance');
        if (e.key === '5') setTab('fleet');
        if (e.key === '6') setTab('forecast');
        if (e.key === '7') setTab('admin');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const tabs = [
    { id:'dashboard',  label:'Dashboard', icon: <IconDashboard /> },
    { id:'operations', label:'Operations', icon: <IconOps /> },
    { id:'sales',      label:'Sales',      icon: <IconSales /> },
    { id:'finance',    label:'Finance',    icon: <IconFinance /> },
    { id:'fleet',      label:'Fleet',      icon: <IconFleet /> },
    { id:'forecast',   label:'Forecast',   icon: <IconForecast /> },
    { id:'admin',      label:'Admin',      icon: <IconAdmin /> },
  ];

  const openInputApp = () => { window.location.search = '?app=input'; };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-logo">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" stroke="white" strokeWidth="2" fill="none" />
              <path d="M16 10 L22 13 L22 19 L16 22 L10 19 L10 13 Z" fill="white" fillOpacity="0.95" />
              <circle cx="16" cy="16" r="2.5" fill="#047857" />
            </svg>
          </div>
          <div>
            <h1 className="brand-name">CARBONCHIP</h1>
            <div className="brand-sub">Forestry BI · v2.0 · admin</div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap: 24 }}>
          <SearchBar />
        </div>

        <div className="header-right">
          <div className="header-meta">
            <div><b>{now.toLocaleDateString('en-AU', { weekday:'short', day:'2-digit', month:'short' })}</b></div>
            <div style={{ fontFamily:'var(--mono)', fontVariantNumeric:'tabular-nums', color:'var(--text)' }}>{now.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false })}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <button className="btn" title="Open the simple field/ops Input App" onClick={openInputApp}>📝 Input App</button>
            <div style={{ width: 32, height: 32, borderRadius:'50%', background:'linear-gradient(135deg, #c084fc, #6366f1)', display:'grid', placeItems:'center', fontSize: 11, fontWeight: 700, color:'#04100a' }}>MC</div>
            <button className="btn">Sign Out</button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
            data-screen-label={`${tabs.findIndex(x=>x.id===t.id)+1} ${t.label}`}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'dashboard'  && <DashboardTab />}
        {tab === 'operations' && <OperationsTab />}
        {tab === 'sales'      && <SalesTab />}
        {tab === 'finance'    && <FinanceTab />}
        {tab === 'fleet'      && <FleetTab />}
        {tab === 'forecast'   && <ForecastTab />}
        {tab === 'admin'      && <AdminTab />}
      </main>

      <button className="fab" title="Quick Entry (⌘K)" onClick={()=>setQuickOpen(true)}>+</button>

      <div className="statusbar">
        <span><b>● ONLINE</b></span>
        <span className="sep">│</span>
        <span>DB: <b>postgres/au-east-1</b></span>
        <span className="sep">│</span>
        <span>SYNC: <b>{Math.floor(now.getSeconds()/4)}s ago</b></span>
        <span className="sep">│</span>
        <span>USER: <b>mick@carbonchip.au</b></span>
        <span style={{ marginLeft:'auto' }}>
          <span className="code-key">⌘K</span> Quick Entry
          <span style={{ marginLeft: 12 }}><span className="code-key">1-7</span> Tabs</span>
        </span>
      </div>

      {quickOpen && <QuickEntry onClose={()=>setQuickOpen(false)} user={{ id:'u1', name:'Mick Caruana', role:'Admin', email:'mick@carbonchip.au' }} />}

      <Assistant />
    </div>
  );
}

function App() {
  return isInputAppMode() ? <InputApp /> : <BIApp />;
}

function SearchBar() {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: 8,
      background:'var(--bg-2)', border:'1px solid var(--border)',
      borderRadius: 4, padding: '6px 12px',
      width: 380,
      fontSize: 12, color:'var(--text-dim)',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
      </svg>
      <input style={{ background:'transparent', border:'none', outline:'none', color:'var(--text)', flex: 1, fontFamily:'var(--mono)', fontSize: 12 }} placeholder="Search loads, clients, sites, invoices…" />
      <span className="code-key">/</span>
    </div>
  );
}

// ── Icons (inline SVG) ──
const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
    <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
  </svg>
);
const IconOps = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IconSales = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);
const IconFinance = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);
const IconFleet = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);
const IconForecast = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="6" x2="12" y2="12" /><line x1="12" y1="12" x2="16" y2="14" />
  </svg>
);
const IconAdmin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
