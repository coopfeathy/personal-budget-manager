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

function extractCandidatesFromNextData(html) {
  const results = [];
  try {
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return results;
    const data = JSON.parse(m[1]);
    const stacks = data?.props?.pageProps?.initialData?.searchResult?.itemStacks;
    if (!Array.isArray(stacks)) return results;
    for (const stack of stacks) {
      for (const entry of (stack.items || [])) {
        if (results.length >= 12) break;
        const p = entry?.item?.product;
        if (!p) continue;
        const name = String(p.name || '').trim();
        const price = parsePrice(p.primaryOffer?.offerPrice);
        const url = buildUrl(p.canonicalUrl);
        if (name.length >= 3 && !results.find(r => r.productName === name)) {
          results.push({ productName: name, price, productUrl: url });
        }
      }
      if (results.length >= 12) break;
    }
  } catch (_) { /* fallthrough */ }
  return results;
}

function extractCandidatesFallback(html) {
  const results = [];
  const regex = /"name":"([^"]{3,220})"[^}]{0,300}"(offerPrice|priceString)":"?\$?([0-9.,]+)"?[^}]{0,300}"canonicalUrl":"([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) && results.length < 12) {
    const name = match[1].replace(/\\u[\dA-Fa-f]{4}/g, c => String.fromCharCode(parseInt(c.slice(2), 16))).trim();
    const price = parsePrice(match[3]);
    const url = buildUrl(match[4].replace(/\\u002F/g, '/'));
    if (name && !results.find(r => r.productName === name)) {
      results.push({ productName: name, price, productUrl: url });
    }
  }
  return results;
}

function extractCandidates(html) {
  const fromNext = extractCandidatesFromNextData(html);
  return fromNext.length > 0 ? fromNext : extractCandidatesFallback(html);
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
      headers: WALMART_HEADERS
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
