// Fleet tab — vehicles, R&M log, fuel, registration

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

window.FleetTab = FleetTab;
