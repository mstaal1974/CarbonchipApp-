// Operations tab — sub-nav per component

function OperationsTab() {
  const [section, setSection] = useState('planter');
  const A = window.AGG;

  const items = [
    { id: 'planter',    icon:'🌱', label: 'Planter',    count: A.planterTotals.entries },
    { id: 'excavator',  icon:'🚜', label: 'Excavator',  count: A.excavatorTotals.entries },
    { id: 'haulage',    icon:'🚛', label: 'Haulage',    count: DATA.haulageLogs.length },
    { id: 'grinder',    icon:'⚙️', label: 'Grinder',    count: A.grinderTotals.entries },
    { id: 'carbonator', icon:'🔥', label: 'Carbonator', count: A.carbonatorTotals.entries },
    { id: 'mill',       icon:'🪵', label: 'Mill',       count: A.millTotals.entries },
    { id: 'stock',      icon:'📦', label: 'Stock',      count: DATA.STOCK.length },
  ];

  return (
    <div>
      <Subnav items={items} value={section} onChange={setSection} />
      {section === 'planter'    && <PlanterPanel />}
      {section === 'excavator'  && <ExcavatorPanel />}
      {section === 'haulage'    && <HaulagePanel />}
      {section === 'grinder'    && <GrinderPanel />}
      {section === 'carbonator' && <CarbonatorPanel />}
      {section === 'mill'       && <MillPanel />}
      {section === 'stock'      && <StockPanel />}
    </div>
  );
}

// ─── shared layout: header KPIs + chart + log table ──────
function OpLayout({ kpis, chartTitle, chartRight, chart, variance, tableTitle, table, sideCard }) {
  return (
    <div>
      <div className="grid stat-row" style={{ gridTemplateColumns: `repeat(${kpis.length}, 1fr)` }}>
        {kpis.map((k, i) => <Stat key={i} {...k} />)}
      </div>
      <div className="grid grid-12">
        <div className="span-8">
          <Card title={chartTitle} glyph="📈" right={chartRight}>
            {variance}
            {chart}
          </Card>
          <Card title={tableTitle} glyph="📋">{table}</Card>
        </div>
        <div className="span-4">{sideCard}</div>
      </div>
    </div>
  );
}

// ─── shared helper: build actual + budget series and totals ────
function useRangeSeries({ days, logs, metricKey, component }) {
  return useMemo(() => {
    const dates = rangeDates(days);
    const actualVals = dailySum(logs, metricKey, dates);
    const budgetVals = budgetSeries(component, dates);
    const actualTotal = actualVals.reduce((a,b)=>a+b, 0);
    const budgetTotal = budgetVals.reduce((a,b)=>a+b, 0);
    return { dates, actualVals, budgetVals, actualTotal, budgetTotal, unit: window.BUDGETS[component]?.unit || '' };
  }, [days, logs, metricKey, component]);
}

