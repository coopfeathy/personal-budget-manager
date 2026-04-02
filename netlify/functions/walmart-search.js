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
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1'
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

function collectCandidate(results, productName, price, canonicalUrl, storeId) {
  const cleanedName = String(productName || '').trim();
  const cleanedUrl = String(canonicalUrl || '').trim();

  if (cleanedName.length < 3 || !cleanedUrl || !cleanedUrl.includes('/ip/')) {
    return;
  }

  if (price === null) {
    return;
  }

  if (results.find(item => item.productName === cleanedName)) {
    return;
  }

  results.push({
    productName: cleanedName,
    price,
    productUrl: buildProductUrl(cleanedUrl, storeId)
  });
}

function extractPriceFromObject(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return parsePrice(
    value?.priceInfo?.currentPrice?.price
    || value?.priceInfo?.currentPrice?.priceString
    || value?.currentPrice?.price
    || value?.currentPrice?.priceString
    || value?.secondaryOfferPrice?.currentPrice?.price
    || value?.secondaryOfferPrice?.currentPrice?.priceString
    || value?.primaryOffer?.offerPrice
    || value?.price
    || value?.priceString
  );
}

function extractCandidatesDeep(data, storeId) {
  const results = [];
  const queue = [data];

  while (queue.length && results.length < 12) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    const candidateName = current.name || current.productName || current.title;
    const candidateUrl = current.canonicalUrl || current.productPageUrl || current.usItemId && `/ip/${current.usItemId}`;
    const candidatePrice = extractPriceFromObject(current)
      || extractPriceFromObject(current.product)
      || extractPriceFromObject(current.item)
      || extractPriceFromObject(current.item?.product);

    if (candidateName && candidateUrl) {
      collectCandidate(results, candidateName, candidatePrice, candidateUrl, storeId);
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return results;
}

function extractCandidatesFromNextData(html, storeId) {
  const results = [];
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    console.log('walmart-search: no __NEXT_DATA__ found in response');
    return [];
  }

  try {
    const data = JSON.parse(match[1]);
    const deepResults = extractCandidatesDeep(data, storeId);
    if (deepResults.length) {
      console.log(`walmart-search: deep scan found ${deepResults.length} real products`);
      return deepResults;
    }
    
    // Try multiple possible paths in the data structure
    let stacks = data?.props?.pageProps?.initialData?.searchResult?.itemStacks;
    if (!Array.isArray(stacks)) {
      // Try alternative path
      stacks = data?.props?.pageProps?.searchResult?.itemStacks;
    }
    if (!Array.isArray(stacks)) {
      // Try another alternative path
      stacks = data?.props?.initialData?.itemStacks;
    }
    
    if (!Array.isArray(stacks)) {
      console.log('walmart-search: itemStacks not found in expected paths');
      return [];
    }

    console.log(`walmart-search: found ${stacks.length} stacks in response`);
    let itemsProcessed = 0;

    for (const stack of stacks) {
      for (const entry of stack.items || []) {
        itemsProcessed++;
        if (results.length >= 12) {
          console.log(`walmart-search: reached result limit of 12`);
          return results;
        }

        const product = entry?.item?.product;
        if (!product?.name || !product?.canonicalUrl) {
          continue;
        }

        const productName = String(product.name).trim();
        const price = extractPriceFromObject(product);
        collectCandidate(results, productName, price, String(product.canonicalUrl), storeId);
      }
    }

    console.log(`walmart-search next-data: processed ${itemsProcessed} items, captured ${results.length} unique products`);
  } catch (error) {
    console.error('walmart-search next-data parse error', error);
  }

  return results;
}

