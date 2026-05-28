// Quoting — distance-based haulage quote builder.
// Pulls per-km/per-hr costs from the COGS module's haulage inputs and
// per-product costs from the COGS recipes, then adds margin.
// Distance comes from Google Maps Distance Matrix when an API key is
// provided; otherwise a manual km entry is used.

const QUOTE_STORAGE_KEY = 'carbonchip:quotes:v1';
const MAPS_KEY_STORAGE = 'carbonchip:maps-key:v1';

// ── Default saved locations (editable inline) ────────────────────────
const DEFAULT_LOCATIONS = [
  { id: 'yard',       name: 'Yard / Depot',            address: 'Gympie QLD 4570, Australia',   type: 'yard'   },
  { id: 'gympie',     name: 'Gympie State Forest',     address: 'Gympie State Forest, QLD',     type: 'site'   },
  { id: 'imbil',      name: 'Imbil Plantation',        address: 'Imbil QLD 4570, Australia',    type: 'site'   },
  { id: 'kenilworth', name: 'Kenilworth Block',        address: 'Kenilworth QLD 4574',          type: 'site'   },
  { id: 'amamoor',    name: 'Amamoor Coupe',           address: 'Amamoor QLD 4570',             type: 'site'   },
  { id: 'tuan',       name: 'Tuan State Forest',       address: 'Tuan QLD 4650',                type: 'site'   },
  { id: 'kilcoy',     name: 'Kilcoy Pastoral',         address: 'Kilcoy QLD 4515',              type: 'client' },
  { id: 'searles',    name: 'Searles Garden Supplies', address: 'Caboolture QLD 4510',          type: 'client' },
  { id: 'summers',    name: 'Summers Mulch',           address: 'Coominya QLD 4311',            type: 'client' },
  { id: 'piggeries',  name: 'Regional Piggeries',      address: 'Toowoomba QLD 4350',           type: 'client' },
];

// ── Trailer types (defaults — adjustable in UI) ──────────────────────
const TRAILER_TYPES = [
  { id: 'bdouble',  name: 'B-Double',        capacityT: 56, capacityM3: 120, fuelLPer100km: 58, avgSpeedKmh: 65, loadHours: 1.5 },
  { id: 'semi',     name: 'Semi-trailer',    capacityT: 22, capacityM3: 50,  fuelLPer100km: 42, avgSpeedKmh: 70, loadHours: 1.2 },
  { id: 'tipper',   name: 'Tipper',          capacityT: 12, capacityM3: 25,  fuelLPer100km: 28, avgSpeedKmh: 75, loadHours: 0.6 },
  { id: 'walking',  name: 'Walking-floor',   capacityT: 30, capacityM3: 85,  fuelLPer100km: 48, avgSpeedKmh: 68, loadHours: 1.4 },
  { id: 'flatbed',  name: 'Flat-bed (logs)', capacityT: 22, capacityM3: 45,  fuelLPer100km: 40, avgSpeedKmh: 70, loadHours: 1.6 },
];

