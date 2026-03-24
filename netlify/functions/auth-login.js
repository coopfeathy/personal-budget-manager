const crypto = require('crypto');
const { signToken } = require('./_lib/auth');
const { json, optionsResponse } = require('./_lib/http');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, message: 'Method not allowed' });
  }

  const ownerEmail = process.env.APP_OWNER_EMAIL;
  const ownerAccessCode = process.env.APP_ACCESS_CODE;
  const authSecret = process.env.APP_AUTH_SECRET;

  if (!ownerEmail || !ownerAccessCode || !authSecret) {
    return json(500, {
      ok: false,
      message: 'Missing APP_OWNER_EMAIL, APP_ACCESS_CODE, or APP_AUTH_SECRET in environment variables.'
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, message: 'Invalid JSON body.' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const accessCode = String(body.accessCode || '');

  const emailOk = email === ownerEmail.toLowerCase();
  const provided = Buffer.from(accessCode);
  const expected = Buffer.from(ownerAccessCode);
  const codeOk = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!emailOk || !codeOk) {
    return json(401, { ok: false, message: 'Invalid credentials.' });
  }

  const token = signToken({ email, role: 'owner' }, authSecret);
  return json(200, {
    ok: true,
    token,
    email
  });
};
