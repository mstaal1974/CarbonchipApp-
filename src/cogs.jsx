// COGS — Cost of Goods calculator for forestry operations.
// Computes per-component operating cost and per-product COGS broken out
// by the contributing components (haulage, grinder, excavator, planter, carbonator).

const COGS_STORAGE_KEY = 'carbonchip:cogs:v1';

// ── Component input schema ────────────────────────────────────────────
// `outputUnit` is the unit each component charges its output in.
// `throughputKey` names the input key that holds the units-per-hour rate
// (or for haulage: loads-per-month + capacity → t/hr).
const COMPONENT_SCHEMA = {
  haulage: {
    name: 'Haulage', icon: '🚛', tone: 'blue', outputUnit: 't',
    fields: [
      { key: 'fuelLPer100km',      label: 'Fuel burn',       unit: 'L/100km', dp: 1, default: 58 },
      { key: 'fuelPrice',          label: 'Fuel price',      unit: '$/L',     dp: 2, default: 2.05 },
      { key: 'kmPerLoad',          label: 'Km per load',     unit: 'km',      dp: 0, default: 240 },
      { key: 'hoursPerLoad',       label: 'Hours per load',  unit: 'hr',      dp: 1, default: 4.2 },
      { key: 'operatorWage',       label: 'Driver wage',     unit: '$/hr',    dp: 2, default: 48 },
      { key: 'rmPerKm',            label: 'R&M',             unit: '$/km',    dp: 2, default: 0.34 },
      { key: 'tyresPerKm',         label: 'Tyres & lubes',   unit: '$/km',    dp: 2, default: 0.18 },
      { key: 'loanPerMonth',       label: 'Lease / loan',    unit: '$/mo',    dp: 0, default: 14200 },
      { key: 'insurancePerMonth',  label: 'Insurance',       unit: '$/mo',    dp: 0, default: 2800 },
      { key: 'regoPerMonth',       label: 'Registration',    unit: '$/mo',    dp: 0, default: 360 },
      { key: 'loadsPerMonth',      label: 'Utilisation',     unit: 'loads/mo',dp: 0, default: 110 },
      { key: 'capacityT',          label: 'Capacity / load', unit: 't',       dp: 1, default: 56 },
    ],
  },
  grinder: {
    name: 'Grinder', icon: '⚙️', tone: 'red', outputUnit: 'm³',
    fields: [
      { key: 'fuelLPerHr',         label: 'Fuel burn',       unit: 'L/hr',    dp: 1, default: 62 },
      { key: 'fuelPrice',          label: 'Fuel price',      unit: '$/L',     dp: 2, default: 2.05 },
      { key: 'operatorWage',       label: 'Operator wage',   unit: '$/hr',    dp: 2, default: 52 },
      { key: 'rmPerHr',            label: 'R&M',             unit: '$/hr',    dp: 2, default: 28 },
      { key: 'teethPerHr',         label: 'Teeth & grates',  unit: '$/hr',    dp: 2, default: 18 },
      { key: 'loanPerMonth',       label: 'Lease / loan',    unit: '$/mo',    dp: 0, default: 6800 },
      { key: 'insurancePerMonth',  label: 'Insurance',       unit: '$/mo',    dp: 0, default: 920 },
      { key: 'hoursPerMonth',      label: 'Utilisation',     unit: 'hr/mo',   dp: 0, default: 160 },
      { key: 'throughputM3PerHr',  label: 'Throughput',      unit: 'm³/hr',   dp: 1, default: 45 },
    ],
  },
  excavator: {
    name: 'Excavator', icon: '🚜', tone: 'amber', outputUnit: 'm³',
    fields: [
      { key: 'fuelLPerHr',         label: 'Fuel burn',       unit: 'L/hr',    dp: 1, default: 18 },
      { key: 'fuelPrice',          label: 'Fuel price',      unit: '$/L',     dp: 2, default: 2.05 },
      { key: 'operatorWage',       label: 'Wet-hire rate',   unit: '$/hr',    dp: 2, default: 220 },
      { key: 'rmPerHr',            label: 'R&M',             unit: '$/hr',    dp: 2, default: 14 },
      { key: 'loanPerMonth',       label: 'Lease / loan',    unit: '$/mo',    dp: 0, default: 0 },
      { key: 'insurancePerMonth',  label: 'Insurance',       unit: '$/mo',    dp: 0, default: 0 },
      { key: 'hoursPerMonth',      label: 'Utilisation',     unit: 'hr/mo',   dp: 0, default: 160 },
      { key: 'throughputM3PerHr',  label: 'Throughput',      unit: 'm³/hr',   dp: 1, default: 22 },
    ],
  },
  planter: {
    name: 'Planter', icon: '🌱', tone: 'green', outputUnit: 'ha',
    fields: [
      { key: 'fuelLPerHr',         label: 'Fuel burn',       unit: 'L/hr',    dp: 1, default: 9 },
      { key: 'fuelPrice',          label: 'Fuel price',      unit: '$/L',     dp: 2, default: 2.05 },
      { key: 'operatorWage',       label: 'Operator wage',   unit: '$/hr',    dp: 2, default: 46 },
      { key: 'rmPerHr',            label: 'R&M',             unit: '$/hr',    dp: 2, default: 8 },
      { key: 'seedlingsPerHa',     label: 'Seedlings / ha',  unit: 'ea',      dp: 0, default: 1250 },
      { key: 'seedlingCost',       label: 'Seedling cost',   unit: '$/ea',    dp: 2, default: 0.42 },
      { key: 'loanPerMonth',       label: 'Lease / loan',    unit: '$/mo',    dp: 0, default: 3400 },
      { key: 'insurancePerMonth',  label: 'Insurance',       unit: '$/mo',    dp: 0, default: 480 },
      { key: 'hoursPerMonth',      label: 'Utilisation',     unit: 'hr/mo',   dp: 0, default: 120 },
      { key: 'throughputHaPerHr',  label: 'Throughput',      unit: 'ha/hr',   dp: 2, default: 0.45 },
    ],
  },
  carbonator: {
    name: 'Carbonator', icon: '🔥', tone: 'cyan', outputUnit: 't',
    fields: [
      { key: 'fuelLPerHr',         label: 'Fuel burn',       unit: 'L/hr',    dp: 1, default: 28 },
      { key: 'fuelPrice',          label: 'Fuel price',      unit: '$/L',     dp: 2, default: 2.05 },
      { key: 'operatorWage',       label: 'Operator wage',   unit: '$/hr',    dp: 2, default: 58 },
      { key: 'rmPerHr',            label: 'R&M',             unit: '$/hr',    dp: 2, default: 22 },
      { key: 'loanPerMonth',       label: 'Lease / loan',    unit: '$/mo',    dp: 0, default: 9200 },
      { key: 'insurancePerMonth',  label: 'Insurance',       unit: '$/mo',    dp: 0, default: 1100 },
      { key: 'hoursPerMonth',      label: 'Utilisation',     unit: 'hr/mo',   dp: 0, default: 140 },
      { key: 'throughputTPerHr',   label: 'Throughput',      unit: 't/hr',    dp: 2, default: 1.15 },
    ],
  },
};

