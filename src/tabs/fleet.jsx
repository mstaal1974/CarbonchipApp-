// Fleet tab — vehicles, R&M log, fuel, registration, repair+usage calendar

// ─── Fleet Calendar: daily repairs (risk) + usage (productivity) ──────────
function isRM(c) {
  return c.category.includes('Repair') || c.category.includes('Tyres') || c.category.includes('Teeth');
}

// Usage sources, mapped to fleet assets. `hrs` → operating hours; `val`/`unit`
// → headline productivity figure; `countLoads` → haulage load tally.
const USAGE_SRC = [
  { key:'haulage',    label:'Haulage · B-Doubles', glyph:'🚛', logs:()=>DATA.haulageLogs,    val:l=>l.units,      unit:'m³ hauled', countLoads:true },
  { key:'excavator',  label:'Excavator',           glyph:'🪏', logs:()=>DATA.excavatorLogs,  hrs:l=>l.hours },
  { key:'grinder',    label:'Grinder',             glyph:'🪵', logs:()=>DATA.grinderLogs,    hrs:l=>l.hours,      val:l=>l.throughput, unit:'m³ chip' },
  { key:'carbonator', label:'Carbonator',          glyph:'🔥', logs:()=>DATA.carbonatorLogs, hrs:l=>l.hours,      val:l=>l.throughput, unit:'t carbon' },
  { key:'planter',    label:'Planter',             glyph:'🌱', logs:()=>DATA.planterLogs,    hrs:l=>l.hours,      val:l=>l.hectares,   unit:'ha planted' },
  { key:'mill',       label:'Mill',                glyph:'🪚', logs:()=>DATA.millLogs,        val:l=>l.m3,         unit:'m³ milled' },
];
const PLANT_COUNT = USAGE_SRC.length;

const HEAT = ['rgba(16,185,129,0.10)','rgba(16,185,129,0.22)','rgba(16,185,129,0.34)','rgba(16,185,129,0.46)','rgba(16,185,129,0.60)'];
function heatColor(util) { // util 0..1
  if (util <= 0) return 'transparent';
  return HEAT[Math.min(HEAT.length - 1, Math.floor(util * HEAT.length))];
}

