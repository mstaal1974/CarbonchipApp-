// Charts — minimal SVG. Sparkline / Line / Area / Bars / Donut / Gauge / Scatter / Heatmap

function Sparkline({ values, color = '#4ade80', width = 120, height = 32, fill = true, strokeWidth = 1.5 }) {
  if (!values || values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const step = width / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(2)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {fill && (
        <path d={area} fill={color} fillOpacity={0.14} />
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Line + area chart with axes + hover tooltip + optional right axis
function LineChart({ series, height = 220, xLabels, yFmt, yFmtRight, xTooltipFmt, padding }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const n = series && series.length ? series[0].values.length : 0;
  // Reset hover when series length changes (range switch)
  useEffect(() => { setHover(null); }, [n]);
  const hasRightAxis = series.some(s => s.axis === 'right');
  const pad = padding || { l: 52, r: hasRightAxis ? 56 : 12, t: 12, b: 24 };
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  if (!series || !series.length) return <div ref={wrapRef} className="empty">No data</div>;

  // Per-axis bounds
  const leftSeries = series.filter(s => s.axis !== 'right');
  const rightSeries = series.filter(s => s.axis === 'right');
  const leftVals = leftSeries.flatMap(s => s.values);
  const rightVals = rightSeries.flatMap(s => s.values);
  const leftMin = leftVals.length ? Math.min(0, ...leftVals) : 0;
  const leftMax = leftVals.length ? Math.max(...leftVals, 1) : 1;
  const rightMin = rightVals.length ? Math.min(0, ...rightVals) : 0;
  const rightMax = rightVals.length ? Math.max(...rightVals, 1) : 1;

  // Clamp hover idx defensively in case any state is stale this render
  const safeHover = hover && hover.idx >= 0 && hover.idx < n ? hover : null;
  const xFor = (i) => pad.l + (i / Math.max(n - 1, 1)) * innerW;
  const yForAxis = (v, axis) => {
    const min = axis === 'right' ? rightMin : leftMin;
    const max = axis === 'right' ? rightMax : leftMax;
    const range = (max - min) || 1;
    return pad.t + innerH - ((v - min) / range) * innerH;
  };

  const yTicks = 4;
  const ticksLeft = Array.from({ length: yTicks + 1 }, (_, i) => leftMin + (leftMax - leftMin) * i / yTicks);
  const ticksRight = hasRightAxis ? Array.from({ length: yTicks + 1 }, (_, i) => rightMin + (rightMax - rightMin) * i / yTicks) : [];

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const scale = w / rect.width;
    const mx = (e.clientX - rect.left) * scale;
    const my = (e.clientY - rect.top) * scale;
    if (mx < pad.l || mx > w - pad.r) { setHover(null); return; }
    const rel = (mx - pad.l) / innerW;
    const idx = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
    setHover({ idx, mouseX: mx, mouseY: my });
  };

  let tipStyle = null;
  if (safeHover) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      const cssScale = rect.width / w;
      const lineCssX = (xFor(safeHover.idx)) * cssScale;
      const leftSide = lineCssX < rect.width / 2;
      tipStyle = leftSide
        ? { left: lineCssX + 12, top: 8 }
        : { right: rect.width - lineCssX + 12, top: 8 };
    }
  }

  return (
    <div ref={wrapRef} className="chart-wrap" style={{ position: 'relative' }}>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${height}`} width="100%" height={height}
           onMouseMove={onMove} onMouseLeave={() => setHover(null)}
           style={{ cursor: 'crosshair' }}>
        {/* y grid (left axis) */}
        {ticksLeft.map((t, i) => (
          <g key={'l'+i}>
            <line x1={pad.l} y1={yForAxis(t,'left')} x2={w - pad.r} y2={yForAxis(t,'left')} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 3" />
            <text x={pad.l - 6} y={yForAxis(t,'left') + 3} textAnchor="end" fontSize="10" fill="#64748b" fontFamily="var(--sans)">
              {yFmt ? yFmt(t) : t.toFixed(0)}
            </text>
          </g>
        ))}
        {/* right axis labels */}
        {hasRightAxis && ticksRight.map((t, i) => (
          <text key={'r'+i} x={w - pad.r + 6} y={yForAxis(t,'right') + 3} textAnchor="start" fontSize="10" fill="#64748b" fontFamily="var(--sans)">
            {yFmtRight ? yFmtRight(t) : (yFmt ? yFmt(t) : t.toFixed(0))}
          </text>
        ))}
        {/* x labels */}
        {xLabels && xLabels.map((lbl, i) => {
          if (i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null;
          return (
            <text key={i} x={xFor(i)} y={height - 6} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="var(--sans)">{lbl}</text>
          );
        })}
        {/* series */}
        {series.map((s, si) => {
          const axis = s.axis || 'left';
          const pts = s.values.map((v, i) => `${xFor(i).toFixed(1)},${yForAxis(v, axis).toFixed(1)}`);
          const line = `M ${pts.join(' L ')}`;
          const baseY = yForAxis(axis === 'right' ? rightMin : leftMin, axis);
          const area = `${line} L ${xFor(n - 1).toFixed(1)},${baseY.toFixed(1)} L ${xFor(0).toFixed(1)},${baseY.toFixed(1)} Z`;
          return (
            <g key={si}>
              {s.fill !== false && <path d={area} fill={s.color} fillOpacity={0.12} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth={s.strokeWidth || 1.8} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '4 4' : ''} />
            </g>
          );
        })}
        {/* hover overlay */}
        {safeHover && (
          <g pointerEvents="none">
            <line x1={xFor(safeHover.idx)} y1={pad.t} x2={xFor(safeHover.idx)} y2={pad.t + innerH} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
            {series.map((s, si) => (
              <circle key={si} cx={xFor(safeHover.idx)} cy={yForAxis(s.values[safeHover.idx], s.axis || 'left')} r="5" fill="white" stroke={s.color} strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {safeHover && tipStyle && (
        <div style={{
          position: 'absolute',
          ...tipStyle,
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '8px 11px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06)',
          fontSize: 12,
          fontFamily: 'var(--sans)',
          pointerEvents: 'none',
          minWidth: 160,
          zIndex: 5,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
            {xTooltipFmt ? xTooltipFmt(safeHover.idx) : (xLabels && xLabels[safeHover.idx]) || safeHover.idx}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {series.map((s, si) => {
              const fmtter = (s.axis === 'right' ? yFmtRight : yFmt) || (v => v.toFixed(0));
              return (
                <div key={si} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    {s.label}
                  </span>
                  <span style={{ color: '#0f172a', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtter(s.values[safeHover.idx])}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {series.length > 1 && (
        <div style={{ display:'flex', gap:14, justifyContent:'center', fontSize:11, color:'var(--text-dim)', marginTop:4, flexWrap:'wrap' }}>
          {series.map((s, i) => (
            <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:10, height:2, background:s.color, borderTop: s.dashed ? `2px dashed ${s.color}` : 'none' }} /> {s.label}
              {s.axis === 'right' && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>(right axis)</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Vertical bar chart
function BarChart({ data, height = 200, valueKey = 'value', labelKey = 'label', color = '#4ade80', yFmt }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const padding = { l: 40, r: 12, t: 10, b: 28 };
  const innerW = w - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  const bw = innerW / data.length * 0.7;
  const gap = innerW / data.length * 0.3;
  return (
    <div ref={wrapRef} className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height}>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = padding.t + innerH * (1 - t);
          const v = max * t;
          return (
            <g key={i}>
              <line x1={padding.l} y1={y} x2={w - padding.r} y2={y} stroke="#e2e8f0" strokeDasharray="2 3" />
              <text x={padding.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="var(--mono)">
                {yFmt ? yFmt(v) : v.toFixed(0)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = padding.l + i * (bw + gap) + gap/2;
          const h = ((d[valueKey] / max) * innerH);
          const y = padding.t + innerH - h;
          const c = d.color || color;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={h} fill={c} fillOpacity={0.85} rx={2} />
              <rect x={x} y={y} width={bw} height={2} fill={c} />
              <text x={x + bw/2} y={height - 12} textAnchor="middle" fontSize="9.5" fill="#64748b" fontFamily="var(--mono)">{d[labelKey]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Donut
function Donut({ data, size = 160, thickness = 22, label, sub }) {
  const total = data.reduce((s,d)=>s+d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
      <div style={{ position:'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
          {data.map((d, i) => {
            const frac = d.value / Math.max(total, 1);
            const dash = c * frac;
            const offset = c * (1 - acc);
            acc += frac;
            return (
              <circle key={i}
                cx={size/2} cy={size/2} r={r}
                fill="none" stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${size/2} ${size/2})`}
              />
            );
          })}
        </svg>
        <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', textAlign:'center' }}>
          <div>
            {label && <div style={{ fontFamily:'var(--mono)', fontSize:18, fontWeight:700, color:'var(--text)' }}>{label}</div>}
            {sub && <div style={{ fontSize:10, color:'var(--text-dim)' }}>{sub}</div>}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, flex:1 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, fontSize:11 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
              <span style={{ width:8, height:8, background:d.color, borderRadius:1 }} />
              <span style={{ color:'var(--text)' }}>{d.label}</span>
            </span>
            <span style={{ color:'var(--text-dim)', fontVariantNumeric:'tabular-nums' }}>
              {d.fmt || ((total ? (d.value/total*100).toFixed(0) : 0) + '%')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Gauge (semicircle, speedometer-style)
function Gauge({ value, max = 100, label, sub, size = 140, tone = 'green' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const stroke = 10;
  const r = (size - stroke - 6) / 2;
  const cx = size / 2;
  const cy = r + stroke / 2 + 4;          // arc baseline
  const svgH = cy + 44;                    // open area below for readout
  const arcLen = Math.PI * r;
  const fillLen = arcLen * pct / 100;
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const colors = { green:'#10b981', amber:'#d97706', red:'#e11d48', cyan:'#0891b2', blue:'#2563eb', purple:'#7c3aed', orange:'#ea580c' };
  const col = colors[tone] || colors.green;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width: size }}>
      <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`}>
        <path d={arcPath} fill="none" stroke="#e2e8f0" strokeWidth={stroke} strokeLinecap="round" />
        <path d={arcPath} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${fillLen} ${arcLen + 1}`} />
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="22" fontWeight="600"
              fill={col} fontFamily="var(--sans)" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {pct.toFixed(0)}%
        </text>
        {sub && (
          <text x={cx} y={cy + 38} textAnchor="middle" fontSize="9.5"
                fill="#64748b" fontFamily="var(--sans)">
            {sub}
          </text>
        )}
      </svg>
      {label && <div style={{ fontSize:11.5, color:'var(--text)', textAlign:'center', fontWeight:500, marginTop: 2 }}>{label}</div>}
    </div>
  );
}

