// Quick Entry — the input app for the BI system.
// Two modes:
//   • Modal mode (default): used inside the BI dashboard via FAB / ⌘K.
//   • Standalone "Input App" mode: full-screen, no dashboard, used by field/ops staff
//     who only need to log entries. Each save is persisted to localStorage under the
//     signed-in user so admins can track who entered what.

const ENTRY_STORE_KEY = 'carbonchip.inputEntries.v1';

function loadEntries() {
  try {
    const raw = localStorage.getItem(ENTRY_STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function saveEntry(entry) {
  const all = loadEntries();
  all.unshift(entry);
  try { localStorage.setItem(ENTRY_STORE_KEY, JSON.stringify(all.slice(0, 500))); } catch (e) {}
  return all;
}
window.loadInputEntries = loadEntries;
window.INPUT_STORE_KEY = ENTRY_STORE_KEY;

const SECTIONS = [
  { id: 'haulage',    label: 'Haulage',    icon: '🚛' },
  { id: 'planter',    label: 'Planter',    icon: '🌱' },
  { id: 'excavator',  label: 'Excavator',  icon: '🚜' },
  { id: 'grinder',    label: 'Grinder',    icon: '⚙️' },
  { id: 'carbonator', label: 'Carbonator', icon: '🔥' },
  { id: 'mill',       label: 'Mill',       icon: '🪵' },
  { id: 'stock',      label: 'Stock',      icon: '📦' },
  { id: 'cost',       label: 'Cost',       icon: '💸' },
];

// ───────────────────────────────────────────────────────────────────
// Form components — each gathers its own state and exposes via ref
// ───────────────────────────────────────────────────────────────────

function useFieldState(initial) {
  const [state, setState] = useState(initial);
  const set = (k, v) => setState(s => ({ ...s, [k]: v }));
  return [state, set, setState];
}

function HaulageForm({ onChange }) {
  const [s, set] = useFieldState({
    direction: 'outbound',
    date: iso(new Date()),
    time: '07:30',
    party: DATA.CLIENTS[0]?.name || '',
    trailer: 'B-Double',
    truck: DATA.FLEET.find(f=>f.type==='B-Double')?.id || '',
    product: DATA.PRODUCTS[0]?.name || '',
    driver: (DATA.USERS.find(u=>u.role==='Driver')?.name) || '',
    tonnes: '', m3: '',
    notes: '',
  });
  useEffect(() => { onChange && onChange(s); }, [s]);
  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {['outbound','inbound'].map(d => (
          <button key={d}
            type="button"
            onClick={()=>set('direction', d)}
            className="btn"
            style={s.direction===d ? { background:'var(--surface-3)', borderColor:'var(--green-dim)', color:'var(--green-bright)' } : {}}
          >
            {d === 'outbound' ? '↗ Outbound' : '↙ Inbound'}
          </button>
        ))}
      </div>
      <div className="grid grid-2">
        <Field label="Date"><input type="date" className="input" value={s.date} onChange={e=>set('date', e.target.value)} /></Field>
        <Field label="Time"><input type="time" className="input" value={s.time} onChange={e=>set('time', e.target.value)} /></Field>
        <Field label={s.direction === 'outbound' ? 'Client / To' : 'From Site'}>
          <select className="select" value={s.party} onChange={e=>set('party', e.target.value)}>
            {s.direction === 'outbound'
              ? DATA.CLIENTS.map(c => <option key={c.id}>{c.name}</option>)
              : DATA.SITES.filter(x=>x.id!=='yard').map(x => <option key={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label={s.direction === 'outbound' ? 'From' : 'To'}>
          <select className="select"><option>Yard / Depot</option></select>
        </Field>
        <Field label="Trailer Type">
          <select className="select" value={s.trailer} onChange={e=>set('trailer', e.target.value)}>
            <option>B-Double</option><option>Walking Floor</option><option>Tipper</option><option>Pole Trailer</option>
          </select>
        </Field>
        <Field label="Truck">
          <select className="select" value={s.truck} onChange={e=>set('truck', e.target.value)}>
            {DATA.FLEET.filter(f=>f.type==='B-Double').map(f => <option key={f.id} value={f.id}>{f.id} · {f.plate}</option>)}
          </select>
        </Field>
        <Field label="Product Type">
          <select className="select" value={s.product} onChange={e=>set('product', e.target.value)}>
            {DATA.PRODUCTS.map(p => <option key={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Driver">
          <select className="select" value={s.driver} onChange={e=>set('driver', e.target.value)}>
            {DATA.USERS.filter(u=>u.role==='Driver').map(u => <option key={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Tonnes"><input type="number" className="input" placeholder="56.0" step="0.1" value={s.tonnes} onChange={e=>set('tonnes', e.target.value)} /></Field>
        <Field label="m³"><input type="number" className="input" placeholder="120.0" step="0.1" value={s.m3} onChange={e=>set('m3', e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" rows="2" placeholder="Optional notes…" value={s.notes} onChange={e=>set('notes', e.target.value)} /></Field>
    </div>
  );
}

function PlanterForm({ onChange }) {
  const [s, set] = useFieldState({
    date: iso(new Date()),
    site: DATA.SITES.find(x=>x.id!=='yard')?.name || '',
    hectares: '', seedlings: '', hours: '',
    operator: (DATA.USERS.find(u=>u.role==='Planter Op'||u.role==='Admin')?.name) || '',
    notes: '',
  });
  useEffect(() => { onChange && onChange(s); }, [s]);
  return (
    <div>
      <div className="grid grid-2">
        <Field label="Date"><input type="date" className="input" value={s.date} onChange={e=>set('date', e.target.value)} /></Field>
        <Field label="Site">
          <select className="select" value={s.site} onChange={e=>set('site', e.target.value)}>
            {DATA.SITES.filter(x=>x.id!=='yard').map(x=><option key={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="Hectares Planted"><input type="number" className="input" placeholder="3.2" step="0.1" value={s.hectares} onChange={e=>set('hectares', e.target.value)} /></Field>
        <Field label="# of Seedlings"><input type="number" className="input" placeholder="3800" value={s.seedlings} onChange={e=>set('seedlings', e.target.value)} /></Field>
        <Field label="Operating Time (h)"><input type="number" className="input" placeholder="7.2" step="0.1" value={s.hours} onChange={e=>set('hours', e.target.value)} /></Field>
        <Field label="Operator">
          <select className="select" value={s.operator} onChange={e=>set('operator', e.target.value)}>
            {DATA.USERS.filter(u=>u.role==='Planter Op'||u.role==='Admin').map(u=><option key={u.id}>{u.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Notes"><textarea className="textarea" rows="2" placeholder="Conditions, species, observations…" value={s.notes} onChange={e=>set('notes', e.target.value)} /></Field>
    </div>
  );
}

function ExcavatorForm({ onChange }) {
  const [s, set] = useFieldState({
    date: iso(new Date()),
    site: DATA.SITES.find(x=>x.id!=='yard')?.name || '',
    hours: '', rate: 220, notes: '',
  });
  useEffect(() => { onChange && onChange(s); }, [s]);
  return (
    <div>
      <div className="grid grid-2">
        <Field label="Date"><input type="date" className="input" value={s.date} onChange={e=>set('date', e.target.value)} /></Field>
        <Field label="Site"><select className="select" value={s.site} onChange={e=>set('site', e.target.value)}>{DATA.SITES.filter(x=>x.id!=='yard').map(x=><option key={x.id}>{x.name}</option>)}</select></Field>
        <Field label="Operating Hours"><input type="number" className="input" placeholder="8.0" step="0.1" value={s.hours} onChange={e=>set('hours', e.target.value)} /></Field>
        <Field label="Wet-Hire Rate ($/h)"><input type="number" className="input" placeholder="220" value={s.rate} onChange={e=>set('rate', e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" rows="2" placeholder="Task type, attachment, observations…" value={s.notes} onChange={e=>set('notes', e.target.value)} /></Field>
    </div>
  );
}

function GrinderForm({ onChange }) {
  const [s, set] = useFieldState({
    date: iso(new Date()),
    operator: DATA.USERS.find(u=>u.role==='Grinder Op')?.name || '',
    hours: '', throughput: '', product: 'Chip', source: 'Biomass — Yard',
  });
  useEffect(() => { onChange && onChange(s); }, [s]);
  return (
    <div className="grid grid-2">
      <Field label="Date"><input type="date" className="input" value={s.date} onChange={e=>set('date', e.target.value)} /></Field>
      <Field label="Operator">
        <select className="select" value={s.operator} onChange={e=>set('operator', e.target.value)}>
          {DATA.USERS.filter(u=>u.role==='Grinder Op').map(u=><option key={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <Field label="Operating Hours"><input type="number" className="input" placeholder="7.5" step="0.1" value={s.hours} onChange={e=>set('hours', e.target.value)} /></Field>
      <Field label="Throughput (m³)"><input type="number" className="input" placeholder="320" value={s.throughput} onChange={e=>set('throughput', e.target.value)} /></Field>
      <Field label="Product Out">
        <select className="select" value={s.product} onChange={e=>set('product', e.target.value)}><option>Chip</option><option>Microchip</option><option>Re-grind</option></select>
      </Field>
      <Field label="Source"><select className="select" value={s.source} onChange={e=>set('source', e.target.value)}><option>Biomass — Yard</option><option>Logs — Yard</option></select></Field>
    </div>
  );
}

function CarbonatorForm({ onChange }) {
  const [s, set] = useFieldState({
    date: iso(new Date()),
    operator: DATA.USERS[0]?.name || '',
    hours: '', throughput: '',
  });
  useEffect(() => { onChange && onChange(s); }, [s]);
  return (
    <div className="grid grid-2">
      <Field label="Date"><input type="date" className="input" value={s.date} onChange={e=>set('date', e.target.value)} /></Field>
      <Field label="Operator"><select className="select" value={s.operator} onChange={e=>set('operator', e.target.value)}>{DATA.USERS.map(u=><option key={u.id}>{u.name}</option>)}</select></Field>
      <Field label="Operating Hours"><input type="number" className="input" placeholder="6.0" step="0.1" value={s.hours} onChange={e=>set('hours', e.target.value)} /></Field>
      <Field label="Throughput (t carbon)"><input type="number" className="input" placeholder="1.2" step="0.01" value={s.throughput} onChange={e=>set('throughput', e.target.value)} /></Field>
    </div>
  );
}

function MillForm({ onChange }) {
  const [s, set] = useFieldState({
    date: iso(new Date()),
    operator: DATA.USERS.find(u=>u.role==='Mill Op')?.name || '',
    F1: '', F2: '', M1: '', C1: '',
  });
  useEffect(() => { onChange && onChange(s); }, [s]);
  return (
    <div>
      <div className="grid grid-2">
        <Field label="Date"><input type="date" className="input" value={s.date} onChange={e=>set('date', e.target.value)} /></Field>
        <Field label="Operator">
          <select className="select" value={s.operator} onChange={e=>set('operator', e.target.value)}>
            {DATA.USERS.filter(u=>u.role==='Mill Op').map(u=><option key={u.id}>{u.name}</option>)}
          </select>
        </Field>
      </div>
      <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:8, marginBottom:6 }}>Throughput by size (m³)</div>
      <div className="grid grid-4">
        {['F1','F2','M1','C1'].map(sz => (
          <Field key={sz} label={sz}><input type="number" className="input" placeholder="0.0" step="0.1" value={s[sz]} onChange={e=>set(sz, e.target.value)} /></Field>
        ))}
      </div>
    </div>
  );
}

function StockForm({ onChange }) {
  const [s, set] = useFieldState({
    date: iso(new Date()),
    type: 'Adjustment (count)',
    product: DATA.PRODUCTS[0]?.name || '',
    location: 'Yard Bay A',
    m3: '', reason: '',
  });
  useEffect(() => { onChange && onChange(s); }, [s]);
  return (
    <div>
      <div className="grid grid-2">
        <Field label="Date"><input type="date" className="input" value={s.date} onChange={e=>set('date', e.target.value)} /></Field>
        <Field label="Type">
          <select className="select" value={s.type} onChange={e=>set('type', e.target.value)}><option>Adjustment (count)</option><option>Receipt (in)</option><option>Issue (out)</option></select>
        </Field>
        <Field label="Product"><select className="select" value={s.product} onChange={e=>set('product', e.target.value)}>{DATA.PRODUCTS.map(p=><option key={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Location"><select className="select" value={s.location} onChange={e=>set('location', e.target.value)}><option>Yard Bay A</option><option>Yard Bay B</option><option>Yard Bay C</option><option>Bin 3</option><option>Bin 4</option><option>Carbon Shed</option><option>Log Deck</option><option>Tip Pad</option></select></Field>
        <Field label="m³"><input type="number" className="input" placeholder="0" step="0.1" value={s.m3} onChange={e=>set('m3', e.target.value)} /></Field>
        <Field label="Reason"><input type="text" className="input" placeholder="e.g. weekly count" value={s.reason} onChange={e=>set('reason', e.target.value)} /></Field>
      </div>
    </div>
  );
}

function CostForm({ onChange }) {
  const [s, set] = useFieldState({
    date: iso(new Date()),
    category: 'Fuel',
    component: 'haulage',
    vendor: '', amount: '', ref: '', notes: '',
  });
  useEffect(() => { onChange && onChange(s); }, [s]);
  return (
    <div>
      <div className="grid grid-2">
        <Field label="Date"><input type="date" className="input" value={s.date} onChange={e=>set('date', e.target.value)} /></Field>
        <Field label="Category"><select className="select" value={s.category} onChange={e=>set('category', e.target.value)}>
          {['Repairs & Maint','Tyres & Lubes','Parts','Servicing','Fuel','Wages','Insurance','Loans','Registration','Teeth & Grates','Power','Rent','Safety Equip','Gen Business'].map(c=><option key={c}>{c}</option>)}
        </select></Field>
        <Field label="Component"><select className="select" value={s.component} onChange={e=>set('component', e.target.value)}>
          {['planter','excavator','haulage','grinder','carbonator','mill','overhead'].map(c=><option key={c} style={{textTransform:'capitalize'}}>{c}</option>)}
        </select></Field>
        <Field label="Vendor"><input type="text" className="input" placeholder="e.g. BP Card" value={s.vendor} onChange={e=>set('vendor', e.target.value)} /></Field>
        <Field label="Amount ($)"><input type="number" className="input" placeholder="0.00" step="0.01" value={s.amount} onChange={e=>set('amount', e.target.value)} /></Field>
        <Field label="Ref / Invoice #"><input type="text" className="input" placeholder="INV-…" value={s.ref} onChange={e=>set('ref', e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="textarea" rows="2" value={s.notes} onChange={e=>set('notes', e.target.value)} /></Field>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Shared body — used by both modal and standalone Input App
// ───────────────────────────────────────────────────────────────────

function EntryFormBody({ tab, onTabChange, payloadRef }) {
  const handleChange = (data) => { payloadRef.current = data; };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 18, minHeight: 380 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', padding: '6px 10px' }}>Component</div>
        {SECTIONS.map(sec => (
          <button key={sec.id} type="button"
            onClick={() => { payloadRef.current = null; onTabChange(sec.id); }}
            style={{
              display:'flex', alignItems:'center', gap:10,
              padding: '9px 10px',
              background: tab === sec.id ? 'var(--surface-3)' : 'transparent',
              border: 'none',
              borderLeft: tab === sec.id ? '2px solid var(--green)' : '2px solid transparent',
              color: tab === sec.id ? 'var(--green-bright)' : 'var(--text-dim)',
              cursor: 'pointer',
              fontFamily:'var(--mono)', fontSize:12,
              textAlign:'left',
              borderRadius: 0,
            }}
          >
            <span>{sec.icon}</span>
            <span>{sec.label}</span>
          </button>
        ))}
      </div>

      <div>
        {tab === 'haulage'    && <HaulageForm    key={tab} onChange={handleChange} />}
        {tab === 'planter'    && <PlanterForm    key={tab} onChange={handleChange} />}
        {tab === 'excavator'  && <ExcavatorForm  key={tab} onChange={handleChange} />}
        {tab === 'grinder'    && <GrinderForm    key={tab} onChange={handleChange} />}
        {tab === 'carbonator' && <CarbonatorForm key={tab} onChange={handleChange} />}
        {tab === 'mill'       && <MillForm       key={tab} onChange={handleChange} />}
        {tab === 'stock'      && <StockForm      key={tab} onChange={handleChange} />}
        {tab === 'cost'       && <CostForm       key={tab} onChange={handleChange} />}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Modal version (admin / dashboard users)
// ───────────────────────────────────────────────────────────────────

function QuickEntry({ onClose, user }) {
  const [tab, setTab] = useState('haulage');
  const [savedFlash, setSavedFlash] = useState(false);
  const payloadRef = useRef(null);

  const handleSave = () => {
    const entry = {
      id: 'IE-' + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      userId: user?.id || 'u1',
      userName: user?.name || 'Mick Caruana',
      userRole: user?.role || 'Admin',
      component: tab,
      payload: payloadRef.current || {},
    };
    saveEntry(entry);
    setSavedFlash(true);
    setTimeout(() => { setSavedFlash(false); onClose(); }, 900);
  };

  return (
    <Modal
      title="Quick Entry · Input App"
      onClose={onClose}
      width={760}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {savedFlash ? '✓ Saved' : 'Save Entry'}
          </button>
        </>
      }
    >
      <EntryFormBody tab={tab} onTabChange={setTab} payloadRef={payloadRef} />
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────────────
// Standalone Input App — sign in + full-screen form, no dashboard access
// ───────────────────────────────────────────────────────────────────

const SIGNED_IN_KEY = 'carbonchip.inputApp.user.v1';

function loadSignedInUser() {
  try {
    const raw = localStorage.getItem(SIGNED_IN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function InputAppSignIn({ onSignIn }) {
  const [pickedId, setPickedId] = useState('');
  const [pin, setPin] = useState('');
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'grid', placeItems:'center', padding: 24 }}>
      <div style={{ width:'100%', maxWidth: 420 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12, marginBottom: 24, justifyContent:'center' }}>
          <div className="brand-logo" style={{ width: 56, height: 56 }}>
            <svg viewBox="0 0 32 32" fill="none" width="56" height="56">
              <path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" stroke="#4ade80" strokeWidth="2" fill="none" />
              <path d="M16 10 L22 13 L22 19 L16 22 L10 19 L10 13 Z" fill="#4ade80" fillOpacity="0.95" />
              <circle cx="16" cy="16" r="2.5" fill="#04100a" />
            </svg>
          </div>
          <div>
            <h1 style={{ margin:0, fontFamily:'var(--display)', color:'var(--green-bright)', fontSize: 22 }}>CARBONCHIP</h1>
            <div style={{ fontFamily:'var(--mono)', fontSize: 11, color:'var(--text-dim)', letterSpacing: 1 }}>INPUT APP · v2.0</div>
          </div>
        </div>

        <Card title="Sign in to log entries" glyph="🔐">
          <Field label="Who's logging in?">
            <select className="select" value={pickedId} onChange={e=>setPickedId(e.target.value)}>
              <option value="">— Select your name —</option>
              {DATA.USERS.filter(u=>u.status==='active').map(u =>
                <option key={u.id} value={u.id}>{u.name} · {u.role}</option>
              )}
            </select>
          </Field>
          <Field label="Site PIN" hint="Ask your supervisor — default 0000 for demo">
            <input className="input" type="password" inputMode="numeric" placeholder="••••" value={pin} onChange={e=>setPin(e.target.value)} />
          </Field>
          <div style={{ display:'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!pickedId}
              onClick={() => {
                const user = DATA.USERS.find(u => u.id === pickedId);
                if (!user) return;
                try { localStorage.setItem(SIGNED_IN_KEY, JSON.stringify({ id:user.id, name:user.name, role:user.role, email:user.email, signedInAt: new Date().toISOString() })); } catch (e) {}
                onSignIn(user);
              }}>
              Start Logging Entries →
            </button>
          </div>
          <div style={{ fontSize: 10, color:'var(--text-dim)', marginTop: 14, textAlign:'center' }}>
            You'll only see the entry form. Dashboard, reports and admin are not visible from here.
          </div>
        </Card>
      </div>
    </div>
  );
}

function MyRecentEntries({ user }) {
  const [entries, setEntries] = useState(() => loadEntries().filter(e => e.userId === user.id).slice(0, 8));
  useEffect(() => {
    const handler = () => setEntries(loadEntries().filter(e => e.userId === user.id).slice(0, 8));
    window.addEventListener('input-entry-saved', handler);
    return () => window.removeEventListener('input-entry-saved', handler);
  }, [user.id]);

  if (entries.length === 0) {
    return <div style={{ fontSize: 11, color:'var(--text-dim)', textAlign:'center', padding: '14px 0' }}>No entries yet. Your saved entries will appear here.</div>;
  }

  return (
    <table className="table" style={{ fontSize: 11 }}>
      <thead><tr><th>Time</th><th>Type</th><th>Summary</th></tr></thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.id}>
            <td className="muted" style={{ whiteSpace:'nowrap' }}>{new Date(e.timestamp).toLocaleString('en-AU', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
            <td><Pill tone="cyan">{e.component}</Pill></td>
            <td className="muted">{summarizeEntry(e)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function summarizeEntry(e) {
  const p = e.payload || {};
  switch (e.component) {
    case 'haulage':    return `${p.direction || ''} · ${p.party || ''} · ${p.tonnes || '–'}t / ${p.m3 || '–'}m³`;
    case 'planter':    return `${p.site || ''} · ${p.hectares || '–'}ha · ${p.seedlings || '–'} seedlings`;
    case 'excavator':  return `${p.site || ''} · ${p.hours || '–'}h @ $${p.rate || 220}/h`;
    case 'grinder':    return `${p.hours || '–'}h · ${p.throughput || '–'}m³ ${p.product || ''}`;
    case 'carbonator': return `${p.hours || '–'}h · ${p.throughput || '–'}t carbon`;
    case 'mill':       return ['F1','F2','M1','C1'].map(s => p[s] ? `${s}:${p[s]}` : null).filter(Boolean).join(' · ') || '—';
    case 'stock':      return `${p.type || ''} · ${p.product || ''} · ${p.m3 || '–'}m³ @ ${p.location || ''}`;
    case 'cost':       return `${p.category || ''} · ${p.component || ''} · $${p.amount || '–'}`;
    default: return '';
  }
}

function InputAppShell({ user, onSignOut }) {
  const [tab, setTab] = useState('haulage');
  const [savedFlash, setSavedFlash] = useState(false);
  const [now, setNow] = useState(new Date());
  const payloadRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSave = () => {
    const entry = {
      id: 'IE-' + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      component: tab,
      payload: payloadRef.current || {},
    };
    saveEntry(entry);
    payloadRef.current = null;
    setSavedFlash(true);
    window.dispatchEvent(new CustomEvent('input-entry-saved'));
    setTimeout(() => setSavedFlash(false), 1400);
    // Force the active form to remount so its fields reset for the next entry.
    const cur = tab;
    setTab('_reset_');
    setTimeout(() => setTab(cur), 0);
  };

  return (
    <div className="app" style={{ gridTemplateRows: 'auto 1fr auto' }}>
      <header className="header" style={{ gridTemplateColumns: '1fr auto' }}>
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
            <div className="brand-sub">Input App · {user.role}</div>
          </div>
        </div>

        <div className="header-right">
          <div className="header-meta">
            <div><b>{now.toLocaleDateString('en-AU', { weekday:'short', day:'2-digit', month:'short' })}</b></div>
            <div style={{ fontFamily:'var(--mono)', color:'var(--text)' }}>{now.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', hour12: false })}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius:'50%', background:'linear-gradient(135deg, #4ade80, #06b6d4)', display:'grid', placeItems:'center', fontSize: 11, fontWeight: 700, color:'#04100a' }}>
              {user.name.split(' ').map(n=>n[0]).join('')}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', lineHeight: 1.1 }}>
              <span style={{ fontSize: 12 }}>{user.name}</span>
              <span style={{ fontSize: 10, color:'var(--text-dim)' }}>{user.email}</span>
            </div>
            <button className="btn" onClick={onSignOut}>Sign Out</button>
          </div>
        </div>
      </header>

      <main className="main" style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap: 18, alignItems:'start' }}>
        <Card
          title="Log a new entry"
          glyph="📝"
          right={
            <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
              {savedFlash && <Pill tone="green"><Dot tone="green" pulse /> Saved · attributed to {user.name}</Pill>}
              <button className="btn btn-primary" onClick={handleSave}>
                {savedFlash ? '✓ Saved' : 'Save Entry'}
              </button>
            </div>
          }
        >
          {tab !== '_reset_' && <EntryFormBody tab={tab} onTabChange={setTab} payloadRef={payloadRef} />}
        </Card>

        <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
          <Card title="Signed in as" glyph="👤">
            <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius:'50%', background:'linear-gradient(135deg, #4ade80, #06b6d4)', display:'grid', placeItems:'center', fontSize: 14, fontWeight: 700, color:'#04100a' }}>
                {user.name.split(' ').map(n=>n[0]).join('')}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: 11, color:'var(--text-dim)' }}>{user.role} · {user.email}</div>
              </div>
            </div>
            <div className="divider" style={{ margin: '12px 0 6px' }} />
            <div style={{ fontSize: 10, color:'var(--text-dim)' }}>
              Every entry you save is timestamped and attributed to your user for admin tracking.
            </div>
          </Card>

          <Card title="My recent entries" glyph="📜">
            <MyRecentEntries user={user} />
          </Card>
        </div>
      </main>

      <div className="statusbar">
        <span><b>● ONLINE</b></span>
        <span className="sep">│</span>
        <span>MODE: <b>INPUT APP</b></span>
        <span className="sep">│</span>
        <span>USER: <b>{user.email}</b></span>
        <span style={{ marginLeft:'auto' }}>
          Entries are stored locally and synced to the dashboard for admins.
        </span>
      </div>
    </div>
  );
}

function InputApp() {
  const [user, setUser] = useState(() => loadSignedInUser());
  const handleSignOut = () => {
    try { localStorage.removeItem(SIGNED_IN_KEY); } catch (e) {}
    setUser(null);
  };
  if (!user) return <InputAppSignIn onSignIn={setUser} />;
  return <InputAppShell user={user} onSignOut={handleSignOut} />;
}

window.QuickEntry = QuickEntry;
window.InputApp = InputApp;
