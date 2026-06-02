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
  const [hasInk, setHasInk] = useState(!!value);

  // Size the canvas to its rendered box at the device pixel ratio so the
  // signature is crisp on phones/tablets.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b3b2e';
    ctxRef.current = ctx;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches && e.touches[0] ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };
  const end = (e) => {
    if (!drawing.current) return;
    e && e.preventDefault();
    drawing.current = false;
    if (hasInk) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    ctxRef.current.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ position: 'relative', border: '1px solid var(--border-bright)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height, display: 'block', touchAction: 'none', cursor: 'crosshair' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
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
          <SignaturePad value={driverSig} onChange={setDriverSig} />
        </Field>
        <Field label="Recipient signature">
          <SignaturePad value={recipientSig} onChange={setRecipientSig} />
        </Field>
      </div>
    </Modal>
  );
}

Object.assign(window, { SignaturePad, HaulageReceiptModal });
