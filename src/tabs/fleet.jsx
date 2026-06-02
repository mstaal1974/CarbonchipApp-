// Fleet tab — vehicles, R&M log, fuel, registration

// Map an asset type to the cost "component" its R&M is booked against, so we
// can scope the repairs calendar when a single asset is selected. (Repairs in
// costLogs are tracked per component, not per asset — surfaced as a UI hint.)
const TYPE_COMPONENT = {
  'B-Double': 'haulage', 'Excavator': 'excavator', 'Grinder': 'grinder',
  'Carbonator': 'carbonator', 'Planter': 'planter', 'Mill': 'mill',
  'Ute': 'overhead', 'Van': 'overhead',
};

const isRMCost = (c) => c.category.includes('Repair') || c.category.includes('Tyres') || c.category.includes('Teeth');

// Build a date-keyed model of usage + repairs + rego for the calendar, scoped
// to a single asset id or 'all'.
function buildFleetCalendarData(assetId) {
  const isAll = assetId === 'all';
  const asset = isAll ? null : DATA.FLEET.find(f => f.id === assetId);
  const comp = asset ? TYPE_COMPONENT[asset.type] : null;

  const map = {}; // iso date -> { hours, loads, tonnes, millM3, rm:[], rmTotal }
  const touch = (d) => (map[d] = map[d] || { hours: 0, loads: 0, tonnes: 0, millM3: 0, rm: [], rmTotal: 0 });

  // Haulage usage (trucks) — loads + tonnes per day
  DATA.haulageLogs.forEach(h => {
    if (!isAll && !(asset && asset.type === 'B-Double' && h.truck === asset.id)) return;
    const e = touch(h.date); e.loads += 1; e.tonnes += h.tonnes || 0;
  });

  // Plant usage (one asset per type) — operating hours per day
  const plant = [
    ['Excavator', DATA.excavatorLogs], ['Grinder', DATA.grinderLogs],
    ['Carbonator', DATA.carbonatorLogs], ['Planter', DATA.planterLogs],
  ];
  plant.forEach(([type, logs]) => {
    if (!isAll && !(asset && asset.type === type)) return;
    logs.forEach(l => { touch(l.date).hours += l.hours || 0; });
  });
  // Mill logs carry m3, not hours
  if (isAll || (asset && asset.type === 'Mill')) {
    DATA.millLogs.forEach(l => { touch(l.date).millM3 += l.m3 || 0; });
  }

  // Repairs & maintenance (by component)
  DATA.costLogs.forEach(c => {
    if (!isRMCost(c)) return;
    if (!isAll && comp && c.component !== comp) return;
    const e = touch(c.date); e.rm.push(c); e.rmTotal += c.amount;
  });

  // Registration expiries (risk markers)
  const rego = {}; // iso date -> [assets]
  DATA.FLEET.forEach(f => {
    if (!f.regExpiry) return;
    if (!isAll && f.id !== assetId) return;
    const d = iso(new Date(f.regExpiry));
    (rego[d] = rego[d] || []).push(f);
  });

  return { map, rego, asset, isAll };
}

const activityScore = (e) => (e.hours || 0) + (e.loads || 0) + (e.millM3 || 0) * 0.1;

