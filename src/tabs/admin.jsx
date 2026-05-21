// Admin tab — users, audit log, system settings

function AdminTab() {
  const [section, setSection] = useState('users');
  const items = [
    { id:'users',    icon:'👥', label:'Users',    count: DATA.USERS.length },
    { id:'roles',    icon:'🔐', label:'Roles',    count: DATA.ROLES.length },
    { id:'audit',    icon:'📜', label:'Audit',    count: 24 },
    { id:'settings', icon:'⚙️', label:'Settings', count: null },
  ];
  return (
    <div>
      <Subnav items={items} value={section} onChange={setSection} />
      {section === 'users' && <UsersPanel />}
      {section === 'roles' && <RolesPanel />}
      {section === 'audit' && <AuditPanel />}
      {section === 'settings' && <SettingsPanel />}
    </div>
  );
}

function UsersPanel() {
  return (
    <div className="grid grid-12">
      <div className="span-8">
        <Card title="Users" glyph="👥" right={
          <div style={{ display:'flex', gap:6 }}>
            <input className="input" placeholder="Search…" style={{ fontSize: 11, padding:'5px 10px', width: 160 }} />
            <button className="btn btn-primary">+ Invite User</button>
          </div>
        }>
          <table className="table">
            <thead><tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last seen</th><th></th>
            </tr></thead>
            <tbody>
              {DATA.USERS.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius:'50%', background:`linear-gradient(135deg, var(--${['green','cyan','amber','purple','blue','orange'][u.id.charCodeAt(1) % 6]}), var(--green-deep))`, display:'grid', placeItems:'center', fontSize: 11, fontWeight: 600, color:'#04100a' }}>
                        {u.name.split(' ').map(n=>n[0]).join('')}
                      </div>
                      <span>{u.name}</span>
                    </div>
                  </td>
                  <td className="muted">{u.email}</td>
                  <td><Pill tone={u.role === 'Admin' ? 'purple' : u.role === 'Driver' ? 'blue' : u.role === 'Finance' ? 'amber' : 'cyan'}>{u.role}</Pill></td>
                  <td>{u.status === 'active' ? <Pill tone="green"><Dot tone="green"/>ACTIVE</Pill> : <Pill tone="muted">INACTIVE</Pill>}</td>
                  <td className="muted">{u.last}</td>
                  <td>
                    <button className="btn btn-ghost" style={{ fontSize: 10 }}>EDIT</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <div className="span-4">
        <Card title="Access by role" glyph="🔑">
          <div style={{ display:'flex', flexDirection: 'column', gap: 8 }}>
            {DATA.ROLES.map(r => {
              const count = DATA.USERS.filter(u => u.role === r).length;
              return (
                <div key={r} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border-soft)' }}>
                  <span>{r}</span>
                  <span className="muted" style={{ fontVariantNumeric:'tabular-nums' }}>{count} {count === 1 ? 'user' : 'users'}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Login activity · 7d" glyph="📈">
          <Sparkline values={[12,14,11,18,16,9,15]} color="#4ade80" height={56} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop: 10, fontSize: 11, color:'var(--text-dim)' }}>
            <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function RolesPanel() {
  const tabs = ['Dashboard','Operations','Sales','Finance','Fleet','Forecast','Admin','Input App','Trip Plan'];
  const matrix = {
    'Admin':       'R W R W R W R W R W R W R W R W R W'.split(' '),
    'Ops Mgr':     'R R R R R R - - R R R R - - R W R W'.split(' '),
    'Finance':     'R R - - R R R W - - R R - - R W - -'.split(' '),
    'Driver':      'R R - - - - - - - - - - - - R W - -'.split(' '),
    'Mill Op':     'R - R W - - - - - - - - - - R W - -'.split(' '),
    'Grinder Op':  'R - R W - - - - - - - - - - R W - -'.split(' '),
    'Planter Op':  'R - R W - - - - - - - - - - R W - -'.split(' '),
    'Excavator Op':'R - R W - - - - - - - - - - R W - -'.split(' '),
    'Viewer':      'R - R - R - R - R - R - - - - - - -'.split(' '),
  };
  return (
    <Card title="Permissions Matrix" glyph="🔐" right={<button className="btn btn-primary">+ New Role</button>}>
      <table className="table">
        <thead><tr><th>Role</th>{tabs.map(t => <th key={t} style={{ textAlign:'center' }}>{t}</th>)}</tr></thead>
        <tbody>
          {Object.entries(matrix).map(([role, perms]) => (
            <tr key={role}>
              <td><Pill tone={role === 'Admin' ? 'purple' : role === 'Driver' ? 'blue' : role === 'Finance' ? 'amber' : role === 'Viewer' ? 'muted' : 'cyan'}>{role}</Pill></td>
              {Array.from({ length: tabs.length }).map((_, i) => {
                const read = perms[i*2];
                const write = perms[i*2 + 1];
                return (
                  <td key={i} style={{ textAlign:'center' }}>
                    {read === 'R' && <span style={{ color:'var(--green)', fontWeight: 600, marginRight: 4 }}>R</span>}
                    {write === 'W' && <span style={{ color:'var(--cyan)', fontWeight: 600 }}>W</span>}
                    {read === '-' && write === '-' && <span style={{ color:'var(--text-faint)' }}>—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color:'var(--text-dim)', marginTop: 12 }}>
        <span style={{ color:'var(--green)' }}>R</span> read · <span style={{ color:'var(--cyan)' }}>W</span> write/edit · — no access
      </div>
    </Card>
  );
}

function summarizeInputEntry(e) {
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

function AuditPanel() {
  const [entries, setEntries] = useState(() => (window.loadInputEntries ? window.loadInputEntries() : []));
  useEffect(() => {
    const refresh = () => setEntries(window.loadInputEntries ? window.loadInputEntries() : []);
    window.addEventListener('input-entry-saved', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('input-entry-saved', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const inputAppEvents = entries.map(e => ({
    ts: new Date(e.timestamp),
    time: new Date(e.timestamp).toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit', hour12:false }),
    date: new Date(e.timestamp).toLocaleDateString('en-AU', { day:'2-digit', month:'short' }),
    user: e.userName,
    role: e.userRole,
    action: `input · ${e.component}`,
    target: summarizeInputEntry(e),
    tone: 'cyan',
    source: 'INPUT APP',
  }));

  const mockEvents = [
    { time: '14:28', user: 'Mick Caruana',    action: 'approved capex', target: 'Replacement teeth set $4,200',     tone:'green' },
    { time: '14:02', user: 'Sarah Henderson', action: 'edited contract', target: 'Kilcoy · rate $108/t',             tone:'cyan' },
    { time: '13:46', user: 'System',          action: 'flagged',         target: 'BD-02 rego < 30d',                  tone:'amber' },
    { time: '13:18', user: 'Linda Ng',        action: 'reconciled',      target: '3 invoices ($42,800)',              tone:'amber' },
    { time: '12:01', user: 'Jase Williamson', action: 'logged load',     target: 'H1182 · Kilcoy outbound 56t',        tone:'green' },
    { time: '11:30', user: 'Robbie Carter',   action: 'logged shift',    target: 'Grinder · 7.5h · 348 m³',           tone:'red' },
    { time: '10:55', user: 'Tane Ngata',      action: 'logged load',     target: 'H1181 · Searles outbound 52t',      tone:'cyan' },
    { time: '10:12', user: 'Pete Korhonen',   action: 'logged shift',    target: 'Mill · F1 2.4 + M1 1.2 m³',         tone:'purple' },
    { time: '09:44', user: 'Sarah Henderson', action: 'scheduled',       target: 'Trip plan week of 26 May',           tone:'cyan' },
    { time: '09:02', user: 'Mick Caruana',    action: 'login',           target: 'from 203.0.113.18',                  tone:'green' },
    { time: '08:48', user: 'Linda Ng',        action: 'login',           target: 'from 203.0.113.224',                 tone:'green' },
    { time: '08:30', user: 'System',          action: 'cron',            target: 'Daily aggregation completed (180 ms)', tone:'muted' },
    { time: '08:01', user: 'Jase Williamson', action: 'logged load',     target: 'H1180 · inbound biomass Imbil 124m³', tone:'cyan' },
    { time: '07:45', user: 'Aaron Pratt',     action: 'role changed',    target: 'Planter Op → inactive',              tone:'red' },
    { time: '07:20', user: 'System',          action: 'invoice sent',    target: 'INV-1178 · Searles $12,432',         tone:'amber' },
  ];

  const events = [...inputAppEvents, ...mockEvents];

  return (
    <div className="grid grid-12">
      <div className="span-12">
        <Card title="Input App tracking · live" glyph="📥" right={
          <Pill tone={inputAppEvents.length ? 'green' : 'muted'}>
            <Dot tone={inputAppEvents.length ? 'green' : 'muted'} pulse={inputAppEvents.length > 0} />
            {inputAppEvents.length} entr{inputAppEvents.length === 1 ? 'y' : 'ies'} from field staff
          </Pill>
        }>
          {inputAppEvents.length === 0 ? (
            <div style={{ fontSize: 11, color:'var(--text-dim)', textAlign:'center', padding:'18px 0' }}>
              No Input App entries yet. Field staff sign in at <span className="code-key">?app=input</span> to log data — entries will appear here in real time.
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>When</th><th>User</th><th>Role</th><th>Component</th><th>Entry</th></tr></thead>
              <tbody>
                {inputAppEvents.slice(0, 30).map((e, i) => (
                  <tr key={i}>
                    <td className="muted" style={{ fontVariantNumeric:'tabular-nums', whiteSpace:'nowrap' }}>{e.date} {e.time}</td>
                    <td>{e.user}</td>
                    <td><Pill tone="blue">{e.role}</Pill></td>
                    <td><Pill tone="cyan">{e.action.replace('input · ','')}</Pill></td>
                    <td className="muted">{e.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      <div className="span-12">
        <Card title="Audit Log · today" glyph="📜" right={
          <div style={{ display:'flex', gap:6 }}>
            <select className="select" style={{ fontSize:11, padding:'4px 8px' }}><option>Today</option><option>Last 7d</option><option>Last 30d</option></select>
            <button className="btn">Export CSV</button>
          </div>
        }>
          <table className="table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i}>
                  <td className="muted" style={{ fontVariantNumeric:'tabular-nums' }}>{e.time}</td>
                  <td>{e.user}</td>
                  <td><Pill tone={e.tone}>{e.action}</Pill></td>
                  <td>{e.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="grid grid-2">
      <Card title="Business Parameters" glyph="⚙️">
        <Field label="Working days / week"><input className="input" defaultValue="5" /></Field>
        <Field label="Include public holidays" hint="As per business policy">
          <select className="select"><option>Yes</option><option>No</option></select>
        </Field>
        <Field label="Allowance: downtime (days/yr)"><input className="input" defaultValue="10" /></Field>
        <Field label="Timezone"><select className="select"><option>Australia/Brisbane (AEST)</option></select></Field>
        <Field label="Financial year start"><select className="select"><option>1 July</option></select></Field>
      </Card>
      <Card title="Integrations" glyph="🔌">
        <IntegrationRow name="Xero (Accounting)" status="connected" tone="green" />
        <IntegrationRow name="MYOB Payroll"     status="connected" tone="green" />
        <IntegrationRow name="Geotab (Fleet GPS)" status="connected" tone="green" />
        <IntegrationRow name="BP Card (Fuel)"    status="connected" tone="green" />
        <IntegrationRow name="ScaleMaster (Weighbridge)" status="setup" tone="amber" />
        <IntegrationRow name="HubSpot CRM"      status="not configured" tone="muted" />
      </Card>
      <Card title="Notifications" glyph="🔔">
        <NotificationRow label="Daily ops summary" subject="Mick, Sarah" channel="email · 7:00" tone="green" />
        <NotificationRow label="Weekly cashflow"   subject="Mick, Linda" channel="email · Mon 8:00" tone="green" />
        <NotificationRow label="Rego expiry < 30d" subject="Mick"        channel="email + SMS"     tone="amber" />
        <NotificationRow label="Stock at capacity" subject="Sarah"       channel="in-app"          tone="cyan" />
        <NotificationRow label="Invoice overdue"    subject="Linda"      channel="email · daily"   tone="red" />
      </Card>
      <Card title="Data Retention" glyph="🗄️">
        <Field label="Operations logs"><select className="select"><option>Forever</option></select></Field>
        <Field label="Audit log"><select className="select"><option>7 years</option></select></Field>
        <Field label="Telemetry"><select className="select"><option>90 days</option></select></Field>
        <Field label="Backup cadence"><select className="select"><option>Daily 02:00 UTC</option></select></Field>
        <div className="divider" />
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn">Run Backup Now</button>
          <button className="btn">Download Snapshot</button>
        </div>
      </Card>
    </div>
  );
}

function IntegrationRow({ name, status, tone }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border-soft)' }}>
      <span style={{ fontSize: 12 }}>{name}</span>
      <Pill tone={tone}>{tone === 'green' ? <Dot tone="green" pulse /> : null} {status}</Pill>
    </div>
  );
}
function NotificationRow({ label, subject, channel, tone }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8, padding:'10px 0', borderBottom:'1px solid var(--border-soft)' }}>
      <div>
        <div style={{ fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: 10, color:'var(--text-dim)' }}>to {subject}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <Pill tone={tone}>{channel}</Pill>
      </div>
    </div>
  );
}

window.AdminTab = AdminTab;
