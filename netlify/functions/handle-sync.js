const { query } = require('./_lib/db');

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
}

// Placeholder sync handler for Netlify + Neon.
// This is where Plaid token exchange + transaction sync should run server-side.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  try {
    // Simple health query verifies Neon credentials from Netlify env vars.
    const dbResult = await query('select now() as server_time');

    return json(200, {
      ok: true,
      provider: 'neon-postgres',
      serverTime: dbResult.rows[0].server_time
    });
  } catch (error) {
    console.error('handle-sync error', error);
    return json(500, {
      ok: false,
      message: 'Failed to run sync. Check Netlify database environment variables.',
      error: error.message
    });
  }
};
