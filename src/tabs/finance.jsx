// Finance tab — cashflow, P&L, profitability map, COGS calculator

// Earliest month shown in the Finance views. Synthetic months before
// this are dropped from the P&L table and trend chart.
const FINANCE_MIN_MONTH = '2025-11';

// Temporary hard-coded actuals from Carbonchip's Xero P&L
// (Dec 2025 → Apr 2026). Imported uploads still override these.
const FINANCE_HARDCODED_PL = {
  '2025-12': { tradingIncome: 264592.91, costOfSales: 198045.75, grossProfit:  66547.16, otherIncome:   -962.73, operatingExpenses: 166717.20, netProfit: -101132.77 },
  '2026-01': { tradingIncome: 409097.18, costOfSales: 154440.43, grossProfit: 254656.75, otherIncome:  58412.99, operatingExpenses: 158410.68, netProfit:  154659.06 },
  '2026-02': { tradingIncome: 327727.25, costOfSales: 157408.04, grossProfit: 170319.21, otherIncome:  -2918.18, operatingExpenses: 233391.88, netProfit:  -65990.85 },
  '2026-03': { tradingIncome: 368266.93, costOfSales: 261846.91, grossProfit: 106420.02, otherIncome:  -4301.99, operatingExpenses: 205701.11, netProfit: -103583.08 },
  '2026-04': { tradingIncome: 513945.10, costOfSales: 180539.87, grossProfit: 333405.23, otherIncome:  17494.63, operatingExpenses: 245330.14, netProfit:  105569.72 },
};

window.FINANCE_HARDCODED_PL = FINANCE_HARDCODED_PL;
window.FINANCE_MIN_MONTH = FINANCE_MIN_MONTH;

