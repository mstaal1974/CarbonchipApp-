// Haulage delivery receipt + sign-on-glass.
//
// Two parties (Driver + Recipient) sign on a touch/mouse canvas, then the
// receipt can be emailed (via the device mail client) and/or printed/saved
// as a PDF for the records. Signatures are returned to the caller so they
// can be persisted into the saved entry payload for admin review.
//
// This is fully client-side: it works offline. "Email" uses a mailto: link
// (the only attachment-free channel available without a mail backend), so
// the body carries a formatted text receipt; the printable copy carries the
// embedded signature images for a Save-as-PDF attachment or hard copy.

// ─── Sign-on-glass canvas ────────────────────────────────────────────
function SignaturePad({ value, onChange, height = 150 }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const dataRef = useRef(value || null); // latest committed signature (survives resize)
  const [hasInk, setHasInk] = useState(!!value);

  // Fit the canvas backing store to its rendered box at the device pixel
  // ratio (crisp on retina phones/tablets), then redraw any existing ink.
  // Re-run on resize / orientation change so a rotated tablet stays aligned.
  const fitCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b3b2e';
    ctxRef.current = ctx;
    if (dataRef.current) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = dataRef.current;
    }
  };

  useEffect(() => {
    fitCanvas();
    let raf = 0;
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fitCanvas); };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Pointer Events unify finger, stylus and mouse across phone/tablet/desktop
  // browsers. Scroll/zoom is blocked via `touch-action: none` (below) rather
  // than preventDefault, which React attaches passively for touch events.
  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // primary button only
    drawing.current = true;
    last.current = pos(e);
    // Capture so the stroke keeps tracking if the finger/pen drifts off-canvas.
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch (_) {}
    // A tap should leave a visible dot.
    const ctx = ctxRef.current;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    if (!hasInk) setHasInk(true);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = ctxRef.current;
    // Coalesced events give smoother lines on high-rate touch/stylus input.
    const events = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    for (const ev of events) {
      const p = pos(ev);
      ctx.lineTo(p.x, p.y);
      last.current = p;
    }
    ctx.stroke();
  };
  const end = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    try { canvasRef.current.releasePointerCapture(e.pointerId); } catch (_) {}
    const url = canvasRef.current.toDataURL('image/png');
    dataRef.current = url;
    onChange(url);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    ctxRef.current.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    dataRef.current = null;
    setHasInk(false);
    onChange(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ position: 'relative', border: '1px solid var(--border-bright)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height, display: 'block', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'crosshair' }}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        />
        {!hasInk && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 12 }}>
            ✍️ Sign here
          </div>
        )}
      </div>
      <button type="button" className="btn btn-ghost" onClick={clear} style={{ alignSelf: 'flex-end', fontSize: 11, padding: '3px 8px' }}>
        Clear
      </button>
    </div>
  );
}

// ─── Full-screen signing surface ─────────────────────────────────────
// Far easier to sign on a phone/tablet than a small inline box. Sits above
// the receipt modal and locks body scroll while open. Changes are only
// committed when the user taps "Save Signature".
function SignatureCaptureOverlay({ title, initial, onCancel, onSave }) {
  const [draft, setDraft] = useState(initial || null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(4vw, 24px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(960px, 100%)', maxHeight: '100%', background: 'var(--surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 16, color: 'var(--green-bright)' }}>{title}</h3>
          <span className="hide-on-mobile" style={{ fontSize: 11, color: 'var(--text-dim)' }}>↻ Rotate to landscape for more room</span>
        </div>
        <div style={{ padding: 16 }}>
          <SignaturePad value={initial} onChange={setDraft} height="min(58vh, 460px)" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(draft)}>✓ Save Signature</button>
        </div>
      </div>
    </div>
  );
}