function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function FleetCalendar() {
  const today0 = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [month, setMonth] = useState(() => new Date(today0.getFullYear(), today0.getMonth(), 1));
  const [sel, setSel] = useState(null);

  // Build once: usage + repairs + rego indexed by iso date.
  const idx = useMemo(() => {
    const usage = {}, rm = {}, reg = {};
    const ensure = (d) => usage[d] || (usage[d] = { hours:0, loads:0, active:new Set(), src:{} });
    USAGE_SRC.forEach(s => s.logs().forEach(l => {
      const o = ensure(l.date);
      const rec = o.src[s.key] || (o.src[s.key] = { label:s.label, glyph:s.glyph, count:0, hours:0, val:0, unit:s.unit });
      rec.count++; o.active.add(s.key);
      if (s.hrs) { const h = s.hrs(l) || 0; rec.hours += h; o.hours += h; }
      if (s.val) rec.val += (s.val(l) || 0);
      if (s.countLoads) o.loads++;
    }));
    DATA.costLogs.filter(isRM).forEach(c => {
      const o = rm[c.date] || (rm[c.date] = { count:0, total:0, items:[] });
      o.count++; o.total += c.amount; o.items.push(c);
    });
    DATA.FLEET.forEach(f => { if (f.regExpiry) { const k = iso(f.regExpiry); (reg[k] || (reg[k] = [])).push(f); } });
    return { usage, rm, reg };
  }, []);

  const cells = useMemo(() => monthMatrix(month.getFullYear(), month.getMonth()), [month]);
  const monthLabel = month.toLocaleDateString('en-AU', { month:'long', year:'numeric' });
  const atCurrentMonth = month.getFullYear() === today0.getFullYear() && month.getMonth() === today0.getMonth();

  // Visible-month rollup for productivity + risk insights.
  const stats = useMemo(() => {
    let rmTotal = 0, rmCount = 0, hours = 0, activeDays = 0, idleWeekdays = 0;
    const out = { carbon:0, chip:0, milled:0, hauledM3:0, loads:0 };
    const regDue = [];
    cells.forEach(c => {
      if (!c) return;
      const k = iso(c);
      const u = idx.usage[k], m = idx.rm[k], g = idx.reg[k];
      if (m) { rmTotal += m.total; rmCount += m.count; }
      if (g) g.forEach(f => regDue.push(f));
      const dow = c.getDay(), isWeekday = dow !== 0 && dow !== 6, past = c <= today0;
      if (u) {
        activeDays++; hours += u.hours; out.loads += u.loads;
        if (u.src.haulage)    out.hauledM3 += u.src.haulage.val;
        if (u.src.grinder)    out.chip     += u.src.grinder.val;
        if (u.src.carbonator) out.carbon   += u.src.carbonator.val;
        if (u.src.mill)       out.milled   += u.src.mill.val;
      } else if (isWeekday && past) idleWeekdays++;
    });
    return { rmTotal, rmCount, hours, activeDays, idleWeekdays, regDue, ...out };
  }, [cells, idx, today0]);

  const shiftMonth = (n) => { setSel(null); setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1)); };

  const selData = sel ? { u: idx.usage[sel], m: idx.rm[sel], g: idx.reg[sel] } : null;

  return (
    <div className="grid grid-12">
      <div className="span-8">
        <Card title="Repairs &amp; Usage Calendar" glyph="🗓️" right={
          <div className="fcal-nav">
            <button className="btn" onClick={()=>shiftMonth(-1)}>‹</button>
            <span className="fcal-title" style={{ minWidth:120, textAlign:'center' }}>{monthLabel}</span>
            <button className="btn" onClick={()=>shiftMonth(1)} disabled={atCurrentMonth} style={atCurrentMonth?{opacity:.4,cursor:'default'}:{}}>›</button>
            {!atCurrentMonth && <button className="btn" onClick={()=>{ setSel(null); setMonth(new Date(today0.getFullYear(), today0.getMonth(), 1)); }}>Today</button>}
          </div>
        }>
          <div className="fcal-grid">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} className="fcal-dow">{d}</div>)}
            {cells.map((c, i) => {
              if (!c) return <div key={i} className="fcal-cell empty" />;
              const k = iso(c);
              const u = idx.usage[k], m = idx.rm[k], g = idx.reg[k];
              const util = u ? u.active.size / PLANT_COUNT : 0;
              const dow = c.getDay();
              const cls = ['fcal-cell'];
              if (dow === 0 || dow === 6) cls.push('weekend');
              if (k === iso(today0)) cls.push('today');
              if (k === sel) cls.push('sel');
              return (
                <div key={i} className={cls.join(' ')} onClick={()=>setSel(sel === k ? null : k)}
                     title={`${fmt.dateLong(c)}${u?` · ${u.active.size} assets · ${Math.round(u.hours)}h`:''}${m?` · ${m.count} R&M ${fmt.$(m.total,0)}`:''}`}>
                  <div className="fcal-heat" style={{ background: heatColor(util) }} />
                  <div className="fcal-dnum"><b>{c.getDate()}</b>{u && (u.hours ? <span className="fcal-hrs">{Math.round(u.hours)}h</span> : u.loads ? <span className="fcal-hrs">{u.loads}L</span> : null)}</div>
                  <div className="fcal-badges">
                    {m && <span className="fcal-badge rm" title={fmt.$(m.total,0)}>🔧{m.count}</span>}
                    {g && <span className="fcal-badge reg" title={g.map(f=>f.id).join(', ')}>⚠ REGO</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="fcal-legend">
            <span>Utilisation <span className="fcal-heatbar">{HEAT.map((h,i)=><i key={i} style={{background:h}} />)}</span> low → high</span>
            <span><span className="fcal-badge rm">🔧</span> repair / R&amp;M</span>
            <span><span className="fcal-badge reg">⚠ REGO</span> rego expiry</span>
            <span><b style={{color:'var(--text-dim)'}}>h</b> operating hours · <b style={{color:'var(--text-dim)'}}>L</b> haulage loads</span>
          </div>
        </Card>
      </div>

      <div className="span-4">
        {selData ? (
          <Card title={fmt.dateLong(sel)} glyph="📌" right={<button className="btn" onClick={()=>setSel(null)}>✕</button>}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-dim)', marginBottom:6 }}>USAGE · PRODUCTIVITY</div>
            {selData.u ? Object.values(selData.u.src).map((s,i)=>(
              <div key={i} className="fcal-detail-row">
                <div><div className="lbl">{s.glyph} {s.label}</div><div className="sub">{s.hours ? `${Math.round(s.hours*10)/10} h` : `${s.count} ${s.count===1?'run':'runs'}`}</div></div>
                <b style={{ fontSize:11, color:'var(--green-bright)', fontVariantNumeric:'tabular-nums' }}>{fmt.n(Math.round((s.val||0)*10)/10)} {s.unit}</b>
              </div>
            )) : <div className="empty" style={{padding:'8px 0'}}>No usage logged — idle / weekend</div>}

            <div className="divider" />
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-dim)', margin:'4px 0 6px' }}>REPAIRS &amp; MAINT · RISK</div>
            {selData.m ? selData.m.items.map((c,i)=>(
              <div key={i} className="fcal-detail-row">
                <div><div className="lbl">{c.category}</div><div className="sub" style={{textTransform:'capitalize'}}>{c.component} · {c.vendor}</div></div>
                <b style={{ fontSize:11, color:'var(--red)', fontVariantNumeric:'tabular-nums' }}>{fmt.$(c.amount,0)}</b>
              </div>
            )) : <div className="empty" style={{padding:'8px 0'}}>No repairs ✓</div>}

            {selData.g && <div style={{ marginTop:8 }}>{selData.g.map(f=>(
              <div key={f.id} className="fcal-detail-row" style={{ borderColor:'var(--amber)' }}>
                <div><div className="lbl">⚠ Rego expiry · {f.id}</div><div className="sub">{f.plate} · {f.make}</div></div>
              </div>
            ))}</div>}
          </Card>
        ) : (
          <Card title={`${monthLabel} · Insights`} glyph="📈">
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-dim)', marginBottom:4 }}>PRODUCTIVITY</div>
            <div className="fcal-insight"><span className="muted">Active days</span><b>{stats.activeDays}</b></div>
            <div className="fcal-insight"><span className="muted">Plant operating hrs</span><b style={{color:'var(--green-bright)'}}>{fmt.n(Math.round(stats.hours))} h</b></div>
            <div className="fcal-insight"><span className="muted">Haulage loads</span><b>{stats.loads} · {fmt.n(Math.round(stats.hauledM3))} m³</b></div>
            <div className="fcal-insight"><span className="muted">Chip ground</span><b>{fmt.n(Math.round(stats.chip))} m³</b></div>
            <div className="fcal-insight"><span className="muted">Carbon produced</span><b style={{color:'var(--cyan)'}}>{fmt.n(Math.round(stats.carbon*10)/10)} t</b></div>
            <div className="fcal-insight"><span className="muted">Timber milled</span><b>{fmt.n(Math.round(stats.milled))} m³</b></div>

            <div className="divider" />
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-dim)', margin:'4px 0' }}>RISK</div>
            <div className="fcal-insight"><span className="muted">R&amp;M spend</span><b style={{color:'var(--red)'}}>{fmt.$(stats.rmTotal,0)}</b></div>
            <div className="fcal-insight"><span className="muted">Repair events</span><b>{stats.rmCount}</b></div>
            <div className="fcal-insight"><span className="muted">Idle weekdays</span><b style={{color: stats.idleWeekdays>3?'var(--amber)':'var(--text)'}}>{stats.idleWeekdays}</b></div>
            <div className="fcal-insight"><span className="muted">Rego expiries</span><b style={{color: stats.regDue.length?'var(--amber)':'var(--text)'}}>{stats.regDue.length}</b></div>
            {stats.regDue.length>0 && <div className="muted" style={{ fontSize:10, marginTop:6 }}>{stats.regDue.map(f=>`${f.id} (${f.plate})`).join(' · ')}</div>}
            <div className="muted" style={{ fontSize:10, marginTop:10, lineHeight:1.5 }}>Tap any day for its repairs &amp; usage breakdown. Heat shows how many of the {PLANT_COUNT} asset classes ran that day.</div>
          </Card>
        )}
      </div>
    </div>
  );
}

