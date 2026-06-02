// AI assistant — floating chat panel anchored to bottom-right.
// Sends user questions to /api/chat (Vercel function) which proxies to
// Anthropic's Messages API using the server-side ANTHROPIC_API_KEY.
// On every turn we build a fresh data snapshot from the live app state
// so the model has the current numbers without us needing tool-use.

const ASSISTANT_STORE_KEY = 'carbonchip:assistant-chat:v1';

function loadAssistantChat() {
  try { return JSON.parse(localStorage.getItem(ASSISTANT_STORE_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveAssistantChat(messages) {
  try { localStorage.setItem(ASSISTANT_STORE_KEY, JSON.stringify(messages.slice(-40))); }
  catch (e) {}
}

// ─── Data context builder ────────────────────────────────────────────
// Aggregates the user-facing figures from the BI app into a compact
// markdown snapshot. Stays under a few kilobytes so token cost is low.
function buildDataContext() {
  const lines = [];
  const today = new Date();
  lines.push(`# Carbonchip Pty Ltd — data snapshot (${today.toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' })})`);
  lines.push('Currency: AUD. Forestry business in SE QLD: chip, mulch, carbon, sawn timber, planting.');
  lines.push('');

  // ── Monthly P&L (hardcoded actuals + any user-imported P&L) ──
  try {
    const HC = window.FINANCE_HARDCODED_PL || {};
    const imported = window.PLImport ? window.PLImport.loadImportedPL() : { months: {} };
    const merged = { ...HC, ...(imported.months || {}) };
    const keys = Object.keys(merged).sort();
    if (keys.length) {
      lines.push('## Monthly P&L (actuals)');
      keys.forEach(k => {
        const v = merged[k];
        const rev = (v.tradingIncome || 0) + (v.otherIncome || 0);
        const cost = (v.costOfSales || 0) + (v.operatingExpenses || 0);
        const net = v.netProfit != null ? v.netProfit : (rev - cost);
        const margin = rev > 0 ? (net / rev * 100).toFixed(1) + '%' : 'n/a';
        lines.push(`- ${k}: Revenue $${Math.round(rev).toLocaleString()} · Cost $${Math.round(cost).toLocaleString()} · Net $${Math.round(net).toLocaleString()} (${margin})`);
      });
      lines.push('');
    }
  } catch (e) {}

  // ── COGS component cost + per-product ──
  try {
    const cogs = window.COGS;
    if (cogs) {
      const state = cogs.loadCogsState();
      const comp = cogs.calcAllComponents(state.inputs);
      lines.push('## Component operating cost');
      Object.entries(comp).forEach(([k, r]) => {
        const perCycle = k === 'haulage'
          ? `$${r.totalPerCycle.toFixed(2)}/load`
          : `$${r.perOperatingHour.toFixed(2)}/hr`;
        lines.push(`- ${k}: ${perCycle} → $${r.perOutputUnit.toFixed(2)}/${r.outputUnit}`);
      });
      lines.push('');

      const merged = {};
      Object.entries(cogs.PRODUCT_RECIPES).forEach(([pid, p]) => {
        merged[pid] = { ...p, consumption: state.recipes[pid]?.consumption ?? p.consumption };
      });
      const products = cogs.calcProducts(comp, merged);
      lines.push('## Per-product COGS');
      Object.values(products).forEach(p => {
        const parts = Object.entries(p.components)
          .map(([ck, c]) => `${ck} $${c.cost.toFixed(2)}`)
          .join(' + ');
        lines.push(`- ${p.name}: $${p.total.toFixed(2)}/${p.unit} = ${parts}`);
      });
      lines.push('');
    }
  } catch (e) {}

  // ── Clients / contracts ──
  try {
    if (window.DATA && window.DATA.CLIENTS) {
      lines.push('## Active client contracts');
      window.DATA.CLIENTS.forEach(c => {
        const cadence = c.loadsPerDay ? `${c.loadsPerDay} loads/day` : `${c.loadsPerWeek} loads/wk`;
        lines.push(`- ${c.name}: ${c.product} @ $${c.rate.toFixed(2)}/${c.unit}, ${cadence}, ${c.deliver ? 'delivered' : 'self-pickup'}`);
      });
      lines.push('');
    }
  } catch (e) {}

  // ── 90-day ops summary + by-client breakdown ──
  try {
    const A = window.AGG;
    if (A) {
      lines.push('## 90-day operations summary');
      lines.push(`- Revenue: $${Math.round(A.revenueYTD).toLocaleString()}`);
      lines.push(`- Cost: $${Math.round(A.costsYTD).toLocaleString()}`);
      lines.push(`- EBITDA: $${Math.round(A.ebitda).toLocaleString()} (${((A.margin || 0) * 100).toFixed(1)}% margin)`);
      lines.push(`- Loads delivered: ${A.totalLoads}`);
      lines.push(`- Revenue collected: $${Math.round(A.revenueCollected).toLocaleString()}`);
      lines.push(`- AR outstanding: $${Math.round(A.revenueOutstanding).toLocaleString()} (overdue $${Math.round(A.revenueOverdue).toLocaleString()})`);
      if (A.byClient) {
        lines.push('### Revenue by client (90d)');
        A.byClient.forEach(c => {
          lines.push(`- ${c.short}: $${Math.round(c.revenue).toLocaleString()} (${c.loads} loads, ${Math.round(c.tonnes)}t)`);
        });
      }
      if (A.costsByCategory) {
        lines.push('### Costs by category (90d)');
        A.costsByCategory.forEach(c => {
          lines.push(`- ${c.category}: $${Math.round(c.amount).toLocaleString()}`);
        });
      }
      if (A.costsByComponent) {
        lines.push('### Costs by operational component (90d)');
        A.costsByComponent.forEach(c => {
          lines.push(`- ${c.component}: $${Math.round(c.amount).toLocaleString()}`);
        });
      }
      if (A.profitByClient) {
        lines.push('### Profitability by client (revenue / alloc cost / margin)');
        A.profitByClient.forEach(c => {
          lines.push(`- ${c.short}: $${Math.round(c.revenue).toLocaleString()} / $${Math.round(c.allocCost).toLocaleString()} / ${(c.margin*100).toFixed(1)}%`);
        });
      }
      lines.push('');
    }
  } catch (e) {}

  // ── Yard stock ──
  try {
    if (window.DATA && window.DATA.STOCK) {
      lines.push('## Yard stock levels');
      window.DATA.STOCK.forEach(s => {
        const pct = ((s.m3 / s.target) * 100).toFixed(0);
        lines.push(`- ${s.product}: ${s.m3} m³ / target ${s.target} m³ (${pct}%) at ${s.location}`);
      });
      lines.push('');
    }
  } catch (e) {}

  // ── Fleet ──
  try {
    if (window.DATA && window.DATA.FLEET) {
      lines.push('## Fleet');
      window.DATA.FLEET.forEach(f => {
        lines.push(`- ${f.id} ${f.type}: ${f.make} (${f.year}), status ${f.status}`);
      });
      lines.push('');
    }
  } catch (e) {}

  // ── Saved quotes (if any) ──
  try {
    if (window.Quoting) {
      const qs = window.Quoting.loadQuotes();
      if (qs && qs.length) {
        lines.push(`## Saved quotes (last ${Math.min(qs.length, 5)})`);
        qs.slice(0, 5).forEach(q => {
          lines.push(`- ${q.id} ${q.origin} → ${q.destination}: ${q.productName} ${q.quantity}${q.productUnit}, ${q.distanceKm}km, $${Math.round(q.quoteTotal).toLocaleString()} (+${q.marginPct}%)`);
        });
        lines.push('');
      }
    }
  } catch (e) {}

  return lines.join('\n');
}

const SYSTEM_PROMPT = `You are Carbonchip's in-app BI assistant. Carbonchip Pty Ltd is an Australian forestry business in SE QLD producing chip, mulch, carbon, sawn timber and seedlings.

Answer questions using the data context below and the tools provided. Be concise, direct and numerical.
- Use AUD for money. Format compactly: $1,234 or $1.2k.
- When the user asks for a what-if, projection, quote, or detailed P&L line items, USE THE TOOLS rather than estimating from the snapshot.
- When the user asks "what should we do", give 1-3 actionable suggestions grounded in the data.
- When the data doesn't contain enough to answer, say so explicitly rather than guessing.
- Prefer short paragraphs and light bullet lists over headers.
- Keep answers under ~150 words unless the user asks for detail.

Available tools:
- model_cogs_change: apply what-if changes to COGS inputs (e.g. fuel price, wages, throughput) and return the resulting per-component and per-product costs, before vs after.
- calc_quote: compute a haulage quote given a one-way distance, trailer type, product and quantity. Returns load count, cost breakdown and quoted total.
- compare_months_pl: fetch detailed P&L line items (revenue and expense categories) for one or more months. Use when the user asks "why was this month worse" or wants category-level detail.`;

// ─── Tool definitions (sent to Anthropic) ───────────────────────────
const TOOLS = [
  {
    name: 'model_cogs_change',
    description: 'Apply what-if changes to COGS inputs (fuel price, operator wage, throughput, R&M etc.) for one or more components and return per-component and per-product cost before vs. after. Use this when the user asks "what if X changed" about any cost driver.',
    input_schema: {
      type: 'object',
      properties: {
        changes: {
          type: 'array',
          description: 'List of input changes to apply. Each change overrides one field on one component.',
          items: {
            type: 'object',
            properties: {
              component: { type: 'string', enum: ['haulage', 'grinder', 'excavator', 'planter', 'carbonator'] },
              field: { type: 'string', description: 'Input key, e.g. fuelPrice, operatorWage, fuelLPerHr, fuelLPer100km, throughputM3PerHr, throughputTPerHr, throughputHaPerHr, rmPerHr, rmPerKm, teethPerHr, hoursPerMonth, loadsPerMonth, capacityT, kmPerLoad, hoursPerLoad, loanPerMonth, insurancePerMonth, regoPerMonth, seedlingsPerHa, seedlingCost' },
              value: { type: 'number' },
            },
            required: ['component', 'field', 'value'],
          },
        },
      },
      required: ['changes'],
    },
  },
  {
    name: 'calc_quote',
    description: 'Calculate a haulage quote for a given distance, trailer and product. Returns per-load and total cost, loads needed, and quoted price with the requested margin.',
    input_schema: {
      type: 'object',
      properties: {
        distanceKm: { type: 'number', description: 'One-way road distance in km' },
        trailerId: { type: 'string', enum: ['bdouble', 'semi', 'tipper', 'walking', 'flatbed'] },
        productId: { type: 'string', enum: ['chip', 'microchip', 'mulch', 'shavings', 'carbon', 'biomass', 'logs', 'seedling'] },
        quantity: { type: 'number', description: 'Quantity in the product\'s native unit (m³, t, ea)' },
        marginPct: { type: 'number', description: 'Desired margin percentage. Default 25.' },
      },
      required: ['distanceKm', 'trailerId', 'productId', 'quantity'],
    },
  },
  {
    name: 'compare_months_pl',
    description: 'Fetch detailed P&L line items for one or more months in YYYY-MM format. Returns trading-income items, cost-of-sales items, other-income items, and operating-expense items per month (whatever Xero shipped). Use this when the user wants category-level analysis between months.',
    input_schema: {
      type: 'object',
      properties: {
        months: {
          type: 'array',
          items: { type: 'string', description: 'YYYY-MM' },
        },
      },
      required: ['months'],
    },
  },
];

// ─── Tool executors (run client-side) ────────────────────────────────
function execModelCogsChange({ changes }) {
  const cogs = window.COGS;
  if (!cogs) return { error: 'COGS module not loaded' };
  const state = cogs.loadCogsState();

  // Deep clone, apply changes
  const newInputs = JSON.parse(JSON.stringify(state.inputs));
  (changes || []).forEach(c => {
    if (!newInputs[c.component]) return;
    newInputs[c.component][c.field] = c.value;
  });

  const oldComp = cogs.calcAllComponents(state.inputs);
  const newComp = cogs.calcAllComponents(newInputs);

  const recipes = {};
  Object.entries(cogs.PRODUCT_RECIPES).forEach(([pid, p]) => {
    recipes[pid] = { ...p, consumption: state.recipes[pid]?.consumption ?? p.consumption };
  });
  const oldProducts = cogs.calcProducts(oldComp, recipes);
  const newProducts = cogs.calcProducts(newComp, recipes);

  return {
    applied: changes,
    componentCosts: Object.entries(newComp).map(([k, r]) => ({
      component: k,
      unit: r.outputUnit,
      before: +oldComp[k].perOutputUnit.toFixed(4),
      after: +r.perOutputUnit.toFixed(4),
      deltaPct: oldComp[k].perOutputUnit > 0 ? +(((r.perOutputUnit / oldComp[k].perOutputUnit) - 1) * 100).toFixed(2) : null,
    })),
    productCOGS: Object.entries(newProducts).map(([pid, p]) => ({
      id: pid,
      name: p.name,
      unit: p.unit,
      before: oldProducts[pid] ? +oldProducts[pid].total.toFixed(2) : null,
      after: +p.total.toFixed(2),
      delta: oldProducts[pid] ? +(p.total - oldProducts[pid].total).toFixed(2) : null,
    })),
  };
}

function execCalcQuote(args) {
  const Q = window.Quoting;
  const cogs = window.COGS;
  if (!Q || !cogs) return { error: 'Quoting / COGS module not loaded' };
  const trailer = Q.TRAILER_TYPES.find(t => t.id === args.trailerId);
  if (!trailer) return { error: `Unknown trailerId: ${args.trailerId}` };
  const productCost = Q.productCostFromCogs(args.productId);
  if (!productCost) return { error: `Unknown productId: ${args.productId}` };
  const state = cogs.loadCogsState();
  const hauler = state.inputs.haulage;

  const r = Q.calcQuote({
    distanceKm: Number(args.distanceKm) || 0,
    trailer, hauler,
    product: productCost,
    productCost,
    quantity: Number(args.quantity) || 0,
    marginPct: args.marginPct != null ? Number(args.marginPct) : 25,
  });

  return {
    inputs: { distanceKm: args.distanceKm, trailerId: args.trailerId, productId: args.productId, quantity: args.quantity, marginPct: args.marginPct ?? 25 },
    roundTripKm: +r.roundTripKm.toFixed(1),
    cycleHours: +r.cycleHours.toFixed(2),
    loadsNeeded: r.loadsNeeded,
    haulageCostPerLoad: +r.haulageCostPerLoad.toFixed(2),
    haulageTotal: +r.haulageTotal.toFixed(2),
    productCostTotal: +r.productCostTotal.toFixed(2),
    totalCost: +r.totalCost.toFixed(2),
    marginDollars: +r.marginDollars.toFixed(2),
    quoteTotal: +r.quoteTotal.toFixed(2),
    perUnit: +r.perUnit.toFixed(2),
    perLoad: +r.perLoad.toFixed(2),
    productUnit: r.productUnit,
  };
}

function execCompareMonthsPL({ months }) {
  const hc = window.FINANCE_HARDCODED_PL || {};
  const imp = window.PLImport ? (window.PLImport.loadImportedPL().months || {}) : {};
  const out = {};
  (months || []).forEach(m => {
    const v = imp[m] || hc[m];
    if (!v) { out[m] = null; return; }
    out[m] = {
      tradingIncome: v.tradingIncome,
      costOfSales: v.costOfSales,
      grossProfit: v.grossProfit,
      otherIncome: v.otherIncome,
      operatingExpenses: v.operatingExpenses,
      netProfit: v.netProfit,
      lineItems: v.lineItems || {},
    };
  });
  return out;
}

function executeTool(name, input) {
  switch (name) {
    case 'model_cogs_change':  return execModelCogsChange(input || {});
    case 'calc_quote':         return execCalcQuote(input || {});
    case 'compare_months_pl':  return execCompareMonthsPL(input || {});
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ─── Tiny markdown renderer (bold + bullets + line breaks) ───────────
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bullet
    if (/^\s*[-*•]\s+/.test(line)) {
      const content = line.replace(/^\s*[-*•]\s+/, '');
      return <div key={i} style={{ paddingLeft: 12, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0 }}>•</span>
        {renderInline(content)}
      </div>;
    }
    if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i}>{renderInline(line)}</div>;
  });
}
function renderInline(text) {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <b key={i}>{p.slice(2, -2)}</b>;
    }
    return p;
  });
}

