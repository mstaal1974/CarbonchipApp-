// P&L PDF importer — parses Xero-style "Profit and Loss" PDFs and
// persists monthly totals to localStorage so they can supplement the
// synthetic data on the Finance tab.

const PL_STORAGE_KEY = 'carbonchip:imported-pl:v1';
const PDFJS_VERSION = '3.11.174';
const PDFJS_LIB = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.min.js`;
const PDFJS_WORKER = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.worker.min.js`;
const XLSX_LIB = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js';

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function monthKey(monthLabel) {
  // "APR 2026" -> "2026-04"
  const [mon, yr] = monthLabel.trim().split(/\s+/);
  const m = MONTH_NAMES.indexOf(mon.toUpperCase());
  if (m < 0 || !yr) return null;
  return `${yr}-${String(m + 1).padStart(2, '0')}`;
}

function parseNumberCell(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (t === '' || t === '-' || t === '—') return 0;
  // Parentheses indicate negative
  const neg = /^\(.*\)$/.test(t);
  const cleaned = t.replace(/[(),$\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return neg ? -n : n;
}

// Load pdf.js once, lazily.
let _pdfjsPromise = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PDFJS_LIB;
    s.onload = () => {
      if (!window.pdfjsLib) return reject(new Error('pdf.js failed to load'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error('pdf.js network error'));
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}

// Extract a page's text into rows of {x, str}, sorted top-to-bottom then left-to-right.
async function extractRows(pdf) {
  const rows = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const byY = new Map();
    tc.items.forEach(it => {
      const y = Math.round(it.transform[5]);
      // Cluster nearby y's (within 2pt)
      let bucket = null;
      for (const k of byY.keys()) {
        if (Math.abs(k - y) <= 2) { bucket = k; break; }
      }
      const key = bucket === null ? y : bucket;
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key).push({ x: it.transform[4], str: it.str });
    });
    const ys = [...byY.keys()].sort((a, b) => b - a); // top of page = higher y
    ys.forEach(y => {
      const row = byY.get(y).sort((a, b) => a.x - b.x);
      rows.push(row);
    });
  }
  return rows;
}

// Group a row's items into a label and N numeric columns by x-position
// relative to detected column anchors.
function rowToCells(row, columnAnchors) {
  if (!row.length) return null;
  // Find label: items left of the first column anchor
  const firstX = columnAnchors[0];
  const labelItems = [];
  const colItems = columnAnchors.map(() => []);
  row.forEach(it => {
    if (it.x < firstX - 4) {
      labelItems.push(it);
    } else {
      // Bucket into closest column anchor
      let bestIdx = 0, bestDiff = Infinity;
      columnAnchors.forEach((cx, i) => {
        const d = Math.abs(it.x - cx);
        if (d < bestDiff) { bestDiff = d; bestIdx = i; }
      });
      colItems[bestIdx].push(it);
    }
  });
  const label = labelItems.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
  const cells = colItems.map(items => items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim());
  return { label, cells };
}

function parsePLRows(rows) {
  // Locate header row containing month labels (e.g. "APR 2026")
  const monthRe = /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}\b/;
  let headerRow = null;
  for (const row of rows) {
    const joined = row.map(i => i.str).join(' ');
    if (monthRe.test(joined)) {
      // Require at least 2 month tokens to qualify as a header
      const matches = joined.match(new RegExp(monthRe.source, 'g')) || [];
      if (matches.length >= 2) { headerRow = row; break; }
    }
  }
  if (!headerRow) throw new Error('Could not find month header row in PDF');

  // Reconstruct month labels & their x-positions by walking adjacent items.
  // Tokens may be combined ("APR 2026") or split across two items ("APR", "2026").
  const items = headerRow.slice();
  const months = [];
  const monthOnlyRe = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\.?$/i;
  const fullRe = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{4})/i;
  for (let i = 0; i < items.length; i++) {
    const s = items[i].str.trim();
    if (!s) continue;
    if (monthOnlyRe.test(s)) {
      const next = items[i + 1] && items[i + 1].str.trim();
      if (next && /^\d{4}$/.test(next)) {
        months.push({ label: `${s.toUpperCase().replace('.','')} ${next}`, x: items[i].x });
        i++;
        continue;
      }
    }
    const m = s.match(fullRe);
    if (m) months.push({ label: `${m[1].toUpperCase()} ${m[2]}`, x: items[i].x });
  }
  if (months.length < 1) throw new Error('No month columns detected');

  const columnAnchors = months.map(m => m.x);
  const monthKeys = months.map(m => monthKey(m.label));

  // Initialise output structure
  const out = {};
  monthKeys.forEach(k => {
    if (!k) return;
    out[k] = {
      tradingIncome: null, costOfSales: null, grossProfit: null,
      otherIncome: null, operatingExpenses: null, netProfit: null,
      lineItems: {},
    };
  });

  // Target totals we care about. Allow trailing text because XLSX exports
  // sometimes glue the next section header onto the totals row.
  const totalMap = [
    { re: /^total trading income\b/i,      field: 'tradingIncome' },
    { re: /^total cost of sales\b/i,       field: 'costOfSales' },
    { re: /^gross profit\b/i,              field: 'grossProfit' },
    { re: /^total other income\b/i,        field: 'otherIncome' },
    { re: /^total operating expenses\b/i,  field: 'operatingExpenses' },
    { re: /^net profit\b/i,                field: 'netProfit' },
  ];

  rows.forEach(row => {
    const parsed = rowToCells(row, columnAnchors);
    if (!parsed || !parsed.label) return;
    const label = parsed.label.replace(/\s+/g, ' ').trim();

    const numeric = parsed.cells.map(parseNumberCell);
    const numericCount = numeric.filter(n => n !== null).length;
    if (numericCount < 1) return;

    // Match totals
    let matchedField = null;
    for (const t of totalMap) {
      if (t.re.test(label)) { matchedField = t.field; break; }
    }
    monthKeys.forEach((k, i) => {
      if (!k || numeric[i] === null) return;
      if (matchedField) {
        out[k][matchedField] = numeric[i];
      } else {
        // Store as detailed line item for future use
        out[k].lineItems[label] = numeric[i];
      }
    });
  });

  // Drop months that ended up empty
  Object.keys(out).forEach(k => {
    const m = out[k];
    if (m.tradingIncome === null && m.costOfSales === null &&
        m.grossProfit === null && m.netProfit === null &&
        m.operatingExpenses === null) {
      delete out[k];
    }
  });

  return out;
}