const COMPONENT_KEYS = ['haulage', 'grinder', 'excavator', 'planter', 'carbonator'];

// ── Product recipes ──────────────────────────────────────────────────
// `consumption` = how many of EACH component's output units are needed
// per 1 unit of product (component's output unit is from COMPONENT_SCHEMA).
const PRODUCT_RECIPES = {
  chip:      { name: 'Chip',       icon: '🪵', unit: 'm³', tone: 'green',
               consumption: { excavator: 1.05, grinder: 1.00, haulage: 0.60 } },
  microchip: { name: 'Microchip',  icon: '🪵', unit: 'm³', tone: 'lime',
               consumption: { excavator: 1.05, grinder: 1.20, haulage: 0.60 } },
  mulch:     { name: 'Mulch',      icon: '🌿', unit: 'm³', tone: 'amber',
               consumption: { grinder: 0.90 } },
  shavings:  { name: 'Shavings',   icon: '✨', unit: 'm³', tone: 'orange',
               consumption: { grinder: 1.10, haulage: 0.50 } },
  carbon:    { name: 'Carbon',     icon: '⬛', unit: 't',  tone: 'cyan',
               consumption: { excavator: 8.0, grinder: 8.0, carbonator: 1.0, haulage: 1.0 } },
  biomass:   { name: 'Biomass',    icon: '🍂', unit: 'm³', tone: 'red',
               consumption: { excavator: 1.0, haulage: 0.50 } },
  logs:      { name: 'Logs',       icon: '🌲', unit: 'm³', tone: 'purple',
               consumption: { excavator: 1.0, haulage: 0.55 } },
  seedling:  { name: 'Seedling',   icon: '🌱', unit: 'ea', tone: 'green',
               consumption: { planter: 1/1250 } },
};

