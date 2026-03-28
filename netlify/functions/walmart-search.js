const { getBearerToken, verifyToken } = require('./_lib/auth');
const { json, optionsResponse } = require('./_lib/http');

function getAuthorizedEmail(event) {
  const authSecret = process.env.APP_AUTH_SECRET;
  const ownerEmail = process.env.APP_OWNER_EMAIL;
  if (!authSecret || !ownerEmail) {
    return { ok: false, status: 500, message: 'Missing APP_OWNER_EMAIL or APP_AUTH_SECRET.' };
  }

  const token = getBearerToken(event);
  const result = verifyToken(token, authSecret);
  if (!result.valid) {
    return { ok: false, status: 401, message: 'Unauthorized.' };
  }

  const tokenEmail = String(result.payload.email || '').toLowerCase();
  if (tokenEmail !== ownerEmail.toLowerCase()) {
    return { ok: false, status: 403, message: 'Forbidden.' };
  }

  return { ok: true, email: ownerEmail.toLowerCase() };
}

function decodeEscaped(value) {
  if (!value) {
    return '';
  }
  return value
    .replace(/\\u002F/g, '/')
    .replace(/\\u003C/g, '<')
    .replace(/\\u003E/g, '>')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .trim();
}

function parsePrice(priceText) {
  const cleaned = String(priceText || '').replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function extractCandidates(html) {
  const results = [];
  const regex = /"name":"([^\"]{3,220})"[\s\S]{0,220}?"priceString":"\\$([0-9.,]+)"[\s\S]{0,220}?"canonicalUrl":"([^\"]+)"/g;
  let match;

  while ((match = regex.exec(html)) && results.length < 12) {
    const productName = decodeEscaped(match[1]);
    const price = parsePrice(match[2]);
    const canonicalPath = decodeEscaped(match[3]);
    if (!productName) {
      continue;
    }

    const productUrl = canonicalPath
      ? (canonicalPath.startsWith('http') ? canonicalPath : `https://www.walmart.com${canonicalPath}`)
      : '';

    if (!results.find(item => item.productName === productName)) {
      results.push({ productName, price, productUrl });
    }
  }

  return results;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, message: 'Method not allowed.' });
  }

  const auth = getAuthorizedEmail(event);
  if (!auth.ok) {
    return json(auth.status, { ok: false, message: auth.message });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, message: 'Invalid JSON body.' });
  }

  const query = String(body.query || '').trim();
  if (query.length < 2) {
    return json(200, { ok: true, items: [] });
  }

  try {
    const url = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PBM-WalmartSearch/1.0)'
      }
    });

    if (!response.ok) {
      return json(200, { ok: true, items: [] });
    }

    const html = await response.text();
    const items = extractCandidates(html);
    return json(200, { ok: true, items });
  } catch (error) {
    console.error('walmart-search error', error);
    return json(500, { ok: false, message: 'Unable to fetch Walmart suggestions.' });
  }
};
