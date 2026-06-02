// Vercel serverless function. Proxies chat messages to Anthropic's
// Messages API so the API key stays on the server and never reaches
// the browser.
//
// Required env var: ANTHROPIC_API_KEY (set in Vercel → Settings → Env Vars)

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on the server. Add it in Vercel → Settings → Environment Variables and redeploy.' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const { messages, system, model, tools } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: '`messages` (non-empty array) is required' });
    return;
  }

  try {
    const payload = {
      model: model || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    };
    if (Array.isArray(tools) && tools.length) payload.tools = tools;

    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({
        error: (data && data.error && data.error.message) || 'Anthropic API error',
      });
      return;
    }

    // Return the full content array so the client can see tool_use blocks
    // and the text content together. Also include a flattened reply for
    // convenience when there are no tools in flight.
    const reply = (data.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    res.status(200).json({
      content: data.content || [],
      reply,
      model: data.model,
      stopReason: data.stop_reason,
      usage: data.usage,
    });
  } catch (e) {
    res.status(500).json({ error: 'Upstream request failed: ' + (e.message || 'unknown') });
  }
}