// ── Pure calculation ──────────────────────────────────────────────────
function calcComponent(key, inputs) {
  const i = inputs[key] || {};
  const get = (k) => Number(i[k] ?? COMPONENT_SCHEMA[key].fields.find(f=>f.key===k).default);

  if (key === 'haulage') {
    const fuelLPer100km = get('fuelLPer100km');
    const fuelPrice = get('fuelPrice');
    const kmPerLoad = get('kmPerLoad');
    const hoursPerLoad = get('hoursPerLoad');
    const wage = get('operatorWage');
    const rmPerKm = get('rmPerKm');
    const tyresPerKm = get('tyresPerKm');
    const loan = get('loanPerMonth');
    const ins = get('insurancePerMonth');
    const rego = get('regoPerMonth');
    const loadsPerMonth = Math.max(1, get('loadsPerMonth'));
    const capacityT = Math.max(0.01, get('capacityT'));

    const fuelCostPerLoad = (kmPerLoad * fuelLPer100km / 100) * fuelPrice;
    const driverCostPerLoad = hoursPerLoad * wage;
    const rmCostPerLoad = kmPerLoad * rmPerKm;
    const tyresCostPerLoad = kmPerLoad * tyresPerKm;
    const fixedPerLoad = (loan + ins + rego) / loadsPerMonth;

    const totalPerLoad = fuelCostPerLoad + driverCostPerLoad + rmCostPerLoad + tyresCostPerLoad + fixedPerLoad;
    const costPerOutputUnit = totalPerLoad / capacityT; // $/t

    return {
      breakdown: {
        Fuel: fuelCostPerLoad,
        Operator: driverCostPerLoad,
        'R&M': rmCostPerLoad,
        Tyres: tyresCostPerLoad,
        'Fixed (loan/ins/rego)': fixedPerLoad,
      },
      perOperatingHour: totalPerLoad / Math.max(0.01, hoursPerLoad),
      perOutputUnit: costPerOutputUnit,
      outputUnit: 't',
      totalPerCycle: totalPerLoad,
      cycleLabel: 'per load',
    };
  }

  // Hourly-throughput components
  const fuelLPerHr = get('fuelLPerHr');
  const fuelPrice = get('fuelPrice');
  const wage = get('operatorWage');
  const rmPerHr = get('rmPerHr');
  const teethPerHr = key === 'grinder' ? get('teethPerHr') : 0;
  const loan = get('loanPerMonth');
  const ins = get('insurancePerMonth');
  const hoursPerMonth = Math.max(1, get('hoursPerMonth'));

  const fuelCostPerHr = fuelLPerHr * fuelPrice;
  const fixedPerHr = (loan + ins) / hoursPerMonth;

  const variablePerHr = fuelCostPerHr + wage + rmPerHr + teethPerHr;
  let totalPerHr = variablePerHr + fixedPerHr;

  // Seedling consumable for planter is per-ha not per-hr — fold into per-unit, below
  let consumablePerOutput = 0;
  let throughput;
  if (key === 'grinder')    throughput = get('throughputM3PerHr');
  if (key === 'excavator')  throughput = get('throughputM3PerHr');
  if (key === 'planter')    throughput = get('throughputHaPerHr');
  if (key === 'carbonator') throughput = get('throughputTPerHr');
  throughput = Math.max(0.0001, throughput);

  const costPerOutputUnit = (totalPerHr / throughput) + (
    key === 'planter' ? get('seedlingsPerHa') * get('seedlingCost') : 0
  );

  const breakdown = {
    Fuel: fuelCostPerHr,
    Operator: wage,
    'R&M': rmPerHr,
  };
  if (key === 'grinder') breakdown['Teeth & grates'] = teethPerHr;
  if (key === 'planter') breakdown['Seedlings'] = (get('seedlingsPerHa') * get('seedlingCost')) * throughput; // $/hr equivalent
  breakdown['Fixed (loan/ins)'] = fixedPerHr;

  return {
    breakdown,
    perOperatingHour: totalPerHr + (key === 'planter' ? (get('seedlingsPerHa') * get('seedlingCost')) * throughput : 0),
    perOutputUnit: costPerOutputUnit,
    outputUnit: COMPONENT_SCHEMA[key].outputUnit,
    throughput,
    cycleLabel: 'per hour',
  };
}