function extractCandidatesFallback(html, storeId) {
  const looseResults = [];
  
  // Primary regex pattern - look for name, price, and URL
  // Note: storeId is often not present in the HTML, so we don't require it
  const regex = /"name":"([^"]{3,220})"[\s\S]{0,500}?"priceString":"\\?\$?([0-9.,]+)"[\s\S]{0,300}?"canonicalUrl":"([^"]+)"/g;
  let match;
  let regexMatches = 0;

  while ((match = regex.exec(html)) && looseResults.length < 12) {
    regexMatches++;

    const productName = decodeEscaped(match[1]);
    const price = parsePrice(match[2]);
    const canonicalUrl = decodeEscaped(match[3]);
    const productUrl = buildProductUrl(canonicalUrl, storeId);

    if (!productName) {
      continue;
    }

    collectCandidate(looseResults, productName, price, canonicalUrl, storeId);
  }

  console.log(`walmart-search fallback: matched ${regexMatches} items via primary regex, captured ${looseResults.length} unique products`);

  // Secondary fallback: if we still have nothing, try an even more lenient pattern
  if (looseResults.length === 0) {
    console.log('walmart-search fallback: primary regex failed, trying very lenient patterns');
    
    // Ultra-lenient: just look for any name and URL combination
    const ultraRegex = /"name":"([^"]{3,220})"[\s\S]{0,800}?"canonicalUrl":"(\/ip\/[^"]+)"/g;
    let ultraMatch;
    let ultraMatches = 0;
    
    while ((ultraMatch = ultraRegex.exec(html)) && looseResults.length < 12) {
      ultraMatches++;
      const productName = decodeEscaped(ultraMatch[1]);
      const canonicalUrl = decodeEscaped(ultraMatch[2]);
      const productUrl = buildProductUrl(canonicalUrl, storeId);

      collectCandidate(looseResults, productName, null, canonicalUrl, storeId);
    }
    
    if (ultraMatches > 0) {
      console.log(`walmart-search fallback: ultra-lenient regex matched ${ultraMatches} items, captured ${looseResults.length}`);
    }
  }

  // Tertiary fallback: scan for all /ip/ URLs and extract any strings near them as product names
  if (looseResults.length === 0) {
    console.log('walmart-search fallback: lenient regex failed, trying URL-based extraction');
    
    const ipUrlRegex = /"canonicalUrl":"(\/ip\/[^"]+)"/g;
    let ipMatch;
    let ipUrlCount = 0;
    
    while ((ipMatch = ipUrlRegex.exec(html)) && looseResults.length < 12) {
      ipUrlCount++;
      const canonicalUrl = decodeEscaped(ipMatch[1]);
      const productUrl = buildProductUrl(canonicalUrl, storeId);
      
      // Try to find product name near this URL by looking backwards in the HTML
      const beforeUrl = html.substring(Math.max(0, ipMatch.index - 500), ipMatch.index);
      const nameMatch = beforeUrl.match(/"name":"([^"]{3,220})"\s*(?:[\s\S]{0,150})?$/);
      
      if (nameMatch && nameMatch[1]) {
        const productName = decodeEscaped(nameMatch[1]);
        collectCandidate(looseResults, productName, null, canonicalUrl, storeId);
      }
    }
    
    if (ipUrlCount > 0) {
      console.log(`walmart-search fallback: found ${ipUrlCount} product URLs, extracted ${looseResults.length} names`);
    }
  }

  return looseResults;
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

async function fetchAndParse(query, storeId) {
  const url = buildSearchUrl(query, storeId);
  console.log(`walmart-search: fetching '${query}' for store ${storeId} from ${url}`);
  
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
    console.log(`walmart-search: response not ok (${response.status}), treating as empty`);
    return { items: [], resolvedStoreId: storeId };
  }

  const html = await response.text();
  const htmlSize = html.length;
  console.log(`walmart-search: received ${htmlSize} bytes`);
  
  // Check if response has meaningful content
  if (htmlSize < 5000) {
    console.log(`walmart-search: WARNING - response is very small (${htmlSize} bytes), likely not a real search result page`);
  }
  
  // Detailed content detection
  const hasNextData = html.includes('__NEXT_DATA__');
  const hasProductName = html.includes('"name":"');
  const hasCanonicalUrl = html.includes('"canonicalUrl":"');
  const hasPrice = html.includes('"priceString"') || html.includes('"price"');
  const hasProductPattern = html.includes('"item":{"product":');
  
  console.log(`walmart-search: response analysis - nextData=${hasNextData}, productName=${hasProductName}, canonicalUrl=${hasCanonicalUrl}, price=${hasPrice}, productPattern=${hasProductPattern}`);
  
  // Log a sample of the response to help debug
  if (htmlSize > 0) {
    const sample = html.substring(0, 500);
    console.log(`walmart-search: response starts with: ${sample.substring(0, 200)}`);
  }
  
  const resolvedStoreId = extractEffectiveStoreId(html) || storeId;
  console.log(`walmart-search: resolved store ID to ${resolvedStoreId}`);
  
  const fromNextData = extractCandidatesFromNextData(html, storeId);
  console.log(`walmart-search: extracted ${fromNextData.length} items from __NEXT_DATA__`);
  
  const items = fromNextData.length ? fromNextData : extractCandidatesFallback(html, storeId);
  console.log(`walmart-search: final result: ${items.length} items${items.length > 0 ? ': ' + items.map(i => i.productName).join(', ').substring(0, 100) : ''}`);
  
  return { items, resolvedStoreId };
}

async function searchLocalWalmart(query, storeId) {
  console.log(`walmart-search: starting search for '${query}' at store ${storeId}`);
  
  const primary = await fetchAndParse(query, storeId);
  console.log(`walmart-search: primary search finished with ${primary.items.length} real products`);
  return primary;
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
