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

const WALMART_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none'
};

function parsePrice(value) {
  const n = Number(String(value || '').replace(/[$,]/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildUrl(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : `https://www.walmart.com${path}`;
}

function extractFirstFromNextData(html) {
  try {
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    const data = JSON.parse(m[1]);
    const stacks = data?.props?.pageProps?.initialData?.searchResult?.itemStacks;
    if (!Array.isArray(stacks)) return null;
    for (const stack of stacks) {
      for (const entry of (stack.items || [])) {
        const p = entry?.item?.product;
        if (!p) continue;
        const name = String(p.name || '').trim();
        const price = parsePrice(p.primaryOffer?.offerPrice);
        const url = buildUrl(p.canonicalUrl);
        if (name.length >= 3) {
          return { currentPrice: price, productName: name, productUrl: url, currency: 'USD', lastCheckedAt: new Date().toISOString() };
        }
      }
    }
  } catch (_) { /* fallthrough */ }
  return null;
}

function extractFirstFallback(html, fallbackName) {
  const nameMatch = html.match(/"name":"([^"]{3,160})"/);
  const priceMatch = html.match(/"(?:offerPrice|priceString)":"?\$?([0-9.,]+)"?/);
  const urlMatch = html.match(/"canonicalUrl":"([^"]+)"/);

  const name = nameMatch
    ? nameMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, c => String.fromCharCode(parseInt(c.slice(2), 16))).trim()
    : fallbackName;
  const price = parsePrice(priceMatch?.[1]);
  const url = buildUrl((urlMatch?.[1] || '').replace(/\\u002F/g, '/'));
  return { currentPrice: price, productName: name, productUrl: url, currency: 'USD', lastCheckedAt: new Date().toISOString() };
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

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) {
    return json(200, { ok: true, items: [] });
  }

  try {
    const updatedItems = await Promise.all(items.map(async (item) => {
      try {
        const searchUrl = `https://www.walmart.com/search?q=${encodeURIComponent(item.productName || item.query)}`;
        const res = await fetch(searchUrl, { method: 'GET', headers: WALMART_HEADERS });
        if (!res.ok) return { ...item, lastCheckedAt: new Date().toISOString() };
        const html = await res.text();
        const lookup = extractFirstFromNextData(html) || extractFirstFallback(html, item.productName || item.query);
        return { ...item, ...lookup };
      } catch {
        return { ...item, lastCheckedAt: new Date().toISOString() };
      }
    }));

    return json(200, { ok: true, items: updatedItems });
  } catch (error) {
    console.error('walmart-prices error', error);
    return json(500, { ok: false, message: 'Unable to refresh Walmart prices.' });
  }
};