function FleetCalendar() {
  const [assetId, setAssetId] = useState('all');
  const [offset, setOffset] = useState(0); // months from current
  const [selected, setSelected] = useState(null);

  const base = new Date();
  const viewDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayIso = iso(new Date());

  const { map, rego, asset, isAll } = useMemo(() => buildFleetCalendarData(assetId), [assetId]);

  // Six-week grid, Monday-first
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstDow);
  const weeks = [];
  let cur = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(row);
  }

  // Month aggregates (scoped)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const inMonth = Array.from({ length: daysInMonth }, (_, i) => iso(new Date(year, month, i + 1)));
  let maxScore = 0, totalHours = 0, totalLoads = 0, totalTonnes = 0, totalMillM3 = 0, rmSpend = 0, activeDays = 0, regoDue = 0;
  let workingDays = 0;
  inMonth.forEach(d => {
    const dow = new Date(d + 'T00:00:00').getDay();
    if (dow !== 0 && dow !== 6) workingDays++;
    const e = map[d];
    if (rego[d]) regoDue += rego[d].length;
    if (!e) return;
    maxScore = Math.max(maxScore, activityScore(e));
    totalHours += e.hours; totalLoads += e.loads; totalTonnes += e.tonnes; totalMillM3 += e.millM3; rmSpend += e.rmTotal;
    if (e.hours > 0 || e.loads > 0 || e.millM3 > 0) activeDays++;
  });
  const util = workingDays ? Math.round((activeDays / workingDays) * 100) : 0;
  const inService = DATA.FLEET.filter(f => f.status === 'service' && (isAll || f.id === assetId));

  const monthLabel = viewDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const heatBg = (score) => {
    if (!score || !maxScore) return 'transparent';
    return `rgba(16,185,129,${(0.08 + 0.5 * (score / maxScore)).toFixed(3)})`;
  };

  const primaryLabel = asset ? (asset.type === 'B-Double' ? 'Loads' : asset.type === 'Mill' ? 'Mill m³' : 'Hours') : 'Activity';
  const primaryValue = asset
    ? (asset.type === 'B-Double' ? `${totalLoads}` : asset.type === 'Mill' ? `${totalMillM3.toFixed(0)} m³` : `${totalHours.toFixed(0)} h`)
    : `${totalLoads} loads · ${totalHours.toFixed(0)} h`;

  return (
    <div>
      <div className="grid grid-4 stat-row">
        <Stat label="Utilisation · month" tone={util >= 75 ? 'green' : util >= 50 ? 'amber' : 'red'} value={util + '%'} sub={`${activeDays}/${workingDays} working days active`} />
        <Stat label={primaryLabel + ' · month'} tone="cyan" value={primaryValue} sub={asset && asset.type === 'B-Double' ? `${totalTonnes.toFixed(0)} t hauled` : 'productivity'} />
        <Stat label="R&M Spend · month" tone="red" value={fmt.$(rmSpend, 0)} sub={`${inMonth.reduce((n, d) => n + (map[d] ? map[d].rm.length : 0), 0)} repair events`} />
        <Stat label="Risk Flags" tone={(regoDue || inService.length) ? 'amber' : 'green'} value={regoDue + inService.length} sub={`${regoDue} rego due · ${inService.length} in service`} />
      </div>

      <Card
        title="Repairs & Usage Calendar"
        glyph="🗓️"
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="select" style={{ width: 170 }} value={assetId} onChange={e => { setAssetId(e.target.value); setSelected(null); }}>
              <option value="all">All assets</option>
              {DATA.FLEET.map(f => <option key={f.id} value={f.id}>{f.id} · {f.type}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button className="btn" onClick={() => setOffset(o => o - 1)}>‹</button>
              <span style={{ minWidth: 130, textAlign: 'center', fontSize: 12, fontWeight: 600 }}>{monthLabel}</span>
              <button className="btn" onClick={() => setOffset(o => o + 1)} disabled={offset >= 0}>›</button>
              {offset !== 0 && <button className="btn" onClick={() => setOffset(0)}>Today</button>}
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-dim)', marginBottom: 10 }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(16,185,129,0.5)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} /> usage intensity</span>
          <span>🔧 R&M spend</span>
          <span>📋 rego due</span>
          {!isAll && <span style={{ color: 'var(--amber)' }}>ℹ︎ R&M is tracked per component ({TYPE_COMPONENT[asset.type]}), not per individual asset</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {WD.map(d => <div key={d} style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', padding: '2px 0', fontWeight: 600 }}>{d}</div>)}
          {weeks.flat().map((dt, i) => {
            const di = iso(dt);
            const inMo = dt.getMonth() === month;
            const e = map[di];
            const score = e ? activityScore(e) : 0;
            const regoHere = rego[di];
            const isToday = di === todayIso;
            const isSel = di === selected;
            return (
              <div
                key={i}
                onClick={() => setSelected(isSel ? null : di)}
                style={{
                  minHeight: 64, borderRadius: 6, padding: 5, cursor: 'pointer',
                  border: isSel ? '2px solid var(--green-bright)' : isToday ? '1px solid var(--green-bright)' : '1px solid var(--border-soft)',
                  background: inMo ? heatBg(score) : 'var(--bg-2)',
                  opacity: inMo ? 1 : 0.45,
                  borderLeft: e && e.rmTotal > 0 ? '3px solid var(--red)' : undefined,
                  display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--green-bright)' : 'var(--text-dim)' }}>{dt.getDate()}</span>
                  {regoHere && <span title={regoHere.map(f => f.id + ' rego due').join(', ')} style={{ fontSize: 10 }}>📋</span>}
                </div>
                {e && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {e.loads > 0 && <span style={{ fontSize: 9.5, color: 'var(--text)' }}>🚛 {e.loads} {e.loads === 1 ? 'load' : 'loads'}</span>}
                    {e.hours > 0 && <span style={{ fontSize: 9.5, color: 'var(--text)' }}>⏱ {e.hours.toFixed(1)} h</span>}
                    {e.millM3 > 0 && <span style={{ fontSize: 9.5, color: 'var(--text)' }}>🪵 {e.millM3.toFixed(1)} m³</span>}
                    {e.rmTotal > 0 && <span style={{ fontSize: 9.5, color: 'var(--red)', fontWeight: 600 }}>🔧 {fmt.$(e.rmTotal, 0)}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {selected && (() => {
        const e = map[selected] || { hours: 0, loads: 0, tonnes: 0, millM3: 0, rm: [], rmTotal: 0 };
        const hauls = DATA.haulageLogs.filter(h => h.date === selected && (isAll || (asset && asset.type === 'B-Double' && h.truck === asset.id)));
        const regoList = rego[selected] || [];
        const nothing = e.loads === 0 && e.hours === 0 && e.millM3 === 0 && e.rm.length === 0 && regoList.length === 0;
        return (
          <Card title={`Day Detail · ${fmt.dateLong(selected)}`} glyph="🔎" right={<button className="btn btn-ghost" onClick={() => setSelected(null)}>✕ Close</button>}>
            {nothing ? <div className="empty">No usage, repairs or rego events on this day.</div> : (
              <div className="grid grid-2" style={{ gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600 }}>Usage / Productivity</div>
                  {hauls.length > 0 && (
                    <table className="table"><thead><tr><th>Truck</th><th>Route</th><th>Driver</th><th className="num">Tonnes</th></tr></thead>
                      <tbody>{hauls.map(h => (
                        <tr key={h.id}><td><b style={{ color: 'var(--green-bright)' }}>{h.truck}</b></td><td className="muted">{h.fromName || h.from} → {h.to}</td><td className="muted">{h.driver}</td><td className="num">{(h.tonnes || 0).toFixed(1)}</td></tr>
                      ))}</tbody>
                    </table>
                  )}
                  {(e.hours > 0 || e.millM3 > 0) && (
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: hauls.length ? 8 : 0, fontSize: 12 }}>
                      {e.hours > 0 && <span>⏱ <b>{e.hours.toFixed(1)} h</b> plant operating</span>}
                      {e.millM3 > 0 && <span>🪵 <b>{e.millM3.toFixed(1)} m³</b> milled</span>}
                    </div>
                  )}
                  {hauls.length === 0 && e.hours === 0 && e.millM3 === 0 && <div className="empty">No usage recorded.</div>}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, fontWeight: 600 }}>Repairs & Risk</div>
                  {e.rm.length > 0 ? (
                    <table className="table"><thead><tr><th>Category</th><th>Component</th><th>Vendor</th><th className="num">Amount</th></tr></thead>
                      <tbody>{e.rm.map(c => (
                        <tr key={c.id}><td><Pill tone="red">{c.category}</Pill></td><td className="muted" style={{ textTransform: 'capitalize' }}>{c.component}</td><td className="muted">{c.vendor}</td><td className="num">{fmt.$(c.amount, 0)}</td></tr>
                      ))}</tbody>
                    </table>
                  ) : <div className="empty" style={{ marginBottom: 8 }}>No repairs.</div>}
                  {regoList.map(f => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 4, marginTop: 6 }}>
                      <span style={{ fontSize: 12 }}>📋 <b style={{ color: 'var(--green-bright)' }}>{f.id}</b> · {f.plate} — registration due</span>
                      <Pill tone="amber">{f.make}</Pill>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })()}
    </div>
  );
}

function FleetTab() {
  const [view, setView] = useState('roster');
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
      <Subnav
        items={[
          { id: 'roster', label: 'Roster & Costs', icon: '🚛' },
          { id: 'calendar', label: 'Repairs & Usage Calendar', icon: '🗓️' },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'calendar' ? <FleetCalendar /> : (
      <React.Fragment>
      <div className="grid grid-4 stat-row">
        <Stat label="Fleet Size" tone="green" value={DATA.FLEET.length} sub={`${DATA.FLEET.filter(f=>f.type==='B-Double').length} B-Doubles · ${DATA.FLEET.filter(f=>f.type==='Ute'||f.type==='Van').length} vehicles`} />
        <Stat label="R&M · 90d" tone="red" value={fmt.$(totalRM, 0)} sub={`${DATA.costLogs.filter(c=>c.category.includes('Repair')||c.category.includes('Tyres')).length} txns`} />
        <Stat label="Fuel · 90d" tone="amber" value={fmt.$(totalFuel, 0)} sub={`${fmt.$(totalFuel/90, 0)}/day`} />
        <Stat label="Reg Expiring" tone={expiringReg.length || expiredReg.length ? 'amber' : 'green'} value={expiredReg.length + expiringReg.length} sub={`${expiredReg.length} expired · ${expiringReg.length} <30d`} />
      </div>

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
      </React.Fragment>
      )}
    </div>
  );
}

window.FleetTab = FleetTab;
window.FleetCalendar = FleetCalendar;
