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

function getChainConfig(chain) {
  const map = {
    bitcoin: { path: 'btc/main', unit: 'BTC', divisor: 1e8 },
    ethereum: { path: 'eth/main', unit: 'ETH', divisor: 1e18 },
    litecoin: { path: 'ltc/main', unit: 'LTC', divisor: 1e8 },
    dogecoin: { path: 'doge/main', unit: 'DOGE', divisor: 1e8 }
  };
  return map[chain] || null;
}

async function fetchWallet(chain, address) {
  const config = getChainConfig(chain);
  if (!config) {
    return { balance: 0, txCount: 0, unit: 'N/A' };
  }

  const url = `https://api.blockcypher.com/v1/${config.path}/addrs/${encodeURIComponent(address)}/balance`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Wallet API error for ${chain}`);
  }

  const payload = await response.json();
  const rawBalance = Number(payload.final_balance || 0);
  const txCount = Number(payload.n_tx || 0);
  return {
    balance: rawBalance / config.divisor,
    txCount,
    unit: config.unit
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

  const wallets = Array.isArray(body.wallets) ? body.wallets : [];
  if (!wallets.length) {
    return json(200, { ok: true, results: [] });
  }

  try {
    const results = await Promise.all(wallets.map(async (wallet) => {
      try {
        const stats = await fetchWallet(wallet.chain, wallet.address);
        return {
          id: wallet.id,
          ...stats,
          syncedAt: new Date().toISOString()
        };
      } catch {
        return {
          id: wallet.id,
          balance: Number(wallet.balance || 0),
          txCount: Number(wallet.txCount || 0),
          unit: String(wallet.unit || '').toUpperCase() || 'N/A',
          syncedAt: new Date().toISOString()
        };
      }
    }));

    return json(200, { ok: true, results });
  } catch (error) {
    console.error('wallet-track error', error);
    return json(500, { ok: false, message: 'Unable to sync wallet trackers.' });
  }
};
