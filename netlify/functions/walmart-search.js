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

// Uses Open Food Facts — free, no API key, millions of grocery products
async function searchOpenFoodFacts(query) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=12&action=process&fields=product_name,brands,code`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'PersonalBudgetManager/1.0' }
  });
  if (!response.ok) return [];
  const data = await response.json();
  const products = Array.isArray(data.products) ? data.products : [];
  return products
    .filter(p => p.product_name && String(p.product_name).trim().length >= 2)
    .slice(0, 12)
    .map(p => {
      const brand = String(p.brands || '').split(',')[0].trim();
      const name = String(p.product_name).trim();
      const displayName = brand && !name.toLowerCase().includes(brand.toLowerCase())
        ? `${brand} ${name}`
        : name;
      return {
        productName: displayName,
        price: null,
        productUrl: p.code ? `https://world.openfoodfacts.org/product/${p.code}` : ''
      };
    });
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
    const items = await searchOpenFoodFacts(query);
    return json(200, { ok: true, items });
  } catch (error) {
    console.error('grocery-search error', error);
    return json(500, { ok: false, message: 'Unable to fetch product suggestions.' });
  }
};