function calcAllComponents(inputs) {
  const out = {};
  COMPONENT_KEYS.forEach(k => { out[k] = calcComponent(k, inputs); });
  return out;
}

function calcProducts(componentResults, recipes) {
  const out = {};
  Object.entries(recipes).forEach(([pid, p]) => {
    const components = {};
    let total = 0;
    Object.entries(p.consumption).forEach(([ck, qty]) => {
      const cost = qty * componentResults[ck].perOutputUnit;
      components[ck] = { qty, unitCost: componentResults[ck].perOutputUnit, cost };
      total += cost;
    });
    out[pid] = { ...p, components, total };
  });
  return out;
}

// ── Storage ──────────────────────────────────────────────────────────
function defaultInputs() {
  const o = {};
  COMPONENT_KEYS.forEach(k => {
    o[k] = {};
    COMPONENT_SCHEMA[k].fields.forEach(f => { o[k][f.key] = f.default; });
  });
  return o;
}
function defaultRecipes() {
  const o = {};
  Object.entries(PRODUCT_RECIPES).forEach(([k, v]) => {
    o[k] = { consumption: { ...v.consumption } };
  });
  return o;
}

function loadCogsState() {
  try {
    const raw = localStorage.getItem(COGS_STORAGE_KEY);
    if (!raw) return { inputs: defaultInputs(), recipes: defaultRecipes() };
    const parsed = JSON.parse(raw);
    // Merge defaults so newly added fields appear
    const inputs = defaultInputs();
    if (parsed.inputs) {
      COMPONENT_KEYS.forEach(k => {
        if (parsed.inputs[k]) inputs[k] = { ...inputs[k], ...parsed.inputs[k] };
      });
    }
    const recipes = defaultRecipes();
    if (parsed.recipes) {
      Object.keys(recipes).forEach(p => {
        if (parsed.recipes[p]) recipes[p].consumption = { ...recipes[p].consumption, ...(parsed.recipes[p].consumption || {}) };
      });
    }
    return { inputs, recipes };
  } catch (e) {
    return { inputs: defaultInputs(), recipes: defaultRecipes() };
  }
}
function saveCogsState(state) {
  localStorage.setItem(COGS_STORAGE_KEY, JSON.stringify(state));
}
function clearCogsState() {
  localStorage.removeItem(COGS_STORAGE_KEY);
}

