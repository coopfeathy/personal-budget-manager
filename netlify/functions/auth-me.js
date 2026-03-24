const { getBearerToken, verifyToken } = require('./_lib/auth');
const { json, optionsResponse } = require('./_lib/http');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { ok: false, message: 'Method not allowed' });
  }

  const authSecret = process.env.APP_AUTH_SECRET;
  const ownerEmail = process.env.APP_OWNER_EMAIL;
  if (!authSecret || !ownerEmail) {
    return json(500, { ok: false, message: 'Missing auth environment variables.' });
  }

  const token = getBearerToken(event);
  const result = verifyToken(token, authSecret);

  if (!result.valid || result.payload.email?.toLowerCase() !== ownerEmail.toLowerCase()) {
    return json(401, { ok: false, message: 'Unauthorized.' });
  }

  return json(200, {
    ok: true,
    email: result.payload.email,
    role: result.payload.role,
    expiresAt: result.payload.exp
  });
};