// Pill rendered when the assistant calls a tool
function ToolUsePill({ name, input }) {
  const [open, setOpen] = useState(false);
  const summary = (() => {
    if (name === 'model_cogs_change' && input && Array.isArray(input.changes)) {
      return input.changes.map(c => `${c.component}.${c.field} = ${c.value}`).join('; ');
    }
    if (name === 'calc_quote') {
      return `${input.distanceKm}km · ${input.trailerId} · ${input.quantity} ${input.productId}${input.marginPct != null ? ` · ${input.marginPct}%` : ''}`;
    }
    if (name === 'compare_months_pl') {
      return (input.months || []).join(', ');
    }
    return '';
  })();
  return (
    <div style={{
      alignSelf: 'flex-start',
      background: '#ecfeff', color: '#0e7490',
      border: '1px solid #a5f3fc',
      padding: '6px 10px', borderRadius: 8,
      fontSize: 11, marginBottom: 2, maxWidth: '90%',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'transparent', border: 'none', padding: 0,
        cursor: 'pointer', color: 'inherit', textAlign: 'left', width: '100%',
        fontSize: 11, fontFamily: 'var(--mono)',
      }}>
        🔧 <b>{name}</b>{summary && <> · {summary}</>} <span style={{ opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <pre style={{ margin: '6px 0 0', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Pill rendered for the tool's result going back to Claude
function ToolResultPill({ content }) {
  const [open, setOpen] = useState(false);
  let parsed = null;
  try { parsed = typeof content === 'string' ? JSON.parse(content) : content; } catch (e) {}
  const isError = parsed && parsed.error;
  // One-line summary
  const summary = (() => {
    if (!parsed) return '';
    if (isError) return parsed.error;
    if (parsed.quoteTotal != null) return `quote $${parsed.quoteTotal.toLocaleString()} (${parsed.loadsNeeded} loads)`;
    if (parsed.productCOGS) return `${parsed.productCOGS.length} products updated`;
    const keys = Object.keys(parsed);
    return keys.length ? `${keys.length} month(s) returned` : '';
  })();
  return (
    <div style={{
      alignSelf: 'flex-start',
      background: isError ? '#fff1f2' : '#f1f5f9',
      color: isError ? 'var(--red-deep)' : 'var(--text-dim)',
      border: '1px solid ' + (isError ? '#fecdd3' : 'var(--border)'),
      padding: '6px 10px', borderRadius: 8,
      fontSize: 11, marginBottom: 2, maxWidth: '90%',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'transparent', border: 'none', padding: 0,
        cursor: 'pointer', color: 'inherit', textAlign: 'left', width: '100%',
        fontSize: 11,
      }}>
        ↩ <b>result</b>{summary && <> · {summary}</>} <span style={{ opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <pre style={{ margin: '6px 0 0', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto' }}>
          {parsed ? JSON.stringify(parsed, null, 2) : String(content)}
        </pre>
      )}
    </div>
  );
}

function renderMessage(m, i) {
  // user-role message with array content is a tool_result envelope
  if (m.role === 'user' && Array.isArray(m.content)) {
    return (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {m.content.map((b, j) => b.type === 'tool_result'
          ? <ToolResultPill key={j} content={b.content} />
          : null)}
      </div>
    );
  }
  // user text message
  if (m.role === 'user') {
    return (
      <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '90%' }}>
        <div style={{
          background: '#0f172a', color: 'white',
          padding: '8px 12px', borderRadius: 10, whiteSpace: 'normal',
        }}>{m.content}</div>
      </div>
    );
  }
  // assistant message with array content (text + tool_use blocks)
  if (m.role === 'assistant' && Array.isArray(m.content)) {
    return (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', width: '100%' }}>
        {m.model && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            🤖 {m.model.split('-').slice(0, 3).join(' ')}
          </div>
        )}
        {m.content.map((b, j) => {
          if (b.type === 'text') return (
            <div key={j} style={{
              background: 'var(--surface-2)', color: 'var(--text)',
              padding: '8px 12px', borderRadius: 10, maxWidth: '90%',
            }}>{renderMarkdown(b.text)}</div>
          );
          if (b.type === 'tool_use') return <ToolUsePill key={j} name={b.name} input={b.input} />;
          return null;
        })}
        {m.usage && (
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {m.usage.input_tokens} in · {m.usage.output_tokens} out
          </div>
        )}
      </div>
    );
  }
  // assistant message with plain text (e.g. error fallback)
  return (
    <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '90%' }}>
      {m.model && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
          🤖 {m.model.split('-').slice(0, 3).join(' ')}
        </div>
      )}
      <div style={{
        background: m.error ? '#fff1f2' : 'var(--surface-2)',
        color: m.error ? 'var(--red-deep)' : 'var(--text)',
        border: m.error ? '1px solid #fecdd3' : 'none',
        padding: '8px 12px', borderRadius: 10, whiteSpace: 'normal',
      }}>{renderMarkdown(m.content)}</div>
    </div>
  );
}

function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(loadAssistantChat);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);

  useEffect(() => { saveAssistantChat(messages); }, [messages]);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, thinking, open]);

  // Normalise a chat message into Anthropic's expected API shape.
  // Stored messages have either string content (typical) or an array
  // of content blocks (when tool_use / tool_result are involved).
  const toApiMessages = (msgs) => msgs.map(m => ({
    role: m.role,
    content: Array.isArray(m.content) ? m.content : m.content,
  })).filter(m => m.content !== undefined && m.content !== null && m.content !== '');

  const send = async () => {
    const q = input.trim();
    if (!q || thinking) return;
    let convo = [...messages, { role: 'user', content: q, ts: Date.now() }];
    setMessages(convo);
    setInput('');
    setThinking(true);
    setError(null);

    const context = buildDataContext();
    const system = `${SYSTEM_PROMPT}\n\n# Data context\n${context}`;

    // Agentic loop: call → tool? execute → call → … (cap iterations as a safety)
    let safety = 0;
    try {
      while (safety++ < 6) {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: toApiMessages(convo), system, tools: TOOLS }),
        });
        const data = await r.json();
        if (!r.ok) {
          const msg = data.error || `Request failed (${r.status})`;
          setError(msg);
          convo = [...convo, { role: 'assistant', content: `⚠ ${msg}`, ts: Date.now(), error: true }];
          setMessages(convo);
          break;
        }

        const blocks = Array.isArray(data.content) ? data.content : [];
        const assistantMsg = {
          role: 'assistant',
          content: blocks,
          ts: Date.now(),
          model: data.model,
          usage: data.usage,
        };
        convo = [...convo, assistantMsg];
        setMessages(convo);

        if (data.stopReason !== 'tool_use') break;

        // Execute every tool_use block from this turn, append results as user message
        const toolUses = blocks.filter(b => b.type === 'tool_use');
        const toolResults = toolUses.map(tu => {
          let result;
          try { result = executeTool(tu.name, tu.input); }
          catch (e) { result = { error: e.message || String(e) }; }
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          };
        });
        convo = [...convo, { role: 'user', content: toolResults, ts: Date.now() }];
        setMessages(convo);
      }
    } catch (e) {
      setError(e.message);
      setMessages(m => [...m, { role: 'assistant', content: `⚠ Network error: ${e.message}`, ts: Date.now(), error: true }]);
    } finally {
      setThinking(false);
    }
  };

  const clear = () => {
    if (!window.confirm('Clear assistant chat history?')) return;
    setMessages([]);
  };

  const suggest = [
    "Model a 5% wage rise on chip and carbon COGS",
    "Quote 80 m³ of chip to Brisbane, 120 km, B-Double, 25% margin",
    "Why was March worse than April? Compare line items",
    "What's eating the most cost in the last 90 days?",
  ];

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        title="Ask the BI assistant"
        aria-label="Open AI assistant"
        style={{
          position: 'fixed',
          bottom: 96,           // sits above the existing + FAB (which is at 24)
          right: 24,
          width: 56, height: 56,
          borderRadius: '50%',
          border: 'none',
          background: open ? 'linear-gradient(135deg, #7c3aed, #0891b2)' : 'linear-gradient(135deg, #0891b2, #7c3aed)',
          color: 'white',
          fontSize: 22,
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(15,23,42,0.20)',
          zIndex: 90,
          transition: 'transform 120ms ease',
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.94)'}
        onMouseUp={e => e.currentTarget.style.transform = ''}
        onMouseLeave={e => e.currentTarget.style.transform = ''}
      >
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          bottom: 164,            // above the button (button is at 96, +56 height +12 gap ≈ 164)
          right: 24,
          width: 'min(440px, calc(100vw - 32px))',
          height: 'min(620px, calc(100vh - 200px))',
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(15,23,42,0.18)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 95,
          overflow: 'hidden',
        }}>
          <header style={{
            padding: '12px 14px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #ecfeff, #f5f3ff)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>🤖 BI Assistant</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Ask about P&L, COGS, clients, ops</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost" onClick={clear} title="Clear chat" style={{ padding: '4px 8px', fontSize: 11 }}>🗑️</button>
              <button className="btn btn-ghost" onClick={() => setOpen(false)} style={{ padding: '4px 8px', fontSize: 11 }}>✕</button>
            </div>
          </header>

          <div ref={listRef} style={{
            flex: 1,
            overflowY: 'auto',
            padding: 14,
            display: 'flex', flexDirection: 'column', gap: 12,
            fontSize: 13, lineHeight: 1.55,
          }}>
            {messages.length === 0 && (
              <div>
                <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 10 }}>
                  I have access to the live P&L, COGS, client list, 90-day ops figures, stock and saved quotes. Try one of these:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {suggest.map((s, i) => (
                    <button key={i} className="btn btn-ghost"
                      onClick={() => setInput(s)}
                      style={{ textAlign: 'left', fontSize: 12, padding: '6px 10px', justifyContent: 'flex-start' }}>
                      → {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => renderMessage(m, i))}
            {thinking && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-dim)', fontSize: 12, display: 'flex', gap: 4 }}>
                <span>🤖</span>
                <span style={{ opacity: 0.6 }}>thinking…</span>
              </div>
            )}
          </div>

          <form onSubmit={e => { e.preventDefault(); send(); }} style={{
            borderTop: '1px solid var(--border)',
            padding: 10,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask anything about the data…"
                disabled={thinking}
                autoFocus
                style={{ flex: 1, fontSize: 13 }}
              />
              <button type="submit" className="btn btn-primary" disabled={thinking || !input.trim()} style={{ minWidth: 44 }}>
                {thinking ? '…' : '↵'}
              </button>
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
              Sends current P&L / COGS / ops figures to Claude via your Vercel function. Set <code>ANTHROPIC_API_KEY</code> on Vercel to activate.
            </div>
          </form>
        </div>
      )}
    </>
  );
}

window.Assistant = Assistant;
window.buildAssistantContext = buildDataContext;