// Scatter — profitability map
function Scatter({ points, xLabel, yLabel, height = 280, xMax, yMax, xFmt, yFmt }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const padding = { l: 60, r: 20, t: 16, b: 36 };
  const innerW = w - padding.l - padding.r;
  const innerH = height - padding.t - padding.b;
  const xMx = xMax ?? Math.max(...points.map(p=>p.x), 1) * 1.1;
  const yMx = yMax ?? Math.max(...points.map(p=>p.y), 1) * 1.1;
  const yMn = Math.min(0, ...points.map(p=>p.y)) * 1.1;
  const xFor = (v) => padding.l + (v / xMx) * innerW;
  const yFor = (v) => padding.t + innerH - ((v - yMn) / (yMx - yMn)) * innerH;
  const zeroY = yFor(0);
  return (
    <div ref={wrapRef} className="chart-wrap">
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height}>
        {/* axes */}
        <line x1={padding.l} y1={padding.t} x2={padding.l} y2={padding.t + innerH} stroke="#cbd5e1" />
        <line x1={padding.l} y1={padding.t + innerH} x2={w - padding.r} y2={padding.t + innerH} stroke="#cbd5e1" />
        {/* zero margin line if exists */}
        {yMn < 0 && (
          <line x1={padding.l} y1={zeroY} x2={w - padding.r} y2={zeroY} stroke="#64748b" strokeDasharray="3 3" opacity="0.4" />
        )}
        {/* grid */}
        {[0.25, 0.5, 0.75, 1].map((t, i) => {
          const x = padding.l + innerW * t;
          const y = padding.t + innerH * (1 - t);
          return (
            <g key={i}>
              <line x1={x} y1={padding.t} x2={x} y2={padding.t + innerH} stroke="#e2e8f0" strokeDasharray="2 3" />
              <line x1={padding.l} y1={y} x2={w - padding.r} y2={y} stroke="#e2e8f0" strokeDasharray="2 3" />
              <text x={x} y={height - 18} textAnchor="middle" fontSize="9" fill="#64748b" fontFamily="var(--mono)">{xFmt ? xFmt(xMx * t) : (xMx * t).toFixed(0)}</text>
              <text x={padding.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="var(--mono)">{yFmt ? yFmt(yMn + (yMx - yMn) * t) : (yMn + (yMx - yMn)*t).toFixed(0)}</text>
            </g>
          );
        })}
        {/* points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xFor(p.x)} cy={yFor(p.y)} r={p.size || 8} fill={p.color} fillOpacity="0.7" stroke={p.color} strokeWidth="1.5" />
            <text x={xFor(p.x)} y={yFor(p.y) - (p.size || 8) - 4} textAnchor="middle" fontSize="10" fill={p.color} fontWeight="600">{p.label}</text>
          </g>
        ))}
        {/* axis labels */}
        {xLabel && <text x={w/2} y={height - 4} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="var(--mono)" textTransform="uppercase" letterSpacing="0.1em">{xLabel}</text>}
        {yLabel && <text transform={`rotate(-90 14 ${height/2})`} x="14" y={height/2} textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="var(--mono)">{yLabel}</text>}
      </svg>
    </div>
  );
}

