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

function firstMatch(regex, text) {
  const match = text.match(regex);
  return match ? match[1] : '';
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

async function lookupWalmart(query, fallback) {
  const url = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PBM-PriceTracker/1.0)'
    }
  });

  if (!response.ok) {
    throw new Error('Walmart lookup failed');
  }

  const html = await response.text();

  const priceText = firstMatch(/"priceString":"\\$([0-9.,]+)"/, html);
  const itemName = decodeEscaped(firstMatch(/"name":"([^\"]{3,160})"/, html)) || fallback;
  const canonicalPath = decodeEscaped(firstMatch(/"canonicalUrl":"([^\"]+)"/, html));
  const productUrl = canonicalPath
    ? (canonicalPath.startsWith('http') ? canonicalPath : `https://www.walmart.com${canonicalPath}`)
    : '';

  const parsedPrice = Number(String(priceText || '').replace(/,/g, ''));
  return {
    currentPrice: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : null,
    productName: itemName,
    productUrl,
    currency: 'USD',
    lastCheckedAt: new Date().toISOString()
  };
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
        const lookup = await lookupWalmart(item.query, item.query);
        return {
          ...item,
          ...lookup
        };
      } catch {
        return {
          ...item,
          lastCheckedAt: new Date().toISOString()
        };
      }
    }));

    return json(200, { ok: true, items: updatedItems });
  } catch (error) {
    console.error('walmart-prices error', error);
    return json(500, { ok: false, message: 'Unable to refresh Walmart prices.' });
  }
};
