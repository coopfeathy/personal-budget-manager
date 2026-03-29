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
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin'
};

function parsePrice(value) {
  const parsed = Number(String(value || '').replace(/[$,]/g, '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function decodeEscaped(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace(/\\u002F/g, '/')
    .replace(/\\u003A/g, ':')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003D/g, '=')
    .replace(/\\u003F/g, '?')
    .replace(/\\u002D/g, '-')
    .replace(/\\u0025/g, '%')
    .replace(/\\"/g, '"')
    .trim();
}

function buildProductUrl(canonicalUrl, storeId) {
  const baseUrl = canonicalUrl.startsWith('http') ? canonicalUrl : `https://www.walmart.com${canonicalUrl}`;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}storeId=${encodeURIComponent(storeId)}`;
}

function extractCandidatesFromNextData(html, storeId) {
  const strictResults = [];
  const looseResults = [];
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    return [];
  }

  try {
    const data = JSON.parse(match[1]);
    const stacks = data?.props?.pageProps?.initialData?.searchResult?.itemStacks;
    if (!Array.isArray(stacks)) {
      return [];
    }

    for (const stack of stacks) {
      for (const entry of stack.items || []) {
        if (strictResults.length >= 12 || looseResults.length >= 12) {
          return strictResults.length ? strictResults : looseResults;
        }

        const product = entry?.item?.product;
        if (!product?.name || !product?.canonicalUrl) {
          continue;
        }

        const productStoreId = String(product?.storeId || product?.fulfillmentSummary?.[0]?.storeId || storeId || '');

        const productName = String(product.name).trim();
        const price = parsePrice(
          product?.priceInfo?.currentPrice?.price
          || product?.priceInfo?.currentPrice?.priceString
          || product?.primaryOffer?.offerPrice
        );
        const productUrl = buildProductUrl(String(product.canonicalUrl), storeId);

        if (productName.length < 3) {
          continue;
        }

        const target = storeId && productStoreId === storeId ? strictResults : looseResults;
        if (!target.find(item => item.productName === productName)) {
          target.push({ productName, price, productUrl });
        }
      }
    }
  } catch (error) {
    console.error('walmart-search next-data parse error', error);
  }

  return strictResults.length ? strictResults : looseResults;
}

function extractCandidatesFallback(html, storeId) {
  const strictResults = [];
  const looseResults = [];
  const regex = /"name":"([^"]{3,220})"[\s\S]{0,320}?"priceString":"\\?\$?([0-9.,]+)"[\s\S]{0,320}?"canonicalUrl":"([^"]+)"[\s\S]{0,180}?"storeId":"?(\d+)"?/g;
  let match;

  while ((match = regex.exec(html)) && strictResults.length < 12 && looseResults.length < 12) {
    const productStoreId = String(match[4] || '');

    const productName = decodeEscaped(match[1]);
    const price = parsePrice(match[2]);
    const canonicalUrl = decodeEscaped(match[3]);
    const productUrl = buildProductUrl(canonicalUrl, storeId);

    const target = storeId && productStoreId === storeId ? strictResults : looseResults;
    if (productName && !target.find(item => item.productName === productName)) {
      target.push({ productName, price, productUrl });
    }
  }

  return strictResults.length ? strictResults : looseResults;
}

function extractEffectiveStoreId(html) {
  const fromCookie = html.match(/assortmentStoreId(?:%2B|\+)\s*(\d{3,6})/);
  if (fromCookie?.[1]) {
    return fromCookie[1];
  }
  const fromStoreField = html.match(/"storeId":"?(\d{3,6})"?/);
  if (fromStoreField?.[1]) {
    return fromStoreField[1];
  }
  return '';
}

function buildSearchUrl(query, storeId) {
  return `https://www.walmart.com/search?q=${encodeURIComponent(query)}&storeId=${encodeURIComponent(storeId)}`;
}

function buildFallbackSuggestion(query, storeId) {
  const cleaned = String(query || '').trim();
  const pretty = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return {
    productName: `${pretty} (similar Walmart results)`,
    price: null,
    productUrl: buildSearchUrl(cleaned, storeId)
  };
}

async function fetchAndParse(query, storeId) {
  const url = buildSearchUrl(query, storeId);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...WALMART_HEADERS,
      Cookie: `xptc=assortmentStoreId%2B${encodeURIComponent(storeId)}`,
      Referer: `https://www.walmart.com/store/${encodeURIComponent(storeId)}`
    }
  });

  if (!response.ok) {
    return { items: [], resolvedStoreId: storeId };
  }

  const html = await response.text();
  const resolvedStoreId = extractEffectiveStoreId(html) || storeId;
  const fromNextData = extractCandidatesFromNextData(html, storeId);
  const items = fromNextData.length ? fromNextData : extractCandidatesFallback(html, storeId);
  return { items, resolvedStoreId };
}

async function searchLocalWalmart(query, storeId) {
  const primary = await fetchAndParse(query, storeId);
  if (primary.items.length) {
    return primary;
  }

  // Broad terms can be sparse in parsed payloads; retry with common retail intent suffixes.
  const q = String(query || '').trim();
  const retryQueries = [`${q} furniture`, `${q} desk`, `${q} set`];
  for (const retryQuery of retryQueries) {
    const retried = await fetchAndParse(retryQuery, storeId);
    if (retried.items.length) {
      return retried;
    }
  }

  return {
    items: [buildFallbackSuggestion(q, storeId)],
    resolvedStoreId: primary.resolvedStoreId || storeId
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

  const query = String(body.query || '').trim();
  const storeId = String(body.storeId || '').trim();

  if (!/^\d{3,6}$/.test(storeId)) {
    return json(400, { ok: false, message: 'Enter a valid Walmart store ID first.' });
  }

  if (query.length < 2) {
    return json(200, { ok: true, items: [] });
  }

  try {
    const { items, resolvedStoreId } = await searchLocalWalmart(query, storeId);
    return json(200, { ok: true, items, resolvedStoreId });
  } catch (error) {
    console.error('walmart-search error', error);
    return json(500, { ok: false, message: 'Unable to search your local Walmart right now.' });
  }
};