// ── XLSX support ──
let _xlsxPromise = null;
function loadXlsxLib() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxPromise) return _xlsxPromise;
  _xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_LIB;
    s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('xlsx failed to load'));
    s.onerror = () => reject(new Error('xlsx network error'));
    document.head.appendChild(s);
  });
  return _xlsxPromise;
}

// Parse a 2D array of cell values (already extracted from a worksheet)
// into the same monthly totals shape as the PDF parser.
function parsePLGrid(grid) {
  const monthFullRe = /^\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\.?\s+(\d{4})\s*$/i;

  // Find header row and the column indexes that hold months
  let headerRowIdx = -1;
  let monthCols = [];
  for (let r = 0; r < grid.length && headerRowIdx < 0; r++) {
    const cols = [];
    grid[r].forEach((cell, c) => {
      const s = (cell == null ? '' : String(cell)).trim();
      const m = s.match(monthFullRe);
      if (m) cols.push({ col: c, label: `${m[1].toUpperCase()} ${m[2]}` });
    });
    if (cols.length >= 2) { headerRowIdx = r; monthCols = cols; }
  }
  if (headerRowIdx < 0) throw new Error('No month header row found in spreadsheet');

  const monthKeys = monthCols.map(m => monthKey(m.label));
  const out = {};
  monthKeys.forEach(k => {
    if (!k) return;
    out[k] = {
      tradingIncome: null, costOfSales: null, grossProfit: null,
      otherIncome: null, operatingExpenses: null, netProfit: null,
      lineItems: {},
    };
  });

  const totalMap = [
    { re: /^total trading income\b/i,      field: 'tradingIncome' },
    { re: /^total cost of sales\b/i,       field: 'costOfSales' },
    { re: /^gross profit\b/i,              field: 'grossProfit' },
    { re: /^total other income\b/i,        field: 'otherIncome' },
    { re: /^total operating expenses\b/i,  field: 'operatingExpenses' },
    { re: /^net profit\b/i,                field: 'netProfit' },
  ];

  for (let r = headerRowIdx + 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row || !row.length) continue;
    // Label = first non-empty cell to the left of the first month column
    const firstMonthCol = monthCols[0].col;
    let label = '';
    for (let c = 0; c < firstMonthCol; c++) {
      const v = row[c];
      if (v != null && String(v).trim() !== '') {
        label = String(v).trim();
        break;
      }
    }
    if (!label) continue;
    // Normalise newlines (Xero glues section headers onto totals rows)
    const normLabel = label.replace(/\s+/g, ' ').trim();

    const numeric = monthCols.map(({ col }) => {
      const v = row[col];
      if (v == null || v === '') return null;
      if (typeof v === 'number') return v;
      return parseNumberCell(String(v));
    });
    if (numeric.filter(n => n !== null).length < 1) continue;

    let matchedField = null;
    for (const t of totalMap) {
      if (t.re.test(normLabel)) { matchedField = t.field; break; }
    }
    monthKeys.forEach((k, i) => {
      if (!k || numeric[i] === null) return;
      if (matchedField) {
        // First match wins so the totals row doesn't get overwritten by a
        // later line item that happens to share its label prefix.
        if (out[k][matchedField] === null) out[k][matchedField] = numeric[i];
      } else {
        out[k].lineItems[normLabel] = numeric[i];
      }
    });
  }

  Object.keys(out).forEach(k => {
    const m = out[k];
    if (m.tradingIncome === null && m.costOfSales === null &&
        m.grossProfit === null && m.netProfit === null &&
        m.operatingExpenses === null) {
      delete out[k];
    }
  });
  return out;
}

