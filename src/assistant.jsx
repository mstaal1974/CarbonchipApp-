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

Answer questions using only the data context below. Be concise, direct and numerical.
- Use AUD for money. Format compactly: $1,234 or $1.2k.
- When the user asks "what should we do", give 1-3 actionable suggestions grounded in the data.
- When the data doesn't contain enough to answer, say so explicitly rather than guessing.
- Prefer short paragraphs and light bullet lists over headers.
- Keep answers under ~150 words unless the user asks for detail.`;

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

  const send = async () => {
    const q = input.trim();
    if (!q || thinking) return;
    const newMsgs = [...messages, { role: 'user', content: q, ts: Date.now() }];
    setMessages(newMsgs);
    setInput('');
    setThinking(true);
    setError(null);

    try {
      const context = buildDataContext();
      const system = `${SYSTEM_PROMPT}\n\n# Data context\n${context}`;
      const apiMessages = newMsgs.map(m => ({ role: m.role, content: m.content }));

      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, system }),
      });
      const data = await r.json();
      if (!r.ok) {
        const msg = data.error || `Request failed (${r.status})`;
        setError(msg);
        setMessages(m => [...m, { role: 'assistant', content: `⚠ ${msg}`, ts: Date.now(), error: true }]);
      } else {
        setMessages(m => [...m, {
          role: 'assistant',
          content: data.reply || '(empty reply)',
          ts: Date.now(),
          usage: data.usage,
          model: data.model,
        }]);
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
    "What's our worst-margin client?",
    "Which month had the highest revenue?",
    "How would a $0.20/L fuel price hike change chip COGS?",
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
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
              }}>
                {m.role === 'assistant' && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                    🤖 {m.model ? m.model.split('-').slice(0,3).join(' ') : 'Assistant'}
                  </div>
                )}
                <div style={{
                  background: m.role === 'user' ? '#0f172a' : (m.error ? '#fff1f2' : 'var(--surface-2)'),
                  color: m.role === 'user' ? 'white' : (m.error ? 'var(--red-deep)' : 'var(--text)'),
                  border: m.error ? '1px solid #fecdd3' : 'none',
                  padding: '8px 12px',
                  borderRadius: 10,
                  whiteSpace: 'normal',
                }}>
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
                {m.usage && (
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                    {m.usage.input_tokens} in · {m.usage.output_tokens} out
                  </div>
                )}
              </div>
            ))}
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
