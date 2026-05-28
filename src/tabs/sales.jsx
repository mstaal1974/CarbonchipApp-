// Sales tab — clients, contracts, AR aging, pipeline + quote builder

function SalesTab() {
  const [section, setSection] = useState('overview');
  return (
    <div>
      <Subnav
        items={[
          { id: 'overview', icon: '📊', label: 'Pipeline & AR' },
          { id: 'quote',    icon: '📝', label: 'Quote Builder' },
        ]}
        value={section}
        onChange={setSection}
      />
      {section === 'overview' && <SalesOverview />}
      {section === 'quote'    && <QuoteBuilder />}
    </div>
  );
}

function SalesOverview() {
  const A = window.AGG;
  const sales = DATA.haulageLogs.filter(h => h.direction === 'outbound');
  const today = new Date();

  // AR aging
  const aging = { current:0, '0-30':0, '31-60':0, '61-90':0, '90+':0 };
  sales.filter(s => s.invoiceStatus === 'open' || s.invoiceStatus === 'overdue').forEach(s => {
    const days = Math.floor((today - new Date(s.date)) / 86400000);
    if (days < 7) aging.current += s.revenue;
    else if (days < 30) aging['0-30'] += s.revenue;
    else if (days < 60) aging['31-60'] += s.revenue;
    else if (days < 90) aging['61-90'] += s.revenue;
    else aging['90+'] += s.revenue;
  });
  const arTotal = Object.values(aging).reduce((s,v)=>s+v, 0);

  // Revenue by product
  const byProduct = {};
  sales.forEach(s => { byProduct[s.productName] = (byProduct[s.productName] || 0) + s.revenue; });
  const productData = Object.entries(byProduct).map(([k,v])=>({ category: k, amount: v })).sort((a,b)=>b.amount-a.amount);

  return (
    <div>
      <div className="grid grid-4 stat-row">
        <Stat label="Pipeline · Annual" tone="amber" value={fmt.$(A.annualProjected, 0)} sub={`${DATA.CLIENTS.length} active contracts`} />
        <Stat label="Booked · YTD" tone="green" value={fmt.$(A.revenueYTD, 0)} sub={`${A.totalLoads} loads`} />
        <Stat label="AR · Outstanding" tone="amber" value={fmt.$(A.revenueOutstanding, 0)} sub={`${sales.filter(s=>s.invoiceStatus==='open'||s.invoiceStatus==='overdue').length} invoices`} />
        <Stat label="AR · Overdue >30d" tone="red" value={fmt.$(aging['31-60']+aging['61-90']+aging['90+'], 0)} sub="needs follow-up" />
      </div>

      <div className="grid grid-12">
        <div className="span-7">
          <Card title="Client Contracts" glyph="🤝">
            <table className="table">
              <thead><tr>
                <th>Client</th><th>Product</th><th>Cadence</th><th className="num">Rate</th><th className="num">Per Load</th><th className="num">YTD Rev</th><th className="num">Annual</th><th>Delivery</th>
              </tr></thead>
              <tbody>
                {A.byClient.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ width:8, height:8, background:`var(--${c.tone})`, borderRadius: '50%' }} />
                        <div>
                          <b style={{ color:'var(--text)' }}>{c.name}</b>
                          <div className="muted" style={{ fontSize: 10 }}>{c.short.toLowerCase()}@carbonchip.au</div>
                        </div>
                      </div>
                    </td>
                    <td><Pill tone={c.tone}>{c.product}</Pill></td>
                    <td className="muted">{c.loadsPerDay ? `${c.loadsPerDay}/day` : `${c.loadsPerWeek}/wk`}</td>
                    <td className="num">${c.rate.toFixed(2)}/{c.unit}</td>
                    <td className="num muted">{c.unit === 't' ? `${c.tonnesPerLoad}t` : `${c.m3PerLoad}m³`}</td>
                    <td className="num">{fmt.$(c.revenue, 0)}</td>
                    <td className="num">{fmt.$(c.annual, 0)}</td>
                    <td>{c.deliver ? <Pill tone="green">delivered</Pill> : <Pill tone="amber">pickup</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Recent Invoices" glyph="🧾">
            <table className="table">
              <thead><tr>
                <th>Inv #</th><th>Client</th><th>Date</th><th>Product</th><th className="num">Amount</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {sales.filter(s=>s.invoiceStatus).slice(-12).reverse().map(s => (
                  <tr key={s.id}>
                    <td className="muted">INV-{s.id.replace('H','')}</td>
                    <td>{s.client}</td>
                    <td>{fmt.date(s.date)}</td>
                    <td className="muted">{s.productName}</td>
                    <td className="num">{fmt.$(s.revenue, 2)}</td>
                    <td>
                      <Pill tone={s.invoiceStatus === 'paid' ? 'green' : s.invoiceStatus === 'overdue' ? 'red' : 'amber'}>
                        {s.invoiceStatus}
                      </Pill>
                    </td>
                    <td><button className="btn btn-ghost" style={{ fontSize: 10 }}>VIEW</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="span-5">
          <Card title="AR Aging" glyph="⏳">
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { label: 'Current (< 7d)', value: aging.current, tone: 'green' },
                { label: '0–30 days',       value: aging['0-30'], tone: 'cyan' },
                { label: '31–60 days',      value: aging['31-60'], tone: 'amber' },
                { label: '61–90 days',      value: aging['61-90'], tone: 'orange' },
                { label: '90+ days',        value: aging['90+'], tone: 'red' },
              ].map((b, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 140px 110px', gap:10, alignItems:'center', fontSize:12 }}>
                  <span style={{ color:'var(--text)' }}>{b.label}</span>
                  <Progress value={b.value} max={Math.max(arTotal, 1)} tone={b.tone} height={8} />
                  <span className="num" style={{ color: `var(--${b.tone})`, fontVariantNumeric:'tabular-nums', textAlign:'right' }}>{fmt.$(b.value, 0)}</span>
                </div>
              ))}
            </div>
            <div className="divider" />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-dim)' }}>
              <span>TOTAL OUTSTANDING</span>
              <b style={{ color:'var(--amber)', fontFamily:'var(--mono)', fontVariantNumeric:'tabular-nums' }}>{fmt.$(arTotal, 0)}</b>
            </div>
          </Card>

          <Card title="Revenue Mix · by Product" glyph="🧬">
            <Donut size={150} thickness={22}
              label={fmt.$(productData.reduce((s,p)=>s+p.amount, 0)/1000, 0)+'k'}
              sub="90d revenue"
              data={productData.map((p, i) => ({
                label: p.category,
                value: p.amount,
                color: ['#10b981','#0891b2','#d97706','#7c3aed','#ea580c'][i] || '#88b89a',
              }))}
            />
          </Card>

          <Card title="Pipeline · Forecast" glyph="🔮">
            <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
              {A.byClient.map(c => {
                const ytdPace = c.revenue / 90 * 365;
                const pct = (ytdPace / c.annual) * 100;
                return (
                  <div key={c.id}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: `var(--${c.tone})` }}>{c.short}</span>
                      <span style={{ color: 'var(--text-dim)', fontVariantNumeric:'tabular-nums' }}>
                        pace {fmt.$(ytdPace/1000, 0)}k · target {fmt.$(c.annual/1000, 0)}k
                      </span>
                    </div>
                    <Progress value={pct} max={120} tone={pct > 95 ? 'green' : pct > 75 ? 'cyan' : 'amber'} height={6} />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.SalesTab = SalesTab;