// ── UI ───────────────────────────────────────────────────────────────
function CogsInputGrid({ component, values, onChange }) {
  const schema = COMPONENT_SCHEMA[component];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px 14px' }}>
      {schema.fields.map(f => {
        const v = values[f.key] ?? f.default;
        return (
          <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {f.label} <span style={{ color: 'var(--text-muted)' }}>· {f.unit}</span>
            </label>
            <input
              className="input"
              type="number"
              step={f.dp > 0 ? (1 / Math.pow(10, f.dp)).toFixed(f.dp) : '1'}
              value={v}
              onChange={e => onChange(f.key, e.target.value === '' ? 0 : Number(e.target.value))}
              style={{ padding: '6px 8px', fontSize: 12, fontFamily: 'var(--mono)' }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ComponentCogsCard({ component, values, result, onChange }) {
  const schema = COMPONENT_SCHEMA[component];
  const [open, setOpen] = useState(true);
  const totalKey = component === 'haulage' ? 'totalPerCycle' : 'perOperatingHour';
  const totalLabel = component === 'haulage' ? 'per load' : 'per hour';
  return (
    <Card
      title={`${schema.icon} ${schema.name}`}
      right={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="pill" style={{ background: `color-mix(in srgb, var(--${schema.tone}) 12%, transparent)`, color: `var(--${schema.tone})`, borderColor: `color-mix(in srgb, var(--${schema.tone}) 30%, transparent)` }}>
            {fmt.$(result.perOutputUnit, 2)} / {result.outputUnit}
          </span>
          <button className="btn btn-ghost" onClick={() => setOpen(!open)}>{open ? '▾' : '▸'}</button>
        </div>
      }
    >
      {open && <CogsInputGrid component={component} values={values} onChange={onChange} />}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Breakdown ({totalLabel})</div>
          {Object.entries(result.breakdown).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text)', padding: '2px 0' }}>
              <span style={{ color: 'var(--text-dim)' }}>{k}</span>
              <span className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt.$(v, 2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, padding: '6px 0 0', marginTop: 4, borderTop: '1px dashed var(--border)' }}>
            <span>Total {totalLabel}</span>
            <span className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt.$(result[totalKey], 2)}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Output</div>
          {component !== 'haulage' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text)', padding: '2px 0' }}>
              <span style={{ color: 'var(--text-dim)' }}>Throughput</span>
              <span className="num">{result.throughput.toFixed(2)} {result.outputUnit}/hr</span>
            </div>
          )}
          {component === 'haulage' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text)', padding: '2px 0' }}>
              <span style={{ color: 'var(--text-dim)' }}>Capacity</span>
              <span className="num">{values.capacityT ?? 56} t / load</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text)', padding: '2px 0' }}>
            <span style={{ color: 'var(--text-dim)' }}>Per output unit</span>
            <span className="num" style={{ color: `var(--${schema.tone})`, fontWeight: 600 }}>{fmt.$(result.perOutputUnit, 2)} / {result.outputUnit}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProductCogsTable({ products, recipes, onRecipeChange }) {
  const allProducts = Object.keys(PRODUCT_RECIPES);
  return (
    <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
      <colgroup>
        <col style={{ width: '13%' }} />
        {COMPONENT_KEYS.map(k => <col key={k} style={{ width: '13%' }} />)}
        <col style={{ width: '22%' }} />
      </colgroup>
      <thead>
        <tr>
          <th>Product</th>
          {COMPONENT_KEYS.map(k => (
            <th key={k} className="num" style={{ color: `var(--${COMPONENT_SCHEMA[k].tone})`, padding: '6px 4px', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {COMPONENT_SCHEMA[k].icon}
                <span>{COMPONENT_SCHEMA[k].name}</span>
              </span>
            </th>
          ))}
          <th className="num" style={{ whiteSpace: 'nowrap' }}>COGS / unit</th>
        </tr>
      </thead>
      <tbody>
        {allProducts.map(pid => {
          const p = products[pid];
          return (
            <tr key={pid}>
              <td style={{ padding: '6px 8px' }}>
                <span style={{ color: `var(--${p.tone})`, whiteSpace: 'nowrap' }}>{p.icon} {p.name}</span>
              </td>
              {COMPONENT_KEYS.map(ck => {
                const c = p.components[ck];
                const qty = recipes[pid]?.consumption[ck] ?? 0;
                return (
                  <td key={ck} className="num" style={{ padding: '4px 4px' }}>
                    {c ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                        <input
                          className="input"
                          type="number"
                          step="0.01"
                          value={qty}
                          onChange={e => onRecipeChange(pid, ck, Number(e.target.value) || 0)}
                          style={{ padding: '3px 4px', fontSize: 11, fontFamily: 'var(--mono)', width: '100%', minWidth: 0, textAlign: 'right' }}
                          title={`${COMPONENT_SCHEMA[ck].outputUnit} of ${COMPONENT_SCHEMA[ck].name} per ${p.unit} of ${p.name}`}
                        />
                        <span style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>{fmt.$(c.cost, 2)}</span>
                      </div>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '2px 6px', fontSize: 10.5, color: 'var(--text-muted)', width: '100%' }}
                        onClick={() => onRecipeChange(pid, ck, 1)}
                        title={`Add ${COMPONENT_SCHEMA[ck].name} to ${p.name} recipe`}
                      >+</button>
                    )}
                  </td>
                );
              })}
              <td className="num" style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                <b style={{ color: 'var(--text)' }}>{fmt.$(p.total, 2)}</b>
                <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>/ {p.unit}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CogsCalculator() {
  const [state, setState] = useState(loadCogsState);
  const componentResults = useMemo(() => calcAllComponents(state.inputs), [state.inputs]);
  const productResults = useMemo(() => {
    // Merge defaults so each product still has name/icon/unit/tone
    const merged = {};
    Object.entries(PRODUCT_RECIPES).forEach(([pid, p]) => {
      merged[pid] = { ...p, consumption: state.recipes[pid]?.consumption ?? p.consumption };
    });
    return calcProducts(componentResults, merged);
  }, [componentResults, state.recipes]);

  useEffect(() => { saveCogsState(state); }, [state]);

  const setInputField = (component, key, value) => {
    setState(s => ({ ...s, inputs: { ...s.inputs, [component]: { ...s.inputs[component], [key]: value } } }));
  };
  const setRecipeQty = (pid, ck, qty) => {
    setState(s => {
      const recipes = { ...s.recipes };
      const cur = { ...(recipes[pid]?.consumption ?? {}) };
      if (qty <= 0) delete cur[ck];
      else cur[ck] = qty;
      recipes[pid] = { ...(recipes[pid] || {}), consumption: cur };
      return { ...s, recipes };
    });
  };
  const reset = () => {
    if (!window.confirm('Reset all COGS inputs and recipes to defaults?')) return;
    clearCogsState();
    setState({ inputs: defaultInputs(), recipes: defaultRecipes() });
  };

  // KPI row: weighted avg cost & headline products
  const sortedProducts = Object.values(productResults).sort((a,b) => b.total - a.total);
  const topProduct = sortedProducts[0];
  const lowestProduct = sortedProducts[sortedProducts.length - 1];

  // Stacked breakdown by component for a chosen product, for visualisation
  return (
    <div>
      <div className="grid stat-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {COMPONENT_KEYS.map(k => {
          const r = componentResults[k];
          const s = COMPONENT_SCHEMA[k];
          return (
            <Stat
              key={k}
              label={`${s.icon} ${s.name}`}
              tone={s.tone}
              value={fmt.$(r.perOutputUnit, 2)}
              sub={`per ${r.outputUnit} · ${fmt.$(k === 'haulage' ? r.totalPerCycle : r.perOperatingHour, 2)} ${k === 'haulage' ? '/load' : '/hr'}`}
            />
          );
        })}
      </div>

      <div className="grid grid-12">
        <div className="span-7">
          <Card title="Component Inputs" glyph="🛠️" right={
            <button className="btn btn-ghost" onClick={reset} title="Restore defaults">↺ Reset</button>
          }>
            <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: '0 0 12px' }}>
              Tweak any input — fuel burn, wages, R&M, utilisation, throughput — and watch the per-unit cost update everywhere below. All values persist locally.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {COMPONENT_KEYS.map(k => (
                <ComponentCogsCard
                  key={k}
                  component={k}
                  values={state.inputs[k]}
                  result={componentResults[k]}
                  onChange={(field, value) => setInputField(k, field, value)}
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="span-5">
          <Card title="COGS Stack · by Component" glyph="🥞">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sortedProducts.slice(0, 6).map(p => (
                <ProductStackBar key={p.name} product={p} />
              ))}
            </div>
          </Card>

          <Card title="Headline" glyph="🏁">
            {topProduct && (
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
                <div>Highest COGS: <b style={{ color: 'var(--red)' }}>{topProduct.name}</b> at <b>{fmt.$(topProduct.total, 2)}</b> / {topProduct.unit}</div>
                <div>Lowest COGS: <b style={{ color: 'var(--green)' }}>{lowestProduct.name}</b> at <b>{fmt.$(lowestProduct.total, 2)}</b> / {lowestProduct.unit}</div>
                <div style={{ marginTop: 8, color: 'var(--text-dim)', fontSize: 11 }}>
                  Edit recipes below or component inputs (left) to model price changes, fleet utilisation, or contractor rates.
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card title="Per-Product COGS" glyph="📦" right={<span className="pill pill-muted">recipe × component cost</span>}>
        <ProductCogsTable products={productResults} recipes={state.recipes} onRecipeChange={setRecipeQty} />
        <p style={{ fontSize: 10.5, color: 'var(--text-muted)', margin: '10px 2px 0' }}>
          Numbers in each cell are <b>quantity</b> of that component's output unit per 1 unit of product output. The smaller figure underneath is the resulting $ contribution. Click <b>+</b> to add a component to a recipe.
        </p>
      </Card>
    </div>
  );
}

function ProductStackBar({ product }) {
  const total = product.total || 0;
  const segs = Object.entries(product.components).map(([ck, c]) => ({
    ck, label: COMPONENT_SCHEMA[ck].name, tone: COMPONENT_SCHEMA[ck].tone, cost: c.cost, pct: total ? (c.cost / total) * 100 : 0,
  }));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
        <span style={{ color: `var(--${product.tone})` }}>{product.icon} {product.name}</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt.$(product.total, 2)} / {product.unit}</span>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-2)', border: '1px solid var(--border-soft)' }}>
        {segs.map((s, i) => (
          <div key={i} title={`${s.label}: ${fmt.$(s.cost, 2)} (${s.pct.toFixed(0)}%)`}
            style={{ width: s.pct + '%', background: `var(--${s.tone})`, borderRight: i < segs.length - 1 ? '1px solid rgba(255,255,255,0.4)' : 'none' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, fontSize: 10, color: 'var(--text-dim)' }}>
        {segs.map((s, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, background: `var(--${s.tone})`, borderRadius: 1 }} />
            {s.label} {fmt.$(s.cost, 2)}
          </span>
        ))}
      </div>
    </div>
  );
}

window.COGS = {
  COMPONENT_SCHEMA, COMPONENT_KEYS, PRODUCT_RECIPES,
  calcComponent, calcAllComponents, calcProducts,
  loadCogsState, saveCogsState, clearCogsState,
  CogsCalculator,
};
window.CogsCalculator = CogsCalculator;
