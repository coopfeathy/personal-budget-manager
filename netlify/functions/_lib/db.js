const { Pool } = require('pg');

let pool;

function getDatabaseUrl() {
  return process.env.NETLIFY_DATABASE_URL_UNPOOLED || process.env.NETLIFY_DATABASE_URL;
}

function getPool() {
  if (!pool) {
    const connectionString = getDatabaseUrl();

    if (!connectionString) {
      throw new Error('Missing NETLIFY_DATABASE_URL_UNPOOLED or NETLIFY_DATABASE_URL');
    }

    pool = new Pool({
      connectionString,
      // Neon + Netlify commonly require TLS; allow explicit override for local development.
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
    });
  }

  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

module.exports = {
  query,
  getPool
};
