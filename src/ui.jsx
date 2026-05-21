// Shared UI primitives — Card, Stat, Pill, Table, Sparkline wrapper, etc.

const { useState, useEffect, useRef, useMemo, createContext, useContext } = React;

function Card({ title, glyph, right, children, className = '', noPad }) {
  return (
    <section className={`card-section ${className}`}>
      {title && (
        <header className="card-section-header">
          <h2 className="card-title">
            {glyph && <span className="glyph">{glyph}</span>}
            {title}
          </h2>
          {right}
        </header>
      )}
      <div style={noPad ? {} : {}}>{children}</div>
    </section>
  );
}

function Stat({ label, value, sub, tone = 'green', delta, footer }) {
  const tc = `stat-card tone-${tone}`;
  return (
    <div className={tc}>
      <p className="stat-label">{label}</p>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {delta !== undefined && (
        <span className={`stat-delta ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
        </span>
      )}
      {footer}
    </div>
  );
}

function Pill({ children, tone = 'muted' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function Dot({ tone = 'green', pulse }) {
  const colors = { green:'#4ade80', red:'#f87171', amber:'#fbbf24', cyan:'#67e8f9', blue:'#60a5fa', purple:'#c084fc', orange:'#fb923c' };
  return <span className={`dot ${pulse ? 'dot-pulse' : ''}`} style={{ color: colors[tone] || colors.green }} />;
}

function Progress({ value, max = 100, tone = 'green', height = 6 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="progress" style={{ height }}>
      <div className={`progress-bar ${tone !== 'green' ? tone : ''}`} style={{ width: pct + '%' }} />
    </div>
  );
}

function Subnav({ items, value, onChange }) {
  return (
    <div className="subnav">
      {items.map(it => (
        <button
          key={it.id}
          className={`subnav-item ${value === it.id ? 'active' : ''}`}
          onClick={() => onChange(it.id)}
        >
          {it.icon && <span>{it.icon}</span>}
          <span>{it.label}</span>
          {it.count !== undefined && <span style={{ opacity: 0.5, fontSize: '10px' }}>({it.count})</span>}
        </button>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children, footer, width }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={width ? { width } : {}} onClick={e=>e.stopPropagation()}>
        <header className="modal-header">
          <h3 style={{ margin:0, fontFamily:'var(--display)', fontSize:16, color:'var(--green-bright)' }}>{title}</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕ ESC</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  );
}

// Bar chart (horizontal) for cost categories etc.
function HBars({ data, valueKey = 'amount', labelKey = 'category', tone, max, fmtFn, height = 22 }) {
  const m = max ?? Math.max(...data.map(d => d[valueKey]), 1);
  const colors = {
    'Fuel':'amber','Wages':'blue','Insurance':'purple','Loans':'orange','Registration':'cyan',
    'Repairs & Maint':'red','Tyres & Lubes':'red','Teeth & Grates':'red','Power':'amber',
    'Rent':'purple','Safety Equip':'blue','Gen Business':'cyan',
    'haulage':'blue','planter':'green','excavator':'amber','grinder':'red','carbonator':'cyan','mill':'purple','overhead':'orange'
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((d, i) => {
        const v = d[valueKey];
        const pct = (v / m) * 100;
        const t = tone || colors[d[labelKey]] || 'green';
        const cssColor = `var(--${t})`;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text)', textTransform: 'capitalize' }}>{d[labelKey]}</div>
            <div style={{ height, background: 'var(--bg-2)', borderRadius: 3, border: '1px solid var(--border-soft)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ height: '100%', width: pct + '%', background: `linear-gradient(90deg, ${cssColor}33, ${cssColor})`, borderRight: `1px solid ${cssColor}` }} />
            </div>
            <div className="num" style={{ fontSize: 11.5, color: 'var(--text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {fmtFn ? fmtFn(v) : fmt.$(v)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Range selector chip — used in operational dashboards
const RANGE_OPTIONS = [
  { id: 7,   label: '7d' },
  { id: 30,  label: '30d' },
  { id: 90,  label: '90d' },
  { id: 365, label: 'YTD' },
];
function RangeSelector({ value, onChange, options = RANGE_OPTIONS }) {
  return (
    <div className="range-selector">
      {options.map(o => (
        <button key={o.id} type="button"
          className={`range-chip${value === o.id ? ' active' : ''}`}
          onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Actual-vs-budget variance KPI strip
function BudgetVariance({ actual, budget, unit, fmtFn, label = 'vs budget' }) {
  const diff = actual - budget;
  const pct = budget > 0 ? (diff / budget) * 100 : 0;
  const positive = diff >= 0;
  const fmtV = fmtFn || (v => (v||0).toLocaleString('en-AU', { maximumFractionDigits: 1 }));
  return (
    <div className="variance-strip">
      <div className="variance-item">
        <span className="variance-label">Actual</span>
        <span className="variance-val">{fmtV(actual)} <span className="variance-unit">{unit}</span></span>
      </div>
      <div className="variance-item">
        <span className="variance-label">Budget</span>
        <span className="variance-val muted">{fmtV(budget)} <span className="variance-unit">{unit}</span></span>
      </div>
      <div className={`variance-item variance-diff ${positive ? 'up' : 'down'}`}>
        <span className="variance-label">{label}</span>
        <span className="variance-val">
          {positive ? '▲' : '▼'} {fmtV(Math.abs(diff))} <span className="variance-unit">{unit}</span>
          <span className="variance-pct">{positive ? '+' : '−'}{Math.abs(pct).toFixed(1)}%</span>
        </span>
      </div>
    </div>
  );
}

Object.assign(window, { Card, Stat, Pill, Dot, Progress, Subnav, Modal, Field, HBars, RangeSelector, BudgetVariance });