function FinanceTab() {
  const [section, setSection] = useState('overview');
  return (
    <div>
      <Subnav
        items={[
          { id: 'overview', icon: '💰', label: 'Cashflow & P&L' },
          { id: 'cogs',     icon: '📦', label: 'COGS Calculator' },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === 'overview' && <FinanceOverview />}
      {section === 'cogs'     && <CogsCalculator />}
    </div>
  );
}

function FinanceOverview() {
  const A = window.AGG;
  const [imported, setImported] = useState(() => window.PLImport.loadImportedPL());
  const [trendMonths, setTrendMonths] = useState(3);

  // 90d cashflow: rolling cumulative
  let cumIn = 0, cumOut = 0;
  const cashflow = A.daily.map(d => {
    cumIn += d.revenue;
    cumOut += d.cost;
    return { date: d.date, in: cumIn, out: cumOut, net: cumIn - cumOut };
  });

  // 60-day forecast: project daily averages forward
  const avgRev = A.daily.slice(-30).reduce((s,d)=>s+d.revenue,0) / 30;
  const avgCost = A.daily.slice(-30).reduce((s,d)=>s+d.cost,0) / 30;
  const forecast = [];
  let fIn = cumIn, fOut = cumOut;
  for (let i = 1; i <= 60; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    fIn += avgRev; fOut += avgCost;
    forecast.push({ date: iso(d), in: fIn, out: fOut, net: fIn - fOut });
  }
  const allCash = [...cashflow, ...forecast];

  // P&L by month — synthetic data (filtered to >= FINANCE_MIN_MONTH so the
  // pre-November 2025 demo history doesn't show on the Finance views)
  const months = {};
  DATA.haulageLogs.filter(h => h.direction === 'outbound').forEach(h => {
    const m = h.date.slice(0, 7);
    if (m < FINANCE_MIN_MONTH) return;
    months[m] = months[m] || { rev: 0, cost: 0 };
    months[m].rev += h.revenue;
  });
  DATA.costLogs.forEach(c => {
    const m = c.date.slice(0, 7);
    if (m < FINANCE_MIN_MONTH) return;
    months[m] = months[m] || { rev: 0, cost: 0 };
    months[m].cost += c.amount;
  });
  DATA.excavatorLogs.forEach(e => {
    const m = e.date.slice(0, 7);
    if (m < FINANCE_MIN_MONTH) return;
    months[m] = months[m] || { rev: 0, cost: 0 };
    months[m].cost += e.cost;
  });

  // Build the unified set of months. Priority on overlap:
  //   imported (user upload) > hardcoded actuals > synthetic demo.
  const monthSet = new Set([
    ...Object.keys(months),
    ...Object.keys(imported.months || {}),
    ...Object.keys(FINANCE_HARDCODED_PL),
  ]);
  const monthRows = [...monthSet]
    .filter(m => m >= FINANCE_MIN_MONTH)
    .sort()
    .map(m => {
      const syn = months[m];
      const imp = imported.months && imported.months[m];
      const hc  = FINANCE_HARDCODED_PL[m];
      const pl  = imp || hc;
      let rev, cost, ebitda, netProfit, source;
      if (pl) {
        const tradingIncome = pl.tradingIncome || 0;
        const otherIncome = pl.otherIncome || 0;
        rev = tradingIncome + otherIncome;
        cost = (pl.costOfSales || 0) + (pl.operatingExpenses || 0);
        ebitda = rev - cost;
        netProfit = pl.netProfit !== null && pl.netProfit !== undefined ? pl.netProfit : ebitda;
        source = imp ? 'imported' : 'hardcoded';
      } else if (syn) {
        rev = syn.rev;
        cost = syn.cost;
        ebitda = rev - cost;
        netProfit = ebitda;
        source = 'synthetic';
      } else {
        rev = 0; cost = 0; ebitda = 0; netProfit = 0; source = 'empty';
      }
      return {
        month: m, rev, cost, ebitda, netProfit,
        margin: rev ? ebitda / rev : 0,
        source,
      };
    });

  // Restrict to months up to today, then slice to selected window
  const todayKey = iso(new Date()).slice(0,7);
  const pastRows = monthRows.filter(r => r.month <= todayKey);
  const trendRows = pastRows.slice(-trendMonths);
  const trendLabels = trendRows.map(r =>
    new Date(r.month + '-01').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
  );
  const rangeStartLabel = trendRows.length
    ? new Date(trendRows[0].month + '-01').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
    : null;

  const hasImported = Object.keys(imported.months || {}).length > 0;

  return (
    <div>
      <div className="grid grid-4 stat-row">
        <Stat label="Cash In · 90d" tone="green" value={fmt.$(A.revenueCollected, 0)} sub="collected" />
        <Stat label="Cash Out · 90d" tone="red" value={fmt.$(A.costsYTD, 0)} sub="all categories" />
        <Stat label="Net Position" tone="cyan" value={fmt.$(A.revenueCollected - A.costsYTD, 0)} sub="cash basis" />
        <Stat label="Forecast · 60d" tone="amber" value={fmt.$(A.revenueCollected - A.costsYTD + (avgRev - avgCost) * 60, 0)} sub={`@ avg ${fmt.$(avgRev - avgCost, 0)}/day`} />
      </div>

      <Card title="Rolling Cashflow · 90d actual + 60d forecast" glyph="💵" right={
        <div style={{ display:'flex', gap:8 }}>
          <span className="pill pill-green">Cash In</span>
          <span className="pill pill-red">Cash Out</span>
          <span className="pill pill-cyan">Net Position</span>
          <span className="pill pill-amber">Forecast →</span>
        </div>
      }>
        <LineChart
          height={280}
          xLabels={allCash.map((d, i) => i % 15 === 0 ? fmt.date(d.date) : '')}
          yFmt={v => '$' + (v/1000).toFixed(0) + 'k'}
          series={[
            { label: 'Cash In',   values: allCash.map(c=>c.in),  color: '#10b981' },
            { label: 'Cash Out',  values: allCash.map(c=>c.out), color: '#e11d48' },
            { label: 'Net',       values: allCash.map(c=>c.net), color: '#0891b2', fill: false, strokeWidth: 2.4 },
          ]}
        />
        <div style={{ height: 1, background: 'var(--border)', margin: '8px 0 4px', position:'relative' }}>
          <div style={{ position:'absolute', left: '60%', top:-3, height: 7, width: 1, background:'var(--amber)' }} />
          <div style={{ position:'absolute', left: '60%', top:-18, fontSize: 9, color:'var(--amber)' }}>TODAY</div>
        </div>
      </Card>

      <Card title="Monthly P&L · Trend" glyph="📈" right={
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <RangeSelector
            value={trendMonths}
            onChange={setTrendMonths}
            options={[
              { id: 3,  label: '3m' },
              { id: 6,  label: '6m' },
              { id: 12, label: '12m' },
              { id: 36, label: '36m' },
            ]}
          />
          <span className="pill pill-green">Revenue</span>
          <span className="pill pill-red">Cost</span>
          <span className="pill pill-cyan">Net Profit</span>
          <PLUploader onImported={setImported} />
        </div>
      }>
        {rangeStartLabel && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
            From <b style={{ color: 'var(--text)' }}>{rangeStartLabel}</b> · {trendRows.length} month{trendRows.length === 1 ? '' : 's'} through today
          </div>
        )}
        {trendRows.length === 0 ? (
          <div className="empty">No monthly data yet. Upload a P&L PDF to populate trends.</div>
        ) : (
          <LineChart
            height={280}
            xLabels={trendLabels}
            yFmt={v => '$' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(0) + 'k' : v.toFixed(0))}
            xTooltipFmt={i => trendLabels[i]}
            series={[
              { label: 'Revenue',    values: trendRows.map(r=>r.rev),       color: '#10b981' },
              { label: 'Cost',       values: trendRows.map(r=>r.cost),      color: '#e11d48' },
              { label: 'Net Profit', values: trendRows.map(r=>r.netProfit), color: '#0891b2', fill: false, strokeWidth: 2.4 },
            ]}
          />
        )}
      </Card>

      <div className="grid grid-12">
        <div className="span-7">
          <Card title="Profitability Map · by Client" glyph="🗺️" right={<span className="pill pill-muted">Revenue × Margin</span>}>
            <Scatter
              height={300}
              points={A.profitByClient.map(c => ({
                x: c.revenue,
                y: c.margin * 100,
                label: c.short,
                color: `var(--${c.tone})` === 'var(--green)' ? '#10b981' :
                       c.tone === 'cyan' ? '#0891b2' :
                       c.tone === 'amber' ? '#d97706' :
                       c.tone === 'purple' ? '#7c3aed' : '#88b89a',
                size: 8 + Math.sqrt(c.revenue) / 30,
              }))}
              xLabel="REVENUE · 90D ($)"
              yLabel="MARGIN %"
              xFmt={v => '$' + (v/1000).toFixed(0) + 'k'}
              yFmt={v => v.toFixed(0) + '%'}
            />
          </Card>

          <Card title="Monthly P&L" glyph="📒" right={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {hasImported && <span className="pill pill-cyan" title="Months with imported figures override synthetic data">⬆ Imported {Object.keys(imported.months).length} mo</span>}
              <span className="pill pill-amber" title="Hard-coded actuals from Xero P&L (Dec 2025 →)">📌 Actuals {Object.keys(FINANCE_HARDCODED_PL).length} mo</span>
              <span className="pill pill-muted">last {trendRows.length} mo</span>
            </div>
          }>
            <table className="table">
              <thead><tr>
                <th>Month</th><th className="num">Revenue</th><th className="num">Cost</th><th className="num">EBITDA</th><th className="num">Net Profit</th><th className="num">Margin</th><th></th>
              </tr></thead>
              <tbody>
                {trendRows.map(r => (
                  <tr key={r.month}>
                    <td>
                      {new Date(r.month + '-01').toLocaleDateString('en-AU', { month:'long', year:'numeric' })}
                      {r.source === 'imported' && <span className="pill pill-cyan" style={{ marginLeft: 6, fontSize: 9 }} title="From uploaded P&L">IMPORTED</span>}
                      {r.source === 'hardcoded' && <span className="pill pill-amber" style={{ marginLeft: 6, fontSize: 9 }} title="Temporary hard-coded actual from Xero P&L">ACTUAL</span>}
                    </td>
                    <td className="num" style={{ color:'var(--green)' }}>{fmt.$(r.rev, 0)}</td>
                    <td className="num" style={{ color:'var(--red)' }}>{fmt.$(r.cost, 0)}</td>
                    <td className="num" style={{ color: r.ebitda > 0 ? 'var(--cyan)' : 'var(--red)' }}>{fmt.$(r.ebitda, 0)}</td>
                    <td className="num" style={{ color: r.netProfit > 0 ? 'var(--green)' : 'var(--red)' }}>{fmt.$(r.netProfit, 0)}</td>
                    <td className="num">{(r.margin * 100).toFixed(1)}%</td>
                    <td style={{ width: 100 }}>
                      <div className="progress" style={{ height: 6 }}>
                        <div className="progress-bar" style={{ width: Math.min(100, Math.max(0, r.margin * 100)) + '%', background: r.ebitda > 0 ? 'linear-gradient(90deg, var(--green-dim), var(--green-bright))' : 'var(--red)' }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="span-5">
          <Card title="Costs by Category · 90d" glyph="🧮">
            <HBars data={A.costsByCategory} />
          </Card>
          <Card title="Costs by Component · 90d" glyph="🔧">
            <HBars data={A.costsByComponent} labelKey="component" />
          </Card>
          <Card title="Profitability Detail" glyph="📊">
            <table className="table">
              <thead><tr><th>Client</th><th className="num">Revenue</th><th className="num">Alloc Cost</th><th className="num">Margin</th></tr></thead>
              <tbody>
                {A.profitByClient.sort((a,b)=>b.margin-a.margin).map(c => (
                  <tr key={c.id}>
                    <td><span style={{ color:`var(--${c.tone})` }}>{c.short}</span></td>
                    <td className="num">{fmt.$(c.revenue, 0)}</td>
                    <td className="num muted">{fmt.$(c.allocCost, 0)}</td>
                    <td className="num" style={{ color: c.margin > 0.5 ? 'var(--green)' : c.margin > 0.2 ? 'var(--amber)' : 'var(--red)' }}>{(c.margin*100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.FinanceTab = FinanceTab;
