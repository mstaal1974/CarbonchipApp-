// Forecast tab — capacity, capability, what-if scenarios

function ForecastTab() {
  const A = window.AGG;

  // What-if levers
  const [grinderHours, setGrinderHours] = useState(8);     // hrs/day
  const [haulageTrucks, setHaulageTrucks] = useState(3);
  const [haulageLoadsPerTruck, setHaulageLoadsPerTruck] = useState(2.5);
  const [carbonatorHours, setCarbonatorHours] = useState(6);
  const [downtime, setDowntime] = useState(10);
  const [newClient, setNewClient] = useState(0); // additional $/yr

  const workDays = 250 - downtime;

  // Capacity calcs
  const grinderCapM3 = grinderHours * 45 * workDays;             // 45 m³/h avg
  const haulageCapTonnes = haulageTrucks * haulageLoadsPerTruck * 56 * workDays;
  const carbonatorCapT = carbonatorHours * 1.15 * workDays;
  const millCapM3 = 5 * workDays;                                // ~5 m³/day baseline

  // Demand from contracts
  const demandTonnes = DATA.CLIENTS.reduce((s,c) => {
    if (c.loadsPerDay) return s + c.loadsPerDay * 250 * (c.tonnesPerLoad || c.m3PerLoad*0.55);
    return s + c.loadsPerWeek * 50 * (c.m3PerLoad * 0.55);
  }, 0);

  const haulageUtil = (demandTonnes / haulageCapTonnes) * 100;
  // Grinder needs m³ to feed: roughly (demand t / 0.55) m³ throughput
  const grinderDemandM3 = demandTonnes / 0.55;
  const grinderUtil = (grinderDemandM3 / grinderCapM3) * 100;
  const carbonatorUtil = ((A.carbonatorTotals.throughput * 4) / carbonatorCapT) * 100;
  const millUtil = ((A.millTotals.m3 * 4) / millCapM3) * 100;

  // Revenue under scenario
  const baseAnnual = A.annualProjected;
  const scenarioAnnual = baseAnnual + newClient;

  // 12-month forecast curve
  const forecast12 = Array.from({ length: 12 }, (_, i) => {
    const monthRev = scenarioAnnual / 12 * (1 + (i * 0.01));  // gentle ramp
    return monthRev;
  });
  const labels12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() + i);
    return d.toLocaleDateString('en-AU', { month:'short' });
  });

  // Risks
  const risks = [
    { label: 'Driver pool', value: 2, max: 4, tone: haulageTrucks > 2 ? 'amber' : 'green', sub: '2 drivers · 3 trucks' },
    { label: 'Stock buffer (chip)',  value: 1840, max: 2200, tone: 'cyan', sub: '84% of cap · 5d cover' },
    { label: 'BD-03 service',  value: 0, max: 100, tone: 'amber', sub: 'returns in 4d · check brakes' },
    { label: 'Reg expiry (BD-03)', value: 9, max: 30, tone: 'amber', sub: '9 days remaining' },
    { label: 'Teeth/grates spend', value: 4, max: 10, tone: 'cyan', sub: 'next change ~14d' },
  ];

  return (
    <div>
      <div className="grid grid-4 stat-row">
        <Stat label="Annual · Base"      tone="amber" value={fmt.$(baseAnnual / 1000, 0) + 'k'} sub="active contracts" />
        <Stat label="Annual · Scenario"  tone="cyan"  value={fmt.$(scenarioAnnual / 1000, 0) + 'k'} sub={newClient > 0 ? `+${fmt.$(newClient/1000,0)}k from new` : 'no scenarios'} />
        <Stat label="Working Days"       tone="green" value={workDays} sub={`5d/wk less ${downtime}d down`} />
        <Stat label="Forecast Confidence" tone="purple" value={haulageUtil < 95 && grinderUtil < 95 ? 'HIGH' : haulageUtil < 110 ? 'MED' : 'LOW'} sub="bottleneck check" />
      </div>

      <div className="grid grid-12">
        <div className="span-8">
          <Card title="Capacity vs Demand · Annualised" glyph="🎚️" right={<span className="pill pill-muted">drag levers ↓</span>}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 18 }}>
              <UtilGauge label="Haulage" tone={haulageUtil > 95 ? 'red' : haulageUtil > 80 ? 'amber' : 'green'} value={haulageUtil} demand={demandTonnes} capacity={haulageCapTonnes} unit="t" />
              <UtilGauge label="Grinder" tone={grinderUtil > 95 ? 'red' : grinderUtil > 80 ? 'amber' : 'green'} value={grinderUtil} demand={grinderDemandM3} capacity={grinderCapM3} unit="m³" />
              <UtilGauge label="Carbonator" tone={carbonatorUtil > 95 ? 'red' : carbonatorUtil > 80 ? 'amber' : 'cyan'} value={carbonatorUtil} demand={A.carbonatorTotals.throughput*4} capacity={carbonatorCapT} unit="t" />
              <UtilGauge label="Mill" tone={millUtil > 95 ? 'red' : millUtil > 80 ? 'amber' : 'purple'} value={millUtil} demand={A.millTotals.m3*4} capacity={millCapM3} unit="m³" />
            </div>
          </Card>

          <Card title="12-Month Revenue Forecast" glyph="📅" right={
            <div style={{ display:'flex', gap:8 }}>
              <span className="pill pill-cyan">Scenario</span>
              <span className="pill pill-muted">Capacity ceiling</span>
            </div>
          }>
            <LineChart
              height={240}
              xLabels={labels12}
              yFmt={v => '$' + (v/1000).toFixed(0) + 'k'}
              series={[
                { label: 'Forecast monthly', values: forecast12, color: '#0891b2' },
                { label: 'Haulage capacity ($)', values: Array(12).fill(haulageCapTonnes * 108 / 12), color: '#d97706', fill: false },
              ]}
            />
          </Card>
        </div>

        <div className="span-4">
          <Card title="Scenario Levers" glyph="🎛️">
            <ScenarioSlider label="Grinder hrs/day" value={grinderHours} min={4} max={16} step={0.5} onChange={setGrinderHours} unit="h" />
            <ScenarioSlider label="Haulage trucks" value={haulageTrucks} min={1} max={6} step={1} onChange={setHaulageTrucks} unit="" />
            <ScenarioSlider label="Loads/truck/day" value={haulageLoadsPerTruck} min={1} max={5} step={0.5} onChange={setHaulageLoadsPerTruck} unit="" />
            <ScenarioSlider label="Carbonator hrs/day" value={carbonatorHours} min={2} max={12} step={1} onChange={setCarbonatorHours} unit="h" />
            <ScenarioSlider label="Downtime days/year" value={downtime} min={0} max={40} step={1} onChange={setDowntime} unit="d" />
            <ScenarioSlider label="New client revenue" value={newClient} min={0} max={3000000} step={50000} onChange={setNewClient} unit="$" />
            <div className="divider" />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
              setGrinderHours(8); setHaulageTrucks(3); setHaulageLoadsPerTruck(2.5);
              setCarbonatorHours(6); setDowntime(10); setNewClient(0);
            }}>Reset to baseline</button>
          </Card>

          <Card title="Capability Watchlist" glyph="⚠️">
            <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
              {risks.map((r, i) => (
                <div key={i}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color:'var(--text)' }}>{r.label}</span>
                    <span style={{ color:`var(--${r.tone})`, fontVariantNumeric:'tabular-nums' }}>{r.sub}</span>
                  </div>
                  <Progress value={r.value} max={r.max} tone={r.tone} height={5} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function UtilGauge({ label, value, tone, demand, capacity, unit }) {
  return (
    <div style={{ background:'var(--bg-2)', border:'1px solid var(--border-soft)', borderRadius: 6, padding: 14, textAlign:'center' }}>
      <Gauge value={Math.min(value, 100)} max={100} tone={tone} size={130} sub="USED" />
      <div style={{ fontSize: 11, color: 'var(--text)', fontWeight: 600, marginTop: 4 }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, fontVariantNumeric:'tabular-nums' }}>
        {fmt.n(demand, 0)} {unit} <span className="faint">/ {fmt.n(capacity, 0)} {unit}</span>
      </div>
      {value > 100 && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--red)' }}>⚠ BOTTLENECK</div>}
    </div>
  );
}

function ScenarioSlider({ label, value, min, max, step, onChange, unit }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color:'var(--text-dim)' }}>{label}</span>
        <span style={{ fontFamily:'var(--mono)', fontSize: 13, fontWeight: 600, color:'var(--green-bright)', fontVariantNumeric:'tabular-nums' }}>
          {unit === '$' ? '$' + (value/1000).toFixed(0) + 'k' : `${value}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        style={{
          width: '100%',
          appearance: 'none', WebkitAppearance: 'none',
          height: 4,
          background: `linear-gradient(90deg, var(--green-dim) 0%, var(--green-dim) ${((value-min)/(max-min))*100}%, var(--bg-2) ${((value-min)/(max-min))*100}%, var(--bg-2) 100%)`,
          borderRadius: 2,
          outline: 'none',
        }}
      />
    </div>
  );
}

window.ForecastTab = ForecastTab;
