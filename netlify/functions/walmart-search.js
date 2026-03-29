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
    console.log('walmart-search: no __NEXT_DATA__ found in response');
    return [];
  }

  try {
    const data = JSON.parse(match[1]);
    const stacks = data?.props?.pageProps?.initialData?.searchResult?.itemStacks;
    if (!Array.isArray(stacks)) {
      console.log('walmart-search: itemStacks not found or not array', { stacksExists: !!data?.props?.pageProps?.initialData?.searchResult });
      return [];
    }

    console.log(`walmart-search: found ${stacks.length} stacks in response`);
    let itemsProcessed = 0;

    for (const stack of stacks) {
      for (const entry of stack.items || []) {
        itemsProcessed++;
        if (strictResults.length >= 12 || looseResults.length >= 12) {
          console.log(`walmart-search: reached result limit. strict=${strictResults.length}, loose=${looseResults.length}`);
          return strictResults.length ? strictResults : looseResults;
        }

        const product = entry?.item?.product;
        if (!product?.name || !product?.canonicalUrl) {
          continue;
        }

        const productStoreId = String(product?.storeId || product?.fulfillmentSummary?.[0]?.storeId || '');
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

        // Prefer exact store match, but accept unmatched results if no strict matches yet
        if (productStoreId && storeId && productStoreId === storeId) {
          if (!strictResults.find(item => item.productName === productName)) {
            strictResults.push({ productName, price, productUrl });
          }
        } else {
          if (!looseResults.find(item => item.productName === productName)) {
            looseResults.push({ productName, price, productUrl });
          }
        }
      }
    }

    console.log(`walmart-search: processed ${itemsProcessed} items. strict=${strictResults.length}, loose=${looseResults.length}`);
  } catch (error) {
    console.error('walmart-search next-data parse error', error);
  }

  return strictResults.length ? strictResults : looseResults;
}

function extractCandidatesFallback(html, storeId) {
  const strictResults = [];
  const looseResults = [];
  
  // Primary regex pattern for standard product entries
  const regex = /"name":"([^"]{3,220})"[\s\S]{0,320}?"priceString":"\\?\$?([0-9.,]+)"[\s\S]{0,320}?"canonicalUrl":"([^"]+)"[\s\S]{0,180}?"storeId":"?(\d+)"?/g;
  let match;
  let regexMatches = 0;

  while ((match = regex.exec(html)) && strictResults.length < 12 && looseResults.length < 12) {
    regexMatches++;
    const productStoreId = String(match[4] || '');

    const productName = decodeEscaped(match[1]);
    const price = parsePrice(match[2]);
    const canonicalUrl = decodeEscaped(match[3]);
    const productUrl = buildProductUrl(canonicalUrl, storeId);

    if (!productName) {
      continue;
    }

    // Prefer exact store match, but accept unmatched results if no strict matches yet
    if (productStoreId && storeId && productStoreId === storeId) {
      if (!strictResults.find(item => item.productName === productName)) {
        strictResults.push({ productName, price, productUrl });
      }
    } else {
      if (!looseResults.find(item => item.productName === productName)) {
        looseResults.push({ productName, price, productUrl });
      }
    }
  }

  console.log(`walmart-search fallback: matched ${regexMatches} items via primary regex. strict=${strictResults.length}, loose=${looseResults.length}`);

  // Secondary fallback: look for product patterns even without storeId
  if (strictResults.length === 0 && looseResults.length === 0) {
    console.log('walmart-search fallback: primary regex failed, trying secondary patterns');
    
    // Try finding products with more lenient patterns
    const altRegex = /"canonicalUrl":"([^"]+)"[\s\S]{0,200}?"name":"([^"]{3,220})"[\s\S]{0,200}?"priceString":"\\?\$?([0-9.,]+)?"/g;
    let altMatch;
    let altMatches = 0;
    
    while ((altMatch = altRegex.exec(html)) && looseResults.length < 12) {
      altMatches++;
      const canonicalUrl = decodeEscaped(altMatch[1]);
      const productName = decodeEscaped(altMatch[2]);
      const price = parsePrice(altMatch[3]);
      const productUrl = buildProductUrl(canonicalUrl, storeId);

      if (productName && !looseResults.find(item => item.productName === productName)) {
        looseResults.push({ productName, price, productUrl });
      }
    }
    
    if (altMatches > 0) {
      console.log(`walmart-search fallback: secondary regex matched ${altMatches} items, captured ${looseResults.length}`);
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
  console.log(`walmart-search: fetching '${query}' for store ${storeId}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...WALMART_HEADERS,
      Cookie: `xptc=assortmentStoreId%2B${encodeURIComponent(storeId)}`,
      Referer: `https://www.walmart.com/store/${encodeURIComponent(storeId)}`
    }
  });

  console.log(`walmart-search: got response status ${response.status}`);

  if (!response.ok) {
    console.log(`walmart-search: response not ok, treating as empty`);
    return { items: [], resolvedStoreId: storeId };
  }

  const html = await response.text();
  console.log(`walmart-search: html size ${html.length} bytes`);
  
  const resolvedStoreId = extractEffectiveStoreId(html) || storeId;
  console.log(`walmart-search: resolved store ID to ${resolvedStoreId}`);
  
  const fromNextData = extractCandidatesFromNextData(html, storeId);
  console.log(`walmart-search: extracted ${fromNextData.length} items from __NEXT_DATA__`);
  
  const items = fromNextData.length ? fromNextData : extractCandidatesFallback(html, storeId);
  console.log(`walmart-search: final result: ${items.length} items`);
  
  return { items, resolvedStoreId };
}

async function searchLocalWalmart(query, storeId) {
  console.log(`walmart-search: starting search for '${query}' at store ${storeId}`);
  
  const primary = await fetchAndParse(query, storeId);
  
  if (primary.items.length) {
    console.log(`walmart-search: primary search succeeded with ${primary.items.length} items`);
    return primary;
  }

  // Broad terms can be sparse in parsed payloads; retry with common retail intent suffixes.
  console.log(`walmart-search: primary search returned no results, trying variants`);
  const q = String(query || '').trim();
  const retryQueries = [`${q} furniture`, `${q} desk`, `${q} set`];
  for (const retryQuery of retryQueries) {
    console.log(`walmart-search: retry attempt with '${retryQuery}'`);
    const retried = await fetchAndParse(retryQuery, storeId);
    if (retried.items.length) {
      console.log(`walmart-search: retry succeeded with ${retried.items.length} items`);
      return retried;
    }
  }

  console.log(`walmart-search: all attempts failed, returning fallback suggestion`);
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