// Heatmap — daily intensity matrix (week x dow)
function Heatmap({ values, weeks = 13, label, fmtFn, color = [74,222,128] }) {
  // values: array of { date, v } — last item is today
  const max = Math.max(...values.map(v=>v.v), 1);
  const cells = [];
  // group by week, day-of-week
  // assume values sorted oldest -> newest
  const start = new Date(values[0].date);
  // pad start to Monday
  const dow0 = (start.getDay() + 6) % 7; // 0 = Mon
  const grid = Array.from({ length: weeks * 7 }, () => null);
  values.forEach((v) => {
    const d = new Date(v.date);
    const diff = Math.floor((d - start) / 86400000);
    const idx = dow0 + diff;
    if (idx >= 0 && idx < grid.length) grid[idx] = v;
  });
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: 3 }}>
        {Array.from({ length: weeks }).map((_, wi) => (
          <div key={wi} style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {Array.from({ length: 7 }).map((_, di) => {
              const v = grid[wi * 7 + di];
              const alpha = v ? Math.min(1, v.v / max) : 0;
              return <div key={di} className="hm-cell"
                title={v ? `${v.date}: ${fmtFn ? fmtFn(v.v) : v.v}` : ''}
                style={{ background: alpha > 0 ? `rgba(${color.join(',')}, ${0.15 + alpha * 0.7})` : 'var(--bg-2)' }} />;
            })}
          </div>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, fontSize:10, color:'var(--text-dim)' }}>
        <span>LOW</span>
        <div style={{ display:'flex', gap:2 }}>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((a, i) => (
            <span key={i} style={{ width:10, height:10, background:`rgba(${color.join(',')}, ${a})`, borderRadius:1 }} />
          ))}
        </div>
        <span>HIGH</span>
      </div>
    </div>
  );
}

Object.assign(window, { Sparkline, LineChart, BarChart, Donut, Gauge, Scatter, Heatmap });
