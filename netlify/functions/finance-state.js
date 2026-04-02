const { query } = require('./_lib/db');
const { getBearerToken, verifyToken } = require('./_lib/auth');
const { json, optionsResponse } = require('./_lib/http');

async function ensureSchema() {
  await query(`
    create table if not exists personal_finance_state (
      owner_email text primary key,
      state_json jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);
}

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  const auth = getAuthorizedEmail(event);
  if (!auth.ok) {
    return json(auth.status, { ok: false, message: auth.message });
  }

  try {
    await ensureSchema();

    if (event.httpMethod === 'GET') {
      const result = await query(
        'select state_json, updated_at from personal_finance_state where owner_email = $1',
        [auth.email]
      );

      if (!result.rows.length) {
        return json(200, { ok: true, state: null, updatedAt: null });
      }

      return json(200, {
        ok: true,
        state: result.rows[0].state_json,
        updatedAt: result.rows[0].updated_at
      });
    }

    if (event.httpMethod === 'PUT') {
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return json(400, { ok: false, message: 'Invalid JSON body.' });
      }

      if (!body || typeof body.state !== 'object' || Array.isArray(body.state)) {
        return json(400, { ok: false, message: 'Request body must contain a state object.' });
      }

      await query(
        `
          insert into personal_finance_state (owner_email, state_json, updated_at)
          values ($1, $2::jsonb, now())
          on conflict (owner_email)
          do update set state_json = excluded.state_json, updated_at = now()
        `,
        [auth.email, JSON.stringify(body.state)]
      );

      return json(200, { ok: true, message: 'State saved.' });
    }

    return json(405, { ok: false, message: 'Method not allowed.' });
  } catch (error) {
    console.error('finance-state error', error);
    // On DB connectivity / module errors, return a graceful degraded response
    // so the client app continues to function without saved state.
    if (event.httpMethod === 'GET') {
      return json(200, {
        ok: true,
        state: null,
        updatedAt: null,
        degraded: true,
        message: 'State service temporarily unavailable.'
      });
    }
    return json(503, {
      ok: false,
      message: 'State service temporarily unavailable. Your changes were not saved.',
      error: error.message
    });
  }
};