// ─── Compact signature slot ──────────────────────────────────────────
// Shows a "Tap to sign" button when empty, or a thumbnail + actions once
// signed. Tapping opens the full-screen pad above.
function SignatureField({ who, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={value} alt="signature" style={{ height: 56, width: 150, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Pill tone="green"><Dot tone="green" /> Signed</Pill>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setOpen(true)}>Re-sign</button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => onChange(null)}>Clear</button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn"
          style={{ width: '100%', padding: '20px 12px', borderStyle: 'dashed', justifyContent: 'center', color: 'var(--text-dim)' }}
          onClick={() => setOpen(true)}
        >
          ✍️ Tap to sign{who ? ` — ${who}` : ''}
        </button>
      )}
      {open && (
        <SignatureCaptureOverlay
          title={`Signature${who ? ' — ' + who : ''}`}
          initial={value}
          onCancel={() => setOpen(false)}
          onSave={(sig) => { onChange(sig); setOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── Receipt field helpers ───────────────────────────────────────────
function truckLabel(truckId) {
  const f = (DATA.FLEET || []).find(x => x.id === truckId);
  return f ? `${f.id} · ${f.plate}` : (truckId || '—');
}

function receiptRows(p) {
  const dirLabel = p.direction === 'inbound' ? 'Inbound (Site → Yard)' : 'Outbound (Yard → Client)';
  return [
    ['Direction', dirLabel],
    ['Date / Time', `${p.date || '—'}  ${p.time || ''}`.trim()],
    ['From', (p.from && p.from.address) || '—'],
    ['To', (p.to && p.to.address) || '—'],
    ['Trailer', p.trailer || '—'],
    ['Truck', truckLabel(p.truck)],
    ['Product', p.product || '—'],
    ['Driver', p.driver || '—'],
    ['Tonnes', p.tonnes ? `${p.tonnes} t` : '—'],
    ['Volume', p.m3 ? `${p.m3} m³` : '—'],
    ['Notes', p.notes || '—'],
  ];
}

function receiptTextBody(p, receiptNo, recipientName) {
  const lines = [
    'CARBONCHIP — HAULAGE DELIVERY RECEIPT',
    `Receipt #: ${receiptNo}`,
    '',
    ...receiptRows(p).map(([k, v]) => `${k}: ${v}`),
    '',
    recipientName ? `Recipient: ${recipientName}` : '',
    'Signatures (driver + recipient) are on the attached/printed copy.',
    '',
    '— Sent from the CARBONCHIP Input App',
  ];
  return lines.filter(l => l !== null && l !== undefined).join('\n');
}

// Self-contained printable HTML (signatures embedded) for Save-as-PDF / hard copy.
function buildPrintableReceipt(p, { receiptNo, recipientName, driverSig, recipientSig, issuedBy }) {
  const rows = receiptRows(p)
    .map(([k, v]) => `<tr><th>${k}</th><td>${String(v).replace(/</g, '&lt;')}</td></tr>`)
    .join('');
  const sigBox = (title, who, dataUrl) => `
    <div class="sig">
      <div class="sig-title">${title}${who ? ' — ' + who : ''}</div>
      <div class="sig-pad">${dataUrl ? `<img src="${dataUrl}" alt="signature"/>` : '<span class="unsigned">Not signed</span>'}</div>
    </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>Receipt ${receiptNo}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 32px; }
  h1 { font-size: 18px; margin: 0 0 2px; color: #047857; letter-spacing: .5px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { width: 140px; color: #475569; font-weight: 600; }
  .sigs { display: flex; gap: 24px; margin-top: 28px; }
  .sig { flex: 1; }
  .sig-title { font-size: 12px; color: #475569; font-weight: 600; margin-bottom: 6px; }
  .sig-pad { border: 1px solid #cbd5e1; border-radius: 8px; height: 130px; display: grid; place-items: center; overflow: hidden; }
  .sig-pad img { max-width: 100%; max-height: 100%; }
  .unsigned { color: #94a3b8; font-size: 12px; }
  .foot { margin-top: 24px; font-size: 11px; color: #94a3b8; }
  @media print { .noprint { display: none; } body { margin: 12mm; } }
</style></head><body>
  <h1>CARBONCHIP — Haulage Delivery Receipt</h1>
  <div class="sub">Receipt #${receiptNo}${issuedBy ? ' · Issued by ' + issuedBy : ''}</div>
  <table>${rows}</table>
  <div class="sigs">
    ${sigBox('Driver signature', p.driver, driverSig)}
    ${sigBox('Recipient signature', recipientName, recipientSig)}
  </div>
  <div class="foot">Generated by the CARBONCHIP Input App · ${new Date().toLocaleString('en-AU')}</div>
  <div class="noprint" style="margin-top:20px"><button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer">🖨️ Print / Save as PDF</button></div>
</body></html>`;
}

// ─── Receipt modal ───────────────────────────────────────────────────
function HaulageReceiptModal({ entry, user, onClose, onSigned }) {
  const p = entry || {};
  const [recipientName, setRecipientName] = useState(p.recipientName || '');
  const [recipientEmail, setRecipientEmail] = useState(p.recipientEmail || '');
  const [driverSig, setDriverSig] = useState((p.signatures && p.signatures.driver) || null);
  const [recipientSig, setRecipientSig] = useState((p.signatures && p.signatures.recipient) || null);
  const receiptNo = useRef(p.receiptNo || ('R-' + Date.now().toString(36).toUpperCase())).current;

  const pushSigned = () => {
    onSigned && onSigned({
      receiptNo,
      recipientName,
      recipientEmail,
      signatures: { driver: driverSig, recipient: recipientSig },
      signedAt: new Date().toISOString(),
    });
  };

  const openPrintable = () => {
    pushSigned();
    const html = buildPrintableReceipt(p, {
      receiptNo, recipientName, driverSig, recipientSig,
      issuedBy: user && user.name,
    });
    const w = window.open('', '_blank');
    if (!w) { alert('Pop-up blocked — allow pop-ups to open the printable receipt.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const emailReceipt = () => {
    pushSigned();
    const subject = `CARBONCHIP Haulage Receipt ${receiptNo}`;
    const body = receiptTextBody(p, receiptNo, recipientName);
    const to = encodeURIComponent(recipientEmail || '');
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <Modal
      title="Delivery Receipt · Sign-off"
      onClose={() => { pushSigned(); onClose(); }}
      width={680}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => { pushSigned(); onClose(); }}>Close</button>
          <button className="btn" onClick={openPrintable}>🖨️ Print / Save PDF</button>
          <button className="btn btn-primary" onClick={emailReceipt}>📧 Email Receipt</button>
        </>
      }
    >
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
        Receipt <b>#{receiptNo}</b> — capture both signatures, then email or save a PDF copy.
      </div>

      {/* Receipt summary */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        {receiptRows(p).map(([k, v], i) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, padding: '6px 10px', fontSize: 12, background: i % 2 ? 'var(--surface-2)' : 'var(--surface)' }}>
            <span style={{ color: 'var(--text-dim)' }}>{k}</span>
            <span style={{ color: 'var(--text)' }}>{v}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-2">
        <Field label="Recipient name" hint="Person signing for delivery">
          <input className="input" type="text" value={recipientName} placeholder="e.g. Site Foreman" onChange={e => setRecipientName(e.target.value)} />
        </Field>
        <Field label="Recipient email" hint="Receipt is emailed here">
          <input className="input" type="email" inputMode="email" value={recipientEmail} placeholder="name@company.com" onChange={e => setRecipientEmail(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-2" style={{ marginTop: 6 }}>
        <Field label={`Driver signature${p.driver ? ' — ' + p.driver : ''}`}>
          <SignatureField who={p.driver} value={driverSig} onChange={setDriverSig} />
        </Field>
        <Field label="Recipient signature">
          <SignatureField who={recipientName} value={recipientSig} onChange={setRecipientSig} />
        </Field>
      </div>
    </Modal>
  );
}

Object.assign(window, { SignaturePad, SignatureField, SignatureCaptureOverlay, HaulageReceiptModal });