async function parseXlsxFile(file) {
  const XLSX = await loadXlsxLib();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  // header: 1 returns a 2D array with empty cells preserved; defval keeps them aligned
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: true });
  return parsePLGrid(grid);
}

function isXlsx(file) {
  const n = (file.name || '').toLowerCase();
  if (n.endsWith('.xlsx') || n.endsWith('.xlsm') || n.endsWith('.xls')) return true;
  const t = file.type || '';
  return t.includes('spreadsheetml') || t.includes('ms-excel');
}

async function parsePLFile(file) {
  let months;
  if (isXlsx(file)) {
    months = await parseXlsxFile(file);
  } else {
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const rows = await extractRows(pdf);
    months = parsePLRows(rows);
  }
  return { months, source: file.name, importedAt: new Date().toISOString() };
}

// ── Storage ──
function loadImportedPL() {
  try {
    const raw = localStorage.getItem(PL_STORAGE_KEY);
    if (!raw) return { months: {}, imports: [] };
    const parsed = JSON.parse(raw);
    return { months: parsed.months || {}, imports: parsed.imports || [] };
  } catch (e) {
    return { months: {}, imports: [] };
  }
}

function saveImportedPL(state) {
  localStorage.setItem(PL_STORAGE_KEY, JSON.stringify(state));
}

function mergeImport(existing, fresh) {
  const months = { ...existing.months };
  Object.entries(fresh.months).forEach(([k, v]) => {
    months[k] = { ...v, _source: fresh.source, _importedAt: fresh.importedAt };
  });
  const imports = [
    ...existing.imports.filter(i => i.source !== fresh.source),
    { source: fresh.source, importedAt: fresh.importedAt, monthCount: Object.keys(fresh.months).length },
  ];
  return { months, imports };
}

function clearImportedPL() {
  localStorage.removeItem(PL_STORAGE_KEY);
}

// ── UI: button + drag-drop ──
function PLUploader({ onImported }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lastImport, setLastImport] = useState(() => loadImportedPL().imports.slice(-1)[0] || null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = await parsePLFile(file);
      const count = Object.keys(fresh.months).length;
      if (count === 0) throw new Error('No P&L months parsed from this PDF');
      const existing = loadImportedPL();
      const merged = mergeImport(existing, fresh);
      saveImportedPL(merged);
      setLastImport({ source: fresh.source, importedAt: fresh.importedAt, monthCount: count });
      if (onImported) onImported(merged);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Import failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleClear = () => {
    if (!window.confirm('Clear all imported P&L data?')) return;
    clearImportedPL();
    setLastImport(null);
    if (onImported) onImported({ months: {}, imports: [] });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf,.xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files && e.target.files[0])}
      />
      <button
        className="btn btn-primary"
        onClick={() => inputRef.current && inputRef.current.click()}
        disabled={busy}
        title="Upload a Xero P&L (PDF or XLSX) to update the monthly view"
      >
        {busy ? '⏳ Parsing…' : '📤 Upload P&L'}
      </button>
      {lastImport && (
        <span className="pill pill-cyan" title={lastImport.source}>
          {lastImport.monthCount} mo · {lastImport.source.length > 22 ? lastImport.source.slice(0, 22) + '…' : lastImport.source}
        </span>
      )}
      {lastImport && (
        <button className="btn btn-ghost" onClick={handleClear} title="Clear imported P&L data">✕</button>
      )}
      {error && <span className="pill pill-red" title={error}>⚠ {error.length > 40 ? error.slice(0, 40) + '…' : error}</span>}
    </div>
  );
}

window.PLImport = {
  loadImportedPL,
  saveImportedPL,
  clearImportedPL,
  parsePLFile,
  PLUploader,
};
window.PLUploader = PLUploader;
