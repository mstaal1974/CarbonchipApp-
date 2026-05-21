// Dashboard tab — exec overview with time range selector

function DashboardTab() {
  const [range, setRange] = useState('quarter');
  const rangeMap = {
    month:    { days:   30, label: 'Month',    sub: '30 days' },
    quarter:  { days:   90, label: 'Quarter',  sub: '90 days' },
    year:     { days:  365, label: 'Year',     sub: 'Last 12 months' },
    triennial:{ days: 1095, label: '3 Years',  sub: 'Last 36 months' },
  };
  const cfg = rangeMap[range];

  const RANGE = useMemo(() => aggregateRange(cfg.days), [cfg.days]);

  // Delta vs previous equivalent period
  const prevRange = useMemo(() => {
    const prev = aggregateRange(cfg.days * 2);
    return {
      revenuePrev: prev.revenue - RANGE.revenue,
      costPrev: prev.cost - RANGE.cost,
    };
  }, [cfg.days, RANGE]);

  const revDelta = prevRange.revenuePrev ? ((RANGE.revenue - prevRange.revenuePrev) / prevRange.revenuePrev) * 100 : 0;
  const costDelta = prevRange.costPrev ? ((RANGE.cost - prevRange.costPrev) / prevRange.costPrev) * 100 : 0;

  const todayLoads = DATA.haulageLogs.filter(h => h.date === iso(new Date()) && h.direction === 'outbound').length;
  const todayInbound = DATA.haulageLogs.filter(h => h.date === iso(new Date()) && h.direction === 'inbound').length;

  // Series for cashflow chart
  const ser = RANGE.series;
  const revVals = ser.map(s => s.revenue);
  const costVals = ser.map(s => s.cost);
  const cashVals = ser.map(s => s.cashPosition);
  const labels = ser.map(s => s.label);
  const xTooltipFmt = (i) => {
    const s = ser[i];
    if (!s) return '';
    if (RANGE.bucket === 'day')   return fmt.dateLong(s.key);
    if (RANGE.bucket === 'week')  return 'Week of ' + fmt.dateLong(s.key);
    if (RANGE.bucket === 'month') return new Date(s.key + '-01T00:00').toLocaleDateString('en-AU', { month:'long', year:'numeric' });
    return s.label;
  };

  const fmtMoney = (v) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return '$' + (v/1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000)     return '$' + (v/1_000).toFixed(0) + 'k';
    return '$' + v.toFixed(0);
  };

  return (
    <div>
      {/* Range selector + page title */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 18, flexWrap:'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, color: 'var(--text)', letterSpacing: '-0.01em' }}>Overview</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
            {cfg.sub} · last updated {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <RangeSelector value={range} onChange={setRange} options={Object.entries(rangeMap).map(([k,v]) => ({ id: k, label: v.label }))} />
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-4 stat-row">
        <Stat label={`Revenue · ${cfg.label}`} tone="green"  value={fmt.$(RANGE.revenue, 0)} sub={`${RANGE.totalLoads} loads`} delta={revDelta} />
        <Stat label={`Costs · ${cfg.label}`}   tone="red"    value={fmt.$(RANGE.cost, 0)}    sub={`${cfg.sub}`} delta={costDelta} />
        <Stat label={`EBITDA · ${cfg.label}`}  tone="cyan"   value={fmt.$(RANGE.ebitda, 0)}  sub={`Margin ${fmt.pct(RANGE.margin, 1)}`} />
        <Stat label="Annual Projected"          tone="amber"  value={fmt.$(RANGE.annualProjected, 0)} sub="from active contracts" />
      </div>

      <div className="grid grid-4 stat-row">
        <Stat label="Cash Position"        tone="purple" value={fmt.$(RANGE.cashPosition, 0)} sub={`${RANGE.cashDelta >= 0 ? '+' : ''}${fmt.$(RANGE.cashDelta, 0)} this period`} />
        <Stat label="Revenue Collected"    tone="green"  value={fmt.$(RANGE.revenueCollected, 0)} sub={`${fmt.pct(RANGE.revenueCollected/Math.max(RANGE.revenue,1))}`} />
        <Stat label="Outstanding"          tone="amber"  value={fmt.$(RANGE.outstanding, 0)} sub={`incl ${fmt.$(RANGE.overdue,0)} overdue`} />
        <Stat label="Loads · Today"        tone="blue"   value={todayLoads} sub={`${todayInbound} inbound`} />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-12">
        {/* Trend chart */}
        <div className="span-8">
          <Card title={`Cashflow · ${cfg.label}`} glyph="📈" right={
            <div style={{ display:'flex', gap:8 }}>
              <span className="pill pill-green">Revenue</span>
              <span className="pill pill-red">Cost</span>
              <span className="pill pill-muted" style={{ color:'#0f172a', borderColor:'#cbd5e1' }}>Cash Position</span>
            </div>
          }>
            <LineChart
              height={280}
              xLabels={labels}
              xTooltipFmt={xTooltipFmt}
              yFmt={fmtMoney}
              yFmtRight={fmtMoney}
              series={[
                { label: 'Revenue',      values: revVals,  color: '#10b981' },
                { label: 'Cost',         values: costVals, color: '#e11d48', fill: false },
                { label: 'Cash Position', values: cashVals, color: '#0f172a', fill: false, axis: 'right', strokeWidth: 2.4 },
              ]}
            />
          </Card>
        </div>

        {/* Operations status */}
        <div className="span-4">
          <Card title={`Operations · ${cfg.label}`} glyph="⚡">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <OpTile icon="🌱" label="Planter" tone="green"
                value={`${fmt.n(RANGE.planterTotals.seedlings)}`}
                unit="seedlings"
                sub={`${RANGE.planterTotals.hectares.toFixed(1)} ha · ${RANGE.planterTotals.entries} runs`} />
              <OpTile icon="🚜" label="Excavator" tone="amber"
                value={`${RANGE.excavatorTotals.hours.toFixed(0)}h`}
                unit="operating"
                sub={fmt.$(RANGE.excavatorTotals.cost, 0) + ' wet-hire'} />
              <OpTile icon="🚛" label="Haulage" tone="blue"
                value={RANGE.totalLoads}
                unit="loads out"
                sub={`${RANGE.inboundLoads} inbound`} />
              <OpTile icon="⚙️" label="Grinder" tone="red"
                value={`${RANGE.grinderTotals.hours.toFixed(0)}h`}
                unit="run-time"
                sub={`${fmt.n(RANGE.grinderTotals.throughput)} m³`} />
              <OpTile icon="🔥" label="Carbonator" tone="cyan"
                value={`${RANGE.carbonatorTotals.hours.toFixed(0)}h`}
                unit="run-time"
                sub={`${RANGE.carbonatorTotals.throughput.toFixed(1)} t carbon`} />
              <OpTile icon="🪵" label="Mill" tone="purple"
                value={`${RANGE.millTotals.m3.toFixed(0)}`}
                unit="m³ sawn"
                sub={`${RANGE.millTotals.entries} runs`} />
            </div>
          </Card>
        </div>

        {/* Revenue by client */}
        <div className="span-7">
          <Card title={`Revenue by Client · ${cfg.label}`} glyph="💰">
            <HBars
              data={RANGE.byClient.map(c => ({ category: c.short, amount: c.revenue }))}
              fmtFn={v => fmt.$(v, 0)}
            />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginTop:16, paddingTop:14, borderTop:'1px solid var(--border-soft)' }}>
              {RANGE.byClient.map(c => (
                <div key={c.id}>
                  <div style={{ fontSize: 11, color:'var(--text-dim)' }}>{c.short}</div>
                  <div style={{ fontSize:18, fontWeight:600, color:`var(--${c.tone})`, fontVariantNumeric:'tabular-nums', letterSpacing: '-0.01em' }}>{fmt.$(c.annual/1000,0)}<span style={{fontSize:11, color:'var(--text-dim)', fontWeight: 400}}>k/yr</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.loads} loads · {fmt.$(c.rate,2)}/{c.unit}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Stock at yard */}
        <div className="span-5">
          <Card title="Yard Stock" glyph="📦" right={<span className="pill pill-muted">{DATA.STOCK.length} products</span>}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {DATA.STOCK.map(s => {
                const pct = (s.m3 / s.target) * 100;
                const tone = pct > 80 ? s.tone : pct > 40 ? 'amber' : 'red';
                return (
                  <div key={s.product} style={{ display:'grid', gridTemplateColumns:'90px 1fr 80px', gap:10, alignItems:'center', fontSize:12 }}>
                    <span style={{ textTransform:'capitalize', color:'var(--text)' }}>{s.product}</span>
                    <Progress value={s.m3} max={s.target} tone={tone} height={8} />
                    <span style={{ textAlign:'right', color:'var(--text-dim)', fontVariantNumeric:'tabular-nums', fontSize: 11 }}>
                      <b style={{ color:`var(--${s.tone})` }}>{fmt.n(s.m3)}</b> / {fmt.n(s.target)} m³
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Contract performance */}
        <div className="span-7">
          <Card title="Contract Performance" glyph="🎯">
            <table className="table">
              <thead><tr>
                <th>Client</th><th>Cadence</th><th>Rate</th><th className="num">Period Revenue</th><th className="num">Annual Target</th><th>Status</th>
              </tr></thead>
              <tbody>
                {RANGE.byClient.map(c => {
                  const pace = c.revenue / cfg.days * 365;
                  const onTrack = pace >= c.annual * 0.92;
                  return (
                    <tr key={c.id}>
                      <td><b style={{ color: 'var(--text)' }}>{c.name}</b><div className="muted" style={{ fontSize: 11 }}>{c.short.toLowerCase()}.contract</div></td>
                      <td className="muted">{c.loadsPerDay ? `${c.loadsPerDay}/day` : `${c.loadsPerWeek}/wk`}</td>
                      <td className="muted">${c.rate.toFixed(2)}/{c.unit}</td>
                      <td className="num">{fmt.$(c.revenue, 0)}</td>
                      <td className="num muted">{fmt.$(c.annual, 0)}</td>
                      <td><Pill tone={onTrack ? 'green' : 'amber'}>{onTrack ? 'On Track' : 'Below Pace'}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        {/* Activity feed */}
        <div className="span-5">
          <Card title="Activity Feed" glyph="📡" right={<span className="pill pill-green"><span className="dot dot-pulse"/>Live</span>}>
            <div style={{ display:'flex', flexDirection:'column' }}>
              {DATA.ACTIVITY.map((a, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'28px 1fr auto', gap:10, alignItems:'flex-start', padding:'8px 0', borderBottom: i < DATA.ACTIVITY.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                  <span style={{ fontSize: 14 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: 12.5, color: 'var(--text)' }}><b style={{ color: `var(--${a.tone})` }}>{a.actor}</b> {a.action}</div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{a.time}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OpTile({ icon, label, tone, value, unit, sub }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border-soft)',
      borderRadius: 8,
      padding: '10px 12px',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontSize: 11.5, color: `var(--${tone})`, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color:'var(--text)', fontVariantNumeric:'tabular-nums', letterSpacing: '-0.01em' }}>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

window.DashboardTab = DashboardTab;
