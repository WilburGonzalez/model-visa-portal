// Netlify function that proxies the front-end's Airtable requests.
// The browser never sees the Airtable key — it lives in env vars here.

const KEY = process.env.AIRTABLE_KEY;
const BASE = process.env.AIRTABLE_BASE;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!KEY || !BASE) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server missing AIRTABLE_KEY or AIRTABLE_BASE' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { action } = payload;
  const authHeader = { Authorization: `Bearer ${KEY}` };

  try {
    if (action === 'get') {
      const { table, formula } = payload;
      let url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`;
      if (formula) {
        url += `?filterByFormula=${encodeURIComponent(formula)}`;
      }
      const resp = await fetch(url, { headers: authHeader });
      const data = await resp.json();
      // Front-end's airtableGet expects { records: [...] } and returns .records
      return { statusCode: resp.status, body: JSON.stringify(data) };
    }

    if (action === 'create') {
      const { table, fields } = payload;
      const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      const data = await resp.json();
      return { statusCode: resp.status, body: JSON.stringify(data) };
    }

    if (action === 'upload') {
      const { recordId, contentType, file, filename } = payload;
      const url = `https://content.airtable.com/v0/${BASE}/${recordId}/File%20Attachment/uploadAttachment`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, file, filename })
      });
      const data = await resp.json();
      return { statusCode: resp.status, body: JSON.stringify(data) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Airtable request failed', detail: String(err) }) };
  }
};