// ── Google Maps loader ───────────────────────────────────────────────
let _mapsPromise = null;
function loadMapsApi(key) {
  if (!key) return Promise.reject(new Error('No Google Maps API key set'));
  if (window.google && window.google.maps && window.google.maps.DistanceMatrixService) {
    return Promise.resolve(window.google.maps);
  }
  if (_mapsPromise) return _mapsPromise;
  _mapsPromise = new Promise((resolve, reject) => {
    const cbName = `__cc_maps_cb_${Date.now()}`;
    window[cbName] = () => { delete window[cbName]; resolve(window.google.maps); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=${cbName}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => { _mapsPromise = null; reject(new Error('Google Maps script failed to load')); };
    document.head.appendChild(s);
  });
  return _mapsPromise;
}

function fetchDistanceMatrix(origin, destination) {
  return new Promise((resolve, reject) => {
    const svc = new window.google.maps.DistanceMatrixService();
    svc.getDistanceMatrix({
      origins: [origin],
      destinations: [destination],
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
      avoidTolls: false,
    }, (res, status) => {
      if (status !== 'OK') return reject(new Error('Distance Matrix: ' + status));
      const el = res.rows[0]?.elements[0];
      if (!el || el.status !== 'OK') return reject(new Error('No route found: ' + (el?.status || 'unknown')));
      resolve({ distanceKm: el.distance.value / 1000, durationMin: el.duration.value / 60 });
    });
  });
}

// ── Quote calculation ────────────────────────────────────────────────
function calcQuote({ distanceKm, trailer, hauler, product, productCost, quantity, marginPct, loadHoursOverride }) {
  const roundTripKm = distanceKm * 2;
  const driveHours = roundTripKm / Math.max(20, trailer.avgSpeedKmh);
  const cycleHours = driveHours + (loadHoursOverride ?? trailer.loadHours);

  // Per-load haulage cost using the COGS haulage inputs (hauler)
  const fuel = roundTripKm * (trailer.fuelLPer100km / 100) * (hauler.fuelPrice || 2.05);
  const driver = cycleHours * (hauler.operatorWage || 48);
  const rm = roundTripKm * (hauler.rmPerKm || 0.34);
  const tyres = roundTripKm * (hauler.tyresPerKm || 0.18);
  const fixedPerLoad = ((hauler.loanPerMonth || 0) + (hauler.insurancePerMonth || 0) + (hauler.regoPerMonth || 0)) / Math.max(1, hauler.loadsPerMonth || 110);

  const haulageCostPerLoad = fuel + driver + rm + tyres + fixedPerLoad;

  // Loads required for the requested quantity (in product's native unit)
  const productUnit = product?.unit || 't';
  const capacityPerLoad = productUnit === 't' ? trailer.capacityT : trailer.capacityM3;
  const loadsNeeded = Math.max(1, Math.ceil(quantity / Math.max(0.01, capacityPerLoad)));

  // Haulage total
  const haulageTotal = haulageCostPerLoad * loadsNeeded;

  // Product cost contribution (production cost, ex-haulage portion)
  // productCost is $/unit from COGS calculator. We subtract any haulage
  // already baked into that recipe to avoid double-counting.
  const productCostExHaulage = Math.max(0, productCost?.exHaulage ?? productCost?.total ?? 0);
  const productCostTotal = productCostExHaulage * quantity;

  const totalCost = haulageTotal + productCostTotal;
  const quoteTotal = totalCost * (1 + (marginPct || 0) / 100);
  const marginDollars = quoteTotal - totalCost;

  return {
    distanceKm, roundTripKm, cycleHours, driveHours,
    loadsNeeded, capacityPerLoad, productUnit,
    breakdown: {
      Fuel: fuel * loadsNeeded,
      Driver: driver * loadsNeeded,
      'R&M': rm * loadsNeeded,
      Tyres: tyres * loadsNeeded,
      'Fixed (loan/ins/rego)': fixedPerLoad * loadsNeeded,
      'Product cost (ex-haulage)': productCostTotal,
    },
    haulageCostPerLoad,
    haulageTotal,
    productCostTotal,
    totalCost,
    quoteTotal,
    marginPct,
    marginDollars,
    perUnit: quantity > 0 ? quoteTotal / quantity : 0,
    perLoad: quoteTotal / loadsNeeded,
  };
}

// ── Storage ──────────────────────────────────────────────────────────
function loadQuotes() {
  try { return JSON.parse(localStorage.getItem(QUOTE_STORAGE_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveQuotes(arr) { localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(arr)); }
function envMapsKey() {
  return (window.CARBONCHIP_ENV && window.CARBONCHIP_ENV.mapsKey) || '';
}
function localMapsKey() { return localStorage.getItem(MAPS_KEY_STORAGE) || ''; }
function loadMapsKey() { return envMapsKey() || localMapsKey(); }
function mapsKeySource() {
  if (envMapsKey()) return 'env';
  if (localMapsKey()) return 'browser';
  return 'none';
}
function saveMapsKey(k) {
  if (k) localStorage.setItem(MAPS_KEY_STORAGE, k);
  else localStorage.removeItem(MAPS_KEY_STORAGE);
}

// ── Helpers ──────────────────────────────────────────────────────────
function googleMapsRouteUrl(origin, destination) {
  const o = encodeURIComponent(origin);
  const d = encodeURIComponent(destination);
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`;
}

// Recipe-aware product cost: returns { total, exHaulage, haulagePortion }
function productCostFromCogs(productId) {
  try {
    const cogs = window.COGS;
    if (!cogs) return null;
    const state = cogs.loadCogsState();
    const compResults = cogs.calcAllComponents(state.inputs);
    const recipes = state.recipes || {};
    const def = cogs.PRODUCT_RECIPES[productId];
    if (!def) return null;
    const consumption = recipes[productId]?.consumption ?? def.consumption;
    let total = 0, haul = 0;
    Object.entries(consumption).forEach(([ck, qty]) => {
      const cost = qty * compResults[ck].perOutputUnit;
      total += cost;
      if (ck === 'haulage') haul += cost;
    });
    return { total, exHaulage: total - haul, haulagePortion: haul, unit: def.unit, name: def.name, icon: def.icon, tone: def.tone };
  } catch (e) {
    return null;
  }
}

function productsForQuote() {
  if (!window.COGS) return [];
  return Object.entries(window.COGS.PRODUCT_RECIPES).map(([id, p]) => ({ id, ...p }));
}

// ── UI: Maps key modal ───────────────────────────────────────────────
function MapsKeyModal({ onClose }) {
  const fromEnv = envMapsKey();
  const [key, setKey] = useState(localMapsKey());
  const save = () => { saveMapsKey(key.trim()); onClose(true); };
  const clear = () => { saveMapsKey(''); setKey(''); onClose(true); };
  return (
    <Modal title="Google Maps API Key" onClose={() => onClose(false)} footer={
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" onClick={clear}>Clear browser key</button>
        <button className="btn btn-primary" onClick={save}>Save browser key</button>
      </div>
    }>
      {fromEnv && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 12 }}>
          <b style={{ color: 'var(--green)' }}>✓ Deploy-time key in use</b>
          <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>
            A key was injected at build time from the <code>GOOGLEMAPS_API</code>{' '}
            environment variable (<code>{fromEnv.slice(0,6)}…{fromEnv.slice(-4)}</code>).
            Setting a browser key below will override it for this device only.
          </div>
        </div>
      )}
      <Field label="Browser-only API key (override)" hint="Stored only in this browser's localStorage. Distance Matrix + Maps JavaScript APIs must be enabled.">
        <input className="input" type="password" value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="AIzaSy…"
          style={{ fontFamily: 'var(--mono)' }} />
      </Field>
      <p style={{ fontSize: 11.5, color: 'var(--text-dim)', margin: 0 }}>
        Without any key, you can still build quotes — just type the road distance manually or click <b>Open route in Maps</b> to read it off.
      </p>
    </Modal>
  );
}

// ── UI: Location picker ──────────────────────────────────────────────
function LocationPicker({ value, onChange, label, locations }) {
  const sel = locations.find(l => l.id === value?.id);
  const isCustom = value?.id === 'custom';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</label>
      <select className="select" value={value?.id || ''}
        onChange={e => {
          const id = e.target.value;
          if (id === 'custom') onChange({ id: 'custom', name: 'Custom', address: '' });
          else {
            const loc = locations.find(l => l.id === id);
            onChange(loc ? { ...loc } : null);
          }
        }}>
        <option value="">Select…</option>
        <optgroup label="Yard">
          {locations.filter(l => l.type === 'yard').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </optgroup>
        <optgroup label="Harvest sites">
          {locations.filter(l => l.type === 'site').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </optgroup>
        <optgroup label="Clients">
          {locations.filter(l => l.type === 'client').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </optgroup>
        <option value="custom">Custom address…</option>
      </select>
      <input className="input"
        value={value?.address || ''}
        placeholder="Address (city/postcode is enough)"
        onChange={e => onChange({ ...(value || { id: 'custom', name: 'Custom' }), address: e.target.value })}
        style={{ fontSize: 12, fontFamily: 'var(--mono)' }} />
    </div>
  );
}

// ── Main quote builder ───────────────────────────────────────────────
function QuoteBuilder() {
  const products = useMemo(productsForQuote, []);
  const [origin, setOrigin] = useState(() => DEFAULT_LOCATIONS[0]);
  const [destination, setDestination] = useState(() => DEFAULT_LOCATIONS.find(l => l.id === 'kilcoy'));
  const [direction, setDirection] = useState('outbound'); // 'outbound' = yard→client, 'inbound' = site→yard
  const [trailerId, setTrailerId] = useState('bdouble');
  const [productId, setProductId] = useState('chip');
  const [quantity, setQuantity] = useState(100);
  const [marginPct, setMarginPct] = useState(25);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [distanceSource, setDistanceSource] = useState('manual'); // 'maps' | 'manual'
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState(null);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [hasKey, setHasKey] = useState(() => !!loadMapsKey());
  const [keySource, setKeySource] = useState(mapsKeySource);
  const [savedQuotes, setSavedQuotes] = useState(loadQuotes);
  const [loadHoursOverride, setLoadHoursOverride] = useState(null);

  const trailer = TRAILER_TYPES.find(t => t.id === trailerId);
  const product = products.find(p => p.id === productId);
  const haulerInputs = useMemo(() => {
    const state = window.COGS ? window.COGS.loadCogsState() : { inputs: {} };
    return state.inputs.haulage || {};
  }, []);
  const productCost = useMemo(() => productCostFromCogs(productId), [productId]);

  const result = useMemo(() => {
    if (!distanceKm || !trailer || !product) return null;
    return calcQuote({
      distanceKm, trailer, hauler: haulerInputs,
      product, productCost,
      quantity: Number(quantity) || 0,
      marginPct: Number(marginPct) || 0,
      loadHoursOverride: loadHoursOverride !== null ? Number(loadHoursOverride) : null,
    });
  }, [distanceKm, trailer, product, productCost, quantity, marginPct, haulerInputs, loadHoursOverride]);

  const calcViaMaps = async () => {
    setError(null);
    if (!origin?.address || !destination?.address) {
      setError('Origin and destination addresses required'); return;
    }
    const key = loadMapsKey();
    if (!key) { setShowKeyModal(true); return; }
    setCalculating(true);
    try {
      await loadMapsApi(key);
      const { distanceKm: km, durationMin: min } = await fetchDistanceMatrix(origin.address, destination.address);
      setDistanceKm(+km.toFixed(1));
      setDurationMin(Math.round(min));
      setDistanceSource('maps');
    } catch (e) {
      setError(e.message || 'Distance lookup failed');
    } finally {
      setCalculating(false);
    }
  };

  const swap = () => {
    const a = origin, b = destination;
    setOrigin(b); setDestination(a);
    setDirection(d => d === 'outbound' ? 'inbound' : 'outbound');
  };

  const saveQuote = () => {
    if (!result) return;
    const q = {
      id: 'Q' + Date.now().toString(36).toUpperCase(),
      createdAt: new Date().toISOString(),
      origin: origin?.name + (origin?.address ? ` (${origin.address})` : ''),
      destination: destination?.name + (destination?.address ? ` (${destination.address})` : ''),
      direction, trailerId, trailerName: trailer.name,
      productId, productName: product.name, productUnit: product.unit,
      quantity: Number(quantity), marginPct: Number(marginPct),
      distanceKm, durationMin, distanceSource,
      totalCost: result.totalCost, quoteTotal: result.quoteTotal,
      perUnit: result.perUnit, perLoad: result.perLoad, loadsNeeded: result.loadsNeeded,
    };
    const next = [q, ...savedQuotes].slice(0, 50);
    setSavedQuotes(next);
    saveQuotes(next);
  };

  const deleteQuote = (id) => {
    const next = savedQuotes.filter(q => q.id !== id);
    setSavedQuotes(next);
    saveQuotes(next);
  };

  const copyQuoteText = () => {
    if (!result) return;
    const txt = [
      `CARBONCHIP — Haulage Quote`,
      `${new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      ``,
      `Route:    ${origin?.name} → ${destination?.name}`,
      `Distance: ${distanceKm} km one-way (${result.roundTripKm.toFixed(0)} km round-trip)`,
      `Trailer:  ${trailer.name} (${trailer.capacityT}t / ${trailer.capacityM3}m³)`,
      `Product:  ${product.name} · ${quantity} ${product.unit} (${result.loadsNeeded} load${result.loadsNeeded > 1 ? 's' : ''})`,
      ``,
      `Total cost: ${fmt.$(result.totalCost, 0)}`,
      `Margin:     ${marginPct}% (${fmt.$(result.marginDollars, 0)})`,
      `QUOTE:      ${fmt.$(result.quoteTotal, 0)}`,
      `            ${fmt.$(result.perUnit, 2)} / ${product.unit}`,
      `            ${fmt.$(result.perLoad, 0)} / load`,
    ].join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
  };

  return (
    <div>
      <div className="grid grid-12">
        <div className="span-7">
          <Card title="New Quote" glyph="📝" right={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowKeyModal(true)} title={hasKey ? `Google Maps API key in use (source: ${keySource})` : 'Set Google Maps API key'}>
                🔑 {hasKey ? `Maps key · ${keySource}` : 'Set Maps key'}
              </button>
            </div>
          }>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'end' }}>
              <LocationPicker label="From" value={origin} onChange={setOrigin} locations={DEFAULT_LOCATIONS} />
              <button className="btn btn-ghost" title="Swap" onClick={swap} style={{ alignSelf: 'center', padding: '6px 10px' }}>⇄</button>
              <LocationPicker label="To" value={destination} onChange={setDestination} locations={DEFAULT_LOCATIONS} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={calcViaMaps} disabled={calculating}>
                {calculating ? '⏳ Looking up…' : '📍 Calculate distance (Google Maps)'}
              </button>
              {origin?.address && destination?.address && (
                <a className="btn btn-ghost" target="_blank" rel="noopener"
                   href={googleMapsRouteUrl(origin.address, destination.address)}>
                  ↗ Open route in Maps
                </a>
              )}
              {error && <span className="pill pill-red" title={error}>⚠ {error.length > 60 ? error.slice(0, 60) + '…' : error}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
              <Field label="Distance (km, one-way)">
                <input className="input" type="number" step="0.1" value={distanceKm}
                  onChange={e => { setDistanceKm(Number(e.target.value) || 0); setDistanceSource('manual'); }}
                  style={{ fontFamily: 'var(--mono)' }} />
              </Field>
              <Field label="Drive time (min)" hint={distanceSource === 'maps' ? 'from Google' : 'estimated'}>
                <input className="input" type="number" value={durationMin || (distanceKm && trailer ? Math.round(distanceKm / trailer.avgSpeedKmh * 60) : 0)}
                  onChange={e => setDurationMin(Number(e.target.value) || 0)}
                  style={{ fontFamily: 'var(--mono)' }} />
              </Field>
              <Field label="Trailer type">
                <select className="select" value={trailerId} onChange={e => setTrailerId(e.target.value)}>
                  {TRAILER_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.name} · {t.capacityT}t / {t.capacityM3}m³</option>
                  ))}
                </select>
              </Field>
              <Field label="Direction">
                <select className="select" value={direction} onChange={e => setDirection(e.target.value)}>
                  <option value="outbound">Outbound (to client)</option>
                  <option value="inbound">Inbound (to yard)</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 4 }}>
              <Field label={direction === 'inbound' ? 'Input product' : 'Output product'}>
                <select className="select" value={productId} onChange={e => setProductId(e.target.value)}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name} ({p.unit})</option>)}
                </select>
              </Field>
              <Field label={`Quantity (${product?.unit || ''})`}>
                <input className="input" type="number" step="0.1" value={quantity}
                  onChange={e => setQuantity(e.target.value)} style={{ fontFamily: 'var(--mono)' }} />
              </Field>
              <Field label="Margin %">
                <input className="input" type="number" step="1" value={marginPct}
                  onChange={e => setMarginPct(e.target.value)} style={{ fontFamily: 'var(--mono)' }} />
              </Field>
              <Field label="Load/unload hours" hint={`default ${trailer?.loadHours || 0} for ${trailer?.name}`}>
                <input className="input" type="number" step="0.1"
                  value={loadHoursOverride !== null ? loadHoursOverride : (trailer?.loadHours || 0)}
                  onChange={e => setLoadHoursOverride(e.target.value === '' ? null : Number(e.target.value))}
                  style={{ fontFamily: 'var(--mono)' }} />
              </Field>
            </div>

            {result && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
                <Stat label="Round-trip" tone="cyan" value={`${result.roundTripKm.toFixed(0)} km`} sub={`${result.cycleHours.toFixed(1)} h cycle`} />
                <Stat label="Loads needed" tone="blue" value={result.loadsNeeded} sub={`${result.capacityPerLoad} ${result.productUnit}/load`} />
                <Stat label="Cost (ex-margin)" tone="red" value={fmt.$(result.totalCost, 0)} sub={`${fmt.$(result.haulageCostPerLoad, 0)}/load haul`} />
                <Stat label="QUOTE" tone="green" value={fmt.$(result.quoteTotal, 0)} sub={`+${marginPct}% margin`} />
              </div>
            )}

            {result && (
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={saveQuote}>💾 Save quote</button>
                <button className="btn" onClick={copyQuoteText}>📋 Copy as text</button>
              </div>
            )}
          </Card>

          {result && (
            <Card title="Cost Breakdown" glyph="🧮">
              <table className="table">
                <thead><tr><th>Line item</th><th className="num">Amount</th><th className="num">Share</th></tr></thead>
                <tbody>
                  {Object.entries(result.breakdown).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="num">{fmt.$(v, 2)}</td>
                      <td className="num muted">{result.totalCost ? ((v / result.totalCost) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                  <tr>
                    <td><b>Total cost</b></td>
                    <td className="num"><b>{fmt.$(result.totalCost, 2)}</b></td>
                    <td className="num muted">100.0%</td>
                  </tr>
                  <tr>
                    <td>Margin · {marginPct}%</td>
                    <td className="num" style={{ color: 'var(--green)' }}>{fmt.$(result.marginDollars, 2)}</td>
                    <td className="num muted">—</td>
                  </tr>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td><b>Quote total</b></td>
                    <td className="num"><b style={{ color: 'var(--green)' }}>{fmt.$(result.quoteTotal, 2)}</b></td>
                    <td className="num"><b>{fmt.$(result.perUnit, 2)}/{result.productUnit}</b></td>
                  </tr>
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div className="span-5">
          <Card title="Inputs source" glyph="🔌">
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.7 }}>
              <div><b style={{ color: 'var(--text)' }}>Haulage rates</b> come live from the COGS Calculator (Finance ▸ COGS). Edit them there and the quote refreshes on next page load.</div>
              <div style={{ marginTop: 6 }}>
                <span className="pill pill-muted">Fuel ${(haulerInputs.fuelPrice ?? 2.05).toFixed(2)}/L</span>{' '}
                <span className="pill pill-muted">Driver ${(haulerInputs.operatorWage ?? 48).toFixed(0)}/hr</span>{' '}
                <span className="pill pill-muted">R&M ${(haulerInputs.rmPerKm ?? 0.34).toFixed(2)}/km</span>{' '}
                <span className="pill pill-muted">Tyres ${(haulerInputs.tyresPerKm ?? 0.18).toFixed(2)}/km</span>
              </div>
              {productCost && (
                <div style={{ marginTop: 10 }}>
                  <b style={{ color: 'var(--text)' }}>Production cost · {productCost.name}</b>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {fmt.$(productCost.total, 2)}/{productCost.unit} total (incl. {fmt.$(productCost.haulagePortion, 2)} default haulage).
                    Quote uses <b>{fmt.$(productCost.exHaulage, 2)}/{productCost.unit}</b> ex-haulage to avoid double counting; route-specific haulage is added on top.
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="Trailer reference" glyph="🚛">
            <table className="table">
              <thead><tr><th>Type</th><th className="num">t</th><th className="num">m³</th><th className="num">L/100km</th></tr></thead>
              <tbody>
                {TRAILER_TYPES.map(t => (
                  <tr key={t.id} style={{ background: t.id === trailerId ? 'var(--surface-2)' : 'transparent' }}>
                    <td>{t.name}</td>
                    <td className="num">{t.capacityT}</td>
                    <td className="num">{t.capacityM3}</td>
                    <td className="num muted">{t.fuelLPer100km}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title={`Saved quotes · ${savedQuotes.length}`} glyph="📁">
            {savedQuotes.length === 0 ? (
              <div className="muted" style={{ fontSize: 11.5 }}>No saved quotes yet. Build one on the left and hit <b>Save quote</b>.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {savedQuotes.map(q => (
                  <div key={q.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 10, fontSize: 11.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span><b>{q.id}</b> · {new Date(q.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}</span>
                      <button className="btn btn-ghost" onClick={() => deleteQuote(q.id)} style={{ fontSize: 10, padding: '2px 6px' }}>✕</button>
                    </div>
                    <div style={{ color: 'var(--text-dim)' }}>{q.origin} → {q.destination}</div>
                    <div style={{ color: 'var(--text-dim)' }}>{q.trailerName} · {q.productName} · {q.quantity} {q.productUnit} · {q.loadsNeeded} load{q.loadsNeeded > 1 ? 's' : ''}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span>{q.distanceKm} km · {q.marginPct}% margin</span>
                      <span><b style={{ color: 'var(--green)' }}>{fmt.$(q.quoteTotal, 0)}</b> <span className="muted">({fmt.$(q.perUnit, 2)}/{q.productUnit})</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {showKeyModal && <MapsKeyModal onClose={(saved) => {
        setShowKeyModal(false);
        setHasKey(!!loadMapsKey());
        setKeySource(mapsKeySource());
      }} />}
    </div>
  );
}

window.Quoting = {
  QuoteBuilder, calcQuote, loadQuotes, saveQuotes,
  loadMapsKey, saveMapsKey, productCostFromCogs,
  TRAILER_TYPES, DEFAULT_LOCATIONS,
};
window.QuoteBuilder = QuoteBuilder;
