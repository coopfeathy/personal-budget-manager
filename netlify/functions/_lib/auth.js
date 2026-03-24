const crypto = require('crypto');

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function signHmac(data, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signToken(payload, secret, expiresInSeconds = 60 * 60 * 12) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const bodyB64 = base64UrlEncode(JSON.stringify(body));
  const signature = signHmac(`${headerB64}.${bodyB64}`, secret);

  return `${headerB64}.${bodyB64}.${signature}`;
}

function verifyToken(token, secret) {
  if (!token || !secret) {
    return { valid: false, reason: 'missing-token-or-secret' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'invalid-token-format' };
  }

  const [headerB64, bodyB64, signature] = parts;
  const expectedSignature = signHmac(`${headerB64}.${bodyB64}`, secret);

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return { valid: false, reason: 'invalid-signature' };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(bodyB64));
  } catch {
    return { valid: false, reason: 'invalid-payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || now > payload.exp) {
    return { valid: false, reason: 'expired-token' };
  }

  return { valid: true, payload };
}

function getBearerToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7).trim();
}

module.exports = {
  signToken,
  verifyToken,
  getBearerToken
};