function FleetTab() {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? DATA.FLEET : DATA.FLEET.filter(f => f.type.toLowerCase().includes(filter));

  const expiringReg = DATA.FLEET.filter(f => f.regExpiry && (f.regExpiry - new Date()) < 30 * 86400000 && (f.regExpiry - new Date()) > 0);
  const expiredReg = DATA.FLEET.filter(f => f.regExpiry && (f.regExpiry - new Date()) < 0);

  const totalRM = DATA.costLogs.filter(c => c.category.includes('Repair') || c.category.includes('Tyres') || c.category.includes('Teeth')).reduce((s,c)=>s+c.amount, 0);
  const totalFuel = DATA.costLogs.filter(c => c.category === 'Fuel').reduce((s,c)=>s+c.amount, 0);

  // Fuel trend over 30d
  const fuelByDate = {};
  DATA.costLogs.filter(c => c.category === 'Fuel').forEach(c => { fuelByDate[c.date] = (fuelByDate[c.date] || 0) + c.amount; });
  const dates30 = Array.from({ length: 30 }, (_, i) => iso(daysAgo(29 - i)));
  const fuelVals = dates30.map(d => fuelByDate[d] || 0);

  return (
    <div>
      <div className="grid grid-4 stat-row">
        <Stat label="Fleet Size" tone="green" value={DATA.FLEET.length} sub={`${DATA.FLEET.filter(f=>f.type==='B-Double').length} B-Doubles · ${DATA.FLEET.filter(f=>f.type==='Ute'||f.type==='Van').length} vehicles`} />
        <Stat label="R&M · 90d" tone="red" value={fmt.$(totalRM, 0)} sub={`${DATA.costLogs.filter(c=>c.category.includes('Repair')||c.category.includes('Tyres')).length} txns`} />
        <Stat label="Fuel · 90d" tone="amber" value={fmt.$(totalFuel, 0)} sub={`${fmt.$(totalFuel/90, 0)}/day`} />
        <Stat label="Reg Expiring" tone={expiringReg.length || expiredReg.length ? 'amber' : 'green'} value={expiredReg.length + expiringReg.length} sub={`${expiredReg.length} expired · ${expiringReg.length} <30d`} />
      </div>

      <FleetCalendar />

      <div className="grid grid-12">
        <div className="span-8">
          <Card title="Fleet Roster" glyph="🚛" right={
            <div style={{ display:'flex', gap:6 }}>
              {['all','b-double','excavator','grinder','carbonator','ute','van','planter','mill'].map(f => (
                <button key={f} className="btn" style={filter === f ? { borderColor:'var(--green-dim)', color:'var(--green-bright)', background:'var(--surface-3)' } : {}} onClick={()=>setFilter(f)}>{f}</button>
              ))}
            </div>
          }>
            <table className="table">
              <thead><tr>
                <th>ID / Plate</th><th>Asset</th><th>Year</th><th className="num">Odo / Hours</th><th>Rego</th><th className="num">Capacity</th><th>Status</th>
              </tr></thead>
              <tbody>
                {filtered.map(f => {
                  const days = f.regExpiry ? Math.floor((f.regExpiry - new Date()) / 86400000) : null;
                  return (
                    <tr key={f.id}>
                      <td>
                        <b style={{ color: 'var(--green-bright)' }}>{f.id}</b>
                        <div className="muted" style={{ fontSize: 10 }}>{f.plate}</div>
                      </td>
                      <td>
                        <div>{f.type}</div>
                        <div className="muted" style={{ fontSize: 10 }}>{f.make}</div>
                      </td>
                      <td className="muted">{f.year}</td>
                      <td className="num">{f.odometer ? fmt.n(f.odometer) + ' km' : f.hours ? f.hours + ' h' : '—'}</td>
                      <td>
                        {f.regExpiry ? (
                          <span style={{ color: days < 0 ? 'var(--red)' : days < 30 ? 'var(--amber)' : 'var(--text-dim)', fontSize: 11 }}>
                            {days < 0 ? `EXPIRED ${-days}d` : days < 30 ? `${days}d left` : fmt.date(f.regExpiry)}
                          </span>
                        ) : <span className="muted">n/a</span>}
                      </td>
                      <td className="num muted">{f.capacityT ? f.capacityT + ' t' : f.fuelLh ? f.fuelLh + ' L/h' : '—'}</td>
                      <td>
                        {f.status === 'active' && <Pill tone="green"><Dot tone="green" pulse />ACTIVE</Pill>}
                        {f.status === 'service' && <Pill tone="amber">SERVICE</Pill>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card title="Recent R&M Transactions" glyph="🔧">
            <table className="table">
              <thead><tr><th>Date</th><th>Category</th><th>Component</th><th>Vendor</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {DATA.costLogs.filter(c => c.category.includes('Repair') || c.category.includes('Tyres') || c.category.includes('Teeth')).slice(-12).reverse().map(c => (
                  <tr key={c.id}>
                    <td>{fmt.date(c.date)}</td>
                    <td><Pill tone={c.category.includes('Teeth') ? 'orange' : c.category.includes('Tyres') ? 'red' : 'red'}>{c.category}</Pill></td>
                    <td className="muted" style={{ textTransform: 'capitalize' }}>{c.component}</td>
                    <td className="muted">{c.vendor}</td>
                    <td className="num">{fmt.$(c.amount, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="span-4">
          <Card title="Fuel Spend · 30d" glyph="⛽">
            <LineChart
              height={160}
              xLabels={dates30.map(fmt.date)}
              yFmt={v => '$' + Math.round(v/100)/10 + 'k'}
              series={[{ label:'fuel', values: fuelVals, color:'#d97706' }]}
            />
            <div className="divider" />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11 }}>
              <span className="muted">Total · 90d</span>
              <b style={{ color: 'var(--amber)', fontVariantNumeric:'tabular-nums' }}>{fmt.$(totalFuel, 0)}</b>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11 }}>
              <span className="muted">Per work-day</span>
              <b style={{ color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>{fmt.$(totalFuel/65, 0)}</b>
            </div>
          </Card>

          <Card title="Registration · Action List" glyph="📋">
            {expiredReg.length === 0 && expiringReg.length === 0 ? (
              <div className="empty">All up to date ✓</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
                {[...expiredReg, ...expiringReg].map(f => {
                  const days = Math.floor((f.regExpiry - new Date()) / 86400000);
                  return (
                    <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'var(--bg-2)', borderRadius:4, border:'1px solid var(--border-soft)' }}>
                      <div>
                        <div style={{ fontSize: 12 }}><b style={{ color:'var(--green-bright)' }}>{f.id}</b> · {f.plate}</div>
                        <div className="muted" style={{ fontSize: 10 }}>{f.make}</div>
                      </div>
                      <Pill tone={days < 0 ? 'red' : 'amber'}>
                        {days < 0 ? `EXPIRED ${-days}d` : `${days}d left`}
                      </Pill>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Utilisation · this week" glyph="📊">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
              <Gauge value={88} label="B-Double 01" tone="green" size={120} />
              <Gauge value={92} label="B-Double 02" tone="green" size={120} />
              <Gauge value={0}  label="B-Double 03" tone="red"   size={120} sub="service" />
              <Gauge value={64} label="Excavator"   tone="amber" size={120} />
              <Gauge value={78} label="Grinder"     tone="cyan"  size={120} />
              <Gauge value={42} label="Carbonator"  tone="purple" size={120} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.FleetCalendar = FleetCalendar;
window.FleetTab = FleetTab;