// ─── PLANTER ────────────────────────────────
function PlanterPanel() {
  const [days, setDays] = useState(30);
  const logs = DATA.planterLogs;
  const T = window.AGG.planterTotals;
  const { dates, actualVals, budgetVals, actualTotal, budgetTotal, unit } =
    useRangeSeries({ days, logs, metricKey: 'hectares', component: 'planter' });

  const cost = DATA.costLogs.filter(c => c.component === 'planter').reduce((s,c)=>s+c.amount, 0);

  return (
    <OpLayout
      kpis={[
        { label: 'Seedlings · 90d', tone:'green', value: fmt.n(T.seedlings), sub: `${T.entries} runs` },
        { label: 'Hectares Planted', tone:'lime', value: T.hectares.toFixed(1) + ' ha', sub: 'across 5 sites' },
        { label: 'Operating Hours', tone:'amber', value: T.hours.toFixed(0) + 'h', sub: `avg ${(T.hours / Math.max(T.entries,1)).toFixed(1)}h/run` },
        { label: 'Input Costs', tone:'red', value: fmt.$(cost, 0), sub: `${fmt.$(cost / Math.max(T.hectares,1), 0)}/ha` },
      ]}
      chartTitle={`Hectares planted · ${days}d`}
      chartRight={<RangeSelector value={days} onChange={setDays} />}
      variance={<BudgetVariance actual={actualTotal} budget={budgetTotal} unit={unit} fmtFn={v => v.toFixed(1)} />}
      chart={<LineChart height={220} xLabels={dates.map(fmt.date)} yFmt={v=>v.toFixed(1)+'ha'} series={[
        { label:'Actual ha/day', values: actualVals, color:'#10b981' },
        { label:'Budget ha/day', values: budgetVals, color:'#64748b', dashed: true, fill: false },
      ]} />}
      tableTitle="Recent Planter Runs"
      table={
        <table className="table">
          <thead><tr><th>Date</th><th>Site</th><th className="num">Hectares</th><th className="num">Seedlings</th><th className="num">Hours</th><th>Operator</th></tr></thead>
          <tbody>
            {logs.slice(-10).reverse().map(l => (
              <tr key={l.id}>
                <td>{fmt.date(l.date)} <span className="muted">{fmt.dow(l.date)}</span></td>
                <td>{DATA.SITES.find(s=>s.id===l.site)?.name}</td>
                <td className="num">{l.hectares.toFixed(2)}</td>
                <td className="num">{fmt.n(l.seedlings)}</td>
                <td className="num">{l.hours.toFixed(1)}</td>
                <td className="muted">{l.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      sideCard={<CostBreakdownCard component="planter" />}
    />
  );
}

// ─── EXCAVATOR ──────────────────────────────
function ExcavatorPanel() {
  const [days, setDays] = useState(30);
  const logs = DATA.excavatorLogs;
  const T = window.AGG.excavatorTotals;
  const { dates, actualVals, budgetVals, actualTotal, budgetTotal, unit } =
    useRangeSeries({ days, logs, metricKey: 'hours', component: 'excavator' });
  return (
    <OpLayout
      kpis={[
        { label: 'Operating Hours', tone:'amber', value: T.hours.toFixed(0) + 'h', sub: '90d' },
        { label: 'Wet-Hire Cost', tone:'red', value: fmt.$(T.cost, 0), sub: '$220/h' },
        { label: 'Avg Day', tone:'green', value: (T.hours / Math.max(T.entries,1)).toFixed(1) + 'h', sub: `${T.entries} days active` },
        { label: 'Utilisation', tone:'cyan', value: ((T.entries / 65) * 100).toFixed(0) + '%', sub: 'of working days' },
      ]}
      chartTitle={`Excavator hours · ${days}d`}
      chartRight={<RangeSelector value={days} onChange={setDays} />}
      variance={<BudgetVariance actual={actualTotal} budget={budgetTotal} unit={unit} fmtFn={v => v.toFixed(0)} />}
      chart={<LineChart height={220} xLabels={dates.map(fmt.date)} yFmt={v=>v.toFixed(0)+'h'} series={[
        { label:'Actual hours', values: actualVals, color:'#d97706' },
        { label:'Budget hours', values: budgetVals, color:'#64748b', dashed: true, fill: false },
      ]} />}
      tableTitle="Recent Excavator Days"
      table={
        <table className="table">
          <thead><tr><th>Date</th><th>Site</th><th className="num">Hours</th><th className="num">Rate</th><th className="num">Cost</th><th>Operator</th></tr></thead>
          <tbody>
            {logs.slice(-10).reverse().map(l => (
              <tr key={l.id}>
                <td>{fmt.date(l.date)} <span className="muted">{fmt.dow(l.date)}</span></td>
                <td>{DATA.SITES.find(s=>s.id===l.site)?.name}</td>
                <td className="num">{l.hours.toFixed(1)}</td>
                <td className="num muted">${l.rate}/h</td>
                <td className="num">{fmt.$(l.cost, 0)}</td>
                <td className="muted">{l.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      sideCard={<CostBreakdownCard component="excavator" />}
    />
  );
}

// ─── HAULAGE ────────────────────────────────
function HaulagePanel() {
  const [view, setView] = useState('log');
  const [days, setDays] = useState(30);
  const out = DATA.haulageLogs.filter(h => h.direction === 'outbound');
  const inb = DATA.haulageLogs.filter(h => h.direction === 'inbound');
  const totalRev = out.reduce((s,h)=>s+h.revenue, 0);

  const { dates, actualVals, budgetVals, actualTotal, budgetTotal, unit } =
    useRangeSeries({ days, logs: out, metricKey: 'tonnes', component: 'haulage' });

  return (
    <div>
      <div className="grid grid-4 stat-row">
        <Stat label="Outbound Loads" tone="green" value={out.length} sub="90d" />
        <Stat label="Inbound Loads" tone="cyan" value={inb.length} sub="biomass in" />
        <Stat label="Tonnes Moved · Out" tone="blue" value={fmt.n(out.reduce((s,h)=>s+h.tonnes,0), 0)} sub="t" />
        <Stat label="Revenue · 90d" tone="amber" value={fmt.$(totalRev, 0)} sub={`avg ${fmt.$(totalRev/Math.max(out.length,1),0)}/load`} />
      </div>

      <div className="subnav" style={{ marginBottom: 18 }}>
        <button className={`subnav-item ${view==='log' ? 'active' : ''}`} onClick={()=>setView('log')}>📋 Load Log</button>
        <button className={`subnav-item ${view==='plan' ? 'active' : ''}`} onClick={()=>setView('plan')}>🗺️ Trip Planner</button>
      </div>

      {view === 'log' && (
        <div className="grid grid-12">
          <div className="span-8">
            <Card title={`Tonnes moved · ${days}d (outbound)`} glyph="📈" right={<RangeSelector value={days} onChange={setDays} />}>
              <BudgetVariance actual={actualTotal} budget={budgetTotal} unit={unit} fmtFn={v => fmt.n(v, 0)} />
              <LineChart height={220} xLabels={dates.map(fmt.date)} yFmt={v=>v.toFixed(0)+'t'} series={[
                { label:'Actual tonnes', values: actualVals, color:'#2563eb' },
                { label:'Budget tonnes', values: budgetVals, color:'#64748b', dashed: true, fill: false },
              ]} />
            </Card>
            <Card title="Recent Loads" glyph="🚛" right={
              <div style={{ display:'flex', gap:6 }}>
                <select className="select" style={{ fontSize:11, padding:'4px 8px' }}>
                  <option>All directions</option><option>Outbound</option><option>Inbound</option>
                </select>
                <select className="select" style={{ fontSize:11, padding:'4px 8px' }}>
                  <option>All clients</option>{DATA.CLIENTS.map(c=><option key={c.id}>{c.short}</option>)}
                </select>
              </div>
            }>
              <table className="table">
                <thead><tr>
                  <th>ID</th><th>Date/Time</th><th>Dir</th><th>From → To</th><th>Product</th><th className="num">m³ / t</th><th>Truck</th><th>Driver</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {DATA.haulageLogs.slice(-12).reverse().map(h => (
                    <tr key={h.id}>
                      <td className="muted">{h.id}</td>
                      <td>{fmt.date(h.date)} <span className="muted">{h.time}</span></td>
                      <td>{h.direction === 'outbound' ? <span style={{color:'var(--green)'}}>↗ OUT</span> : <span style={{color:'var(--cyan)'}}>↙ IN</span>}</td>
                      <td>{h.fromName || h.from} → {h.to === 'yard' ? 'Yard' : h.to}</td>
                      <td>{h.productName}</td>
                      <td className="num">{h.m3.toFixed(0)} <span className="muted">/ {h.tonnes.toFixed(0)}t</span></td>
                      <td className="muted">{h.truck}</td>
                      <td className="muted">{h.driver?.split(' ')[0]}</td>
                      <td>{h.invoiceStatus ? <Pill tone={h.invoiceStatus === 'paid' ? 'green' : h.invoiceStatus === 'overdue' ? 'red' : 'amber'}>{h.invoiceStatus}</Pill> : <Pill tone="cyan">received</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <div className="span-4">
            <CostBreakdownCard component="haulage" />
            <Card title="Trailer Mix" glyph="🚚">
              <Donut size={140} thickness={20} label={`${DATA.haulageLogs.length}`} sub="loads"
                data={[{ label: 'B-Double', value: DATA.haulageLogs.length, color: '#10b981' }]} />
              <div className="divider" />
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
                  <span>Avg load · m³</span><b style={{ color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>{(out.reduce((s,h)=>s+h.m3,0)/Math.max(out.length,1)).toFixed(1)}</b>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
                  <span>Avg load · tonnes</span><b style={{ color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>{(out.reduce((s,h)=>s+h.tonnes,0)/Math.max(out.length,1)).toFixed(1)}</b>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0' }}>
                  <span>$ per tonne (avg)</span><b style={{ color:'var(--green)', fontVariantNumeric:'tabular-nums' }}>{fmt.$(totalRev / Math.max(out.reduce((s,h)=>s+h.tonnes,0), 1), 2)}</b>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {view === 'plan' && <TripPlanner />}
    </div>
  );
}

// ─── TRIP PLANNER ───────────────────────────
function TripPlanner() {
  const dayLabels = ['Mon','Tue','Wed','Thu','Fri'];
  // Build the planned schedule using contract cadences for next week.
  const trucks = DATA.FLEET.filter(f => f.type === 'B-Double');
  const drivers = DATA.USERS.filter(u => u.role === 'Driver');
  // Distribute loads across days × trucks
  const schedule = useMemo(() => {
    const slots = []; // {day, truck, driver, client, time, product, m3, tonnes}
    let driverIdx = 0;
    DATA.CLIENTS.forEach(c => {
      if (c.loadsPerDay) {
        const perDay = Math.round(c.loadsPerDay);
        for (let d = 0; d < 5; d++) {
          for (let i = 0; i < perDay; i++) {
            slots.push({
              day: d,
              truck: trucks[(d + i) % trucks.length],
              driver: drivers[driverIdx++ % drivers.length],
              client: c,
              time: ['06:30','09:30','12:30','15:00'][i] || '15:30',
              product: c.product, m3: c.m3PerLoad, tonnes: c.tonnesPerLoad || c.m3PerLoad*0.6,
            });
          }
        }
      } else {
        const total = Math.round(c.loadsPerWeek);
        for (let i = 0; i < total; i++) {
          slots.push({
            day: (i * 2) % 5,
            truck: trucks[(i + 2) % trucks.length],
            driver: drivers[driverIdx++ % drivers.length],
            client: c,
            time: '10:30', product: c.product, m3: c.m3PerLoad, tonnes: c.m3PerLoad*0.6,
          });
        }
      }
    });
    return slots;
  }, []);

  return (
    <div>
      <Card title="Trip Plan · Next 5 working days" glyph="🗺️" right={
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn">◀ Prev Week</button>
          <button className="btn btn-primary">Generate Optimised Plan</button>
          <button className="btn">Next Week ▶</button>
        </div>
      }>
        <div style={{ display:'grid', gridTemplateColumns: `140px repeat(5, 1fr)`, gap: 1, background:'var(--border-soft)', border:'1px solid var(--border)', borderRadius: 6, overflow:'hidden' }}>
          <div style={{ background:'var(--surface)', padding:'10px 12px', fontSize: 10, color:'var(--text-dim)' }}>Truck</div>
          {dayLabels.map(d => (
            <div key={d} style={{ background:'var(--surface)', padding:'10px 12px', fontSize: 10, color:'var(--text-dim)' }}>
              {d} · {fmt.date(daysAgo(-((['Mon','Tue','Wed','Thu','Fri'].indexOf(d)+1))))}
            </div>
          ))}
          {trucks.map(t => (
            <React.Fragment key={t.id}>
              <div style={{ background:'var(--surface-2)', padding:'12px', borderTop:'1px solid var(--border-soft)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green-bright)' }}>{t.id}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.plate}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{t.make}</div>
                {t.status === 'service' && <Pill tone="amber">SERVICE</Pill>}
              </div>
              {dayLabels.map((_, di) => {
                const slots = schedule.filter(s => s.day === di && s.truck.id === t.id);
                return (
                  <div key={di} style={{ background:'var(--surface)', padding:6, minHeight: 90, display:'flex', flexDirection:'column', gap:4, borderTop:'1px solid var(--border-soft)' }}>
                    {t.status === 'service' && <div style={{ background:'rgba(251,191,36,0.08)', border:'1px dashed rgba(251,191,36,0.4)', color:'var(--amber)', borderRadius:3, padding:6, fontSize:10, textAlign:'center' }}>↻ IN SERVICE</div>}
                    {t.status !== 'service' && slots.map((s, i) => (
                      <div key={i} style={{
                        background: `rgba(${s.client.tone==='green'?'74,222,128':s.client.tone==='cyan'?'103,232,249':s.client.tone==='amber'?'251,191,36':'192,132,252'}, 0.08)`,
                        border: `1px solid var(--${s.client.tone})`,
                        borderLeft: `3px solid var(--${s.client.tone})`,
                        borderRadius: 3,
                        padding: '5px 7px',
                        fontSize: 10.5,
                        lineHeight: 1.35,
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <b style={{ color:`var(--${s.client.tone})` }}>{s.client.short}</b>
                          <span style={{ color: 'var(--text-dim)', fontVariantNumeric:'tabular-nums' }}>{s.time}</span>
                        </div>
                        <div style={{ color:'var(--text-dim)' }}>{Math.round(s.tonnes)}t · {Math.round(s.m3)}m³</div>
                        <div style={{ color:'var(--text-muted)', fontSize:9.5 }}>{s.driver?.name?.split(' ')[0]}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div style={{ display:'flex', gap:18, marginTop: 14, fontSize: 11, color: 'var(--text-dim)' }}>
          {DATA.CLIENTS.map(c => (
            <span key={c.id} style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
              <span style={{ width: 12, height: 12, background: `var(--${c.tone})`, borderRadius: 2 }} />
              {c.short}
            </span>
          ))}
          <span style={{ marginLeft:'auto' }}>{schedule.length} loads planned · ~{Math.round(schedule.reduce((s,x)=>s+x.tonnes,0))} t</span>
        </div>
      </Card>
    </div>
  );
}

// ─── GRINDER ────────────────────────────────
function GrinderPanel() {
  const [days, setDays] = useState(30);
  const logs = DATA.grinderLogs;
  const T = window.AGG.grinderTotals;
  const { dates, actualVals, budgetVals, actualTotal, budgetTotal, unit } =
    useRangeSeries({ days, logs, metricKey: 'throughput', component: 'grinder' });
  return (
    <OpLayout
      kpis={[
        { label: 'Throughput · 90d', tone:'red', value: fmt.n(T.throughput) + ' m³', sub: `${(T.throughput/Math.max(T.hours,1)).toFixed(1)} m³/h` },
        { label: 'Operating Hours', tone:'amber', value: T.hours.toFixed(0) + 'h', sub: 'across all shifts' },
        { label: 'Avg shift', tone:'green', value: (T.hours / Math.max(T.entries,1)).toFixed(1) + 'h', sub: `${T.entries} shifts` },
        { label: 'Teeth Cost · 90d', tone:'orange', value: fmt.$(DATA.costLogs.filter(c=>c.category==='Teeth & Grates').reduce((s,c)=>s+c.amount,0), 0), sub: 'wear parts' },
      ]}
      chartTitle={`Grinder throughput · ${days}d`}
      chartRight={<RangeSelector value={days} onChange={setDays} />}
      variance={<BudgetVariance actual={actualTotal} budget={budgetTotal} unit={unit} fmtFn={v => fmt.n(v, 0)} />}
      chart={<LineChart height={220} xLabels={dates.map(fmt.date)} yFmt={v=>v.toFixed(0)} series={[
        { label:'Actual m³/day', values: actualVals, color:'#e11d48' },
        { label:'Budget m³/day', values: budgetVals, color:'#64748b', dashed: true, fill: false },
      ]} />}
      tableTitle="Recent Grinder Shifts"
      table={
        <table className="table">
          <thead><tr><th>Date</th><th className="num">Hours</th><th className="num">Throughput m³</th><th className="num">Rate m³/h</th><th>Product</th><th>Operator</th></tr></thead>
          <tbody>
            {logs.slice(-10).reverse().map(l => (
              <tr key={l.id}>
                <td>{fmt.date(l.date)} <span className="muted">{fmt.dow(l.date)}</span></td>
                <td className="num">{l.hours.toFixed(1)}</td>
                <td className="num">{l.throughput}</td>
                <td className="num muted">{(l.throughput/l.hours).toFixed(1)}</td>
                <td><Pill tone={l.product === 'chip' ? 'green' : 'lime'}>{l.product}</Pill></td>
                <td className="muted">{l.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      sideCard={<CostBreakdownCard component="grinder" />}
    />
  );
}

// ─── CARBONATOR ─────────────────────────────
function CarbonatorPanel() {
  const [days, setDays] = useState(30);
  const logs = DATA.carbonatorLogs;
  const T = window.AGG.carbonatorTotals;
  const { dates, actualVals, budgetVals, actualTotal, budgetTotal, unit } =
    useRangeSeries({ days, logs, metricKey: 'throughput', component: 'carbonator' });
  return (
    <OpLayout
      kpis={[
        { label: 'Carbon · 90d', tone:'cyan', value: T.throughput.toFixed(1) + ' t', sub: `${(T.throughput/Math.max(T.hours,1)).toFixed(2)} t/h` },
        { label: 'Operating Hours', tone:'amber', value: T.hours.toFixed(0) + 'h', sub: '90d total' },
        { label: 'Avg run', tone:'green', value: (T.hours / Math.max(T.entries,1)).toFixed(1) + 'h', sub: `${T.entries} runs` },
        { label: 'Utilisation', tone:'blue', value: ((T.entries / 65) * 100).toFixed(0) + '%', sub: 'of working days' },
      ]}
      chartTitle={`Carbon throughput · ${days}d`}
      chartRight={<RangeSelector value={days} onChange={setDays} />}
      variance={<BudgetVariance actual={actualTotal} budget={budgetTotal} unit={unit} fmtFn={v => v.toFixed(1)} />}
      chart={<LineChart height={220} xLabels={dates.map(fmt.date)} yFmt={v=>v.toFixed(1)+'t'} series={[
        { label:'Actual t/day', values: actualVals, color:'#0891b2' },
        { label:'Budget t/day', values: budgetVals, color:'#64748b', dashed: true, fill: false },
      ]} />}
      tableTitle="Recent Carbonator Runs"
      table={
        <table className="table">
          <thead><tr><th>Date</th><th className="num">Hours</th><th className="num">Carbon (t)</th><th className="num">Rate (t/h)</th><th>Operator</th></tr></thead>
          <tbody>
            {logs.slice(-10).reverse().map(l => (
              <tr key={l.id}>
                <td>{fmt.date(l.date)} <span className="muted">{fmt.dow(l.date)}</span></td>
                <td className="num">{l.hours.toFixed(1)}</td>
                <td className="num">{l.throughput.toFixed(2)}</td>
                <td className="num muted">{(l.throughput/l.hours).toFixed(2)}</td>
                <td className="muted">{l.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      sideCard={<CostBreakdownCard component="carbonator" />}
    />
  );
}

// ─── MILL ───────────────────────────────────
function MillPanel() {
  const [days, setDays] = useState(30);
  const T = window.AGG.millTotals;
  const sizeKeys = ['F1','F2','M1','C1'];
  const sizeColors = { F1:'#10b981', F2:'#65a30d', M1:'#0891b2', C1:'#2563eb' };
  const { dates, actualVals, budgetVals, actualTotal, budgetTotal, unit } =
    useRangeSeries({ days, logs: DATA.millLogs, metricKey: 'm3', component: 'mill' });

  return (
    <div>
      <div className="grid grid-4 stat-row">
        <Stat label="Sawn m³ · 90d" tone="purple" value={T.m3.toFixed(1)} sub={`${T.entries} runs`} />
        <Stat label="F1 (premium)"  tone="green"  value={T.bySize.F1.toFixed(1) + ' m³'} sub="structural" />
        <Stat label="F2 / M1"       tone="cyan"   value={(T.bySize.F2 + T.bySize.M1).toFixed(1) + ' m³'} sub="merch / mid-grade" />
        <Stat label="C1 (commodity)" tone="blue"  value={T.bySize.C1.toFixed(1) + ' m³'} sub="commodity / pulp" />
      </div>

      <div className="grid grid-12">
        <div className="span-8">
          <Card title={`Mill throughput · ${days}d`} glyph="🪵" right={<RangeSelector value={days} onChange={setDays} />}>
            <BudgetVariance actual={actualTotal} budget={budgetTotal} unit={unit} fmtFn={v => v.toFixed(1)} />
            <LineChart height={220} xLabels={dates.map(fmt.date)} yFmt={v=>v.toFixed(1)+'m³'} series={[
              { label:'Actual m³/day', values: actualVals, color:'#7c3aed' },
              { label:'Budget m³/day', values: budgetVals, color:'#64748b', dashed: true, fill: false },
            ]} />
          </Card>
          <Card title="Recent Mill Runs" glyph="📋">
            <table className="table">
              <thead><tr><th>Date</th><th>Size</th><th className="num">m³</th><th>Operator</th></tr></thead>
              <tbody>
                {DATA.millLogs.slice(-10).reverse().map(l => (
                  <tr key={l.id}>
                    <td>{fmt.date(l.date)} <span className="muted">{fmt.dow(l.date)}</span></td>
                    <td><Pill tone={l.size === 'F1' ? 'green' : l.size === 'F2' ? 'lime' : l.size === 'M1' ? 'cyan' : 'blue'}>{l.size}</Pill></td>
                    <td className="num">{l.m3.toFixed(2)}</td>
                    <td className="muted">{l.operator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <div className="span-4">
          <Card title="Output Mix" glyph="📐">
            <Donut size={150} thickness={22}
              label={T.m3.toFixed(0)+'m³'}
              sub="90d"
              data={sizeKeys.map(k => ({ label: k, value: T.bySize[k], color: sizeColors[k] }))}
            />
          </Card>
          <CostBreakdownCard component="mill" />
        </div>
      </div>
    </div>
  );
}

// ─── STOCK ───────────────────────────────────
function StockPanel() {
  const totalStock = DATA.STOCK.reduce((s,x)=>s+x.m3, 0);
  const totalCapacity = DATA.STOCK.reduce((s,x)=>s+x.target, 0);
  return (
    <div>
      <div className="grid grid-4 stat-row">
        <Stat label="Total Stock" tone="green" value={fmt.n(totalStock) + ' m³'} sub={`${DATA.STOCK.length} products`} />
        <Stat label="Yard Utilisation" tone="cyan" value={((totalStock/totalCapacity)*100).toFixed(0) + '%'} sub={`of ${fmt.n(totalCapacity)} m³ cap`} />
        <Stat label="Below 50%" tone="amber" value={DATA.STOCK.filter(s=>s.m3/s.target<0.5).length} sub="products to top up" />
        <Stat label="At capacity" tone="red" value={DATA.STOCK.filter(s=>s.m3/s.target>0.9).length} sub="needs movement" />
      </div>

      <Card title="Yard Bays · Live Stock" glyph="📦">
        <div className="grid grid-2" style={{ gap: 12 }}>
          {DATA.STOCK.map(s => {
            const pct = (s.m3 / s.target) * 100;
            const tone = pct > 80 ? s.tone : pct > 40 ? 'amber' : 'red';
            return (
              <div key={s.product} style={{ background:'var(--bg-2)', border:'1px solid var(--border-soft)', borderRadius: 6, padding: 14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 8 }}>
                  <div>
                    <div style={{ textTransform:'capitalize', fontSize: 14, fontWeight: 600, color: `var(--${s.tone})` }}>{s.product}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{s.location}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'var(--mono)', fontSize: 20, fontWeight: 700, color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>{fmt.n(s.m3)}<span style={{ fontSize: 11, color:'var(--text-dim)' }}> m³</span></div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>cap {fmt.n(s.target)} m³</div>
                  </div>
                </div>
                <Progress value={s.m3} max={s.target} tone={tone} height={8} />
                <div style={{ display:'flex', justifyContent:'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
                  <span>{pct.toFixed(0)}% full</span>
                  <span>{pct > 90 ? '⚠ at cap' : pct > 50 ? 'healthy' : pct > 25 ? 'low' : 'critical'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── shared cost breakdown card ─────────────────
function CostBreakdownCard({ component }) {
  const items = DATA.costLogs.filter(c => c.component === component);
  const cats = {};
  items.forEach(c => { cats[c.category] = (cats[c.category] || 0) + c.amount; });
  if (component === 'excavator') {
    cats['Wages (wet-hire)'] = (cats['Wages (wet-hire)'] || 0) + DATA.excavatorLogs.reduce((s,e)=>s+e.cost, 0);
  }
  const arr = Object.entries(cats).map(([category, amount]) => ({ category, amount })).sort((a,b)=>b.amount-a.amount);
  const total = arr.reduce((s,x)=>s+x.amount, 0);
  return (
    <Card title="Cost Inputs · 90d" glyph="💸" right={<span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, fontVariantNumeric:'tabular-nums' }}>{fmt.$(total, 0)}</span>}>
      {arr.length ? <HBars data={arr} /> : <div className="empty">No cost entries</div>}
    </Card>
  );
}

window.OperationsTab = OperationsTab;
