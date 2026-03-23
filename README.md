# Personal Budget Manager

Detailed personal finance application for tracking transactions, budgets, auto-payments, passive income, and crypto holdings.

## Features

- Unified financial dashboard with monthly cashflow and net worth snapshot
- Category-based budget planning and spend progress
- Auto-payment tracker with due-day management
- Passive income stream planning and expected payout tracking
- Crypto portfolio tracker with cost basis and profit/loss view
- Account and card connection center with production integration checklist

## Run Locally

### Frontend

```bash
cd client
npm install
npm start
```

### API (optional)

```bash
npm install
cp .env.example .env
# Fill NETLIFY_DATABASE_URL_UNPOOLED and CORS_ORIGIN values in .env
node server.js
```

### Netlify Function Local Test

```bash
npm install
netlify dev
# Test: POST http://localhost:8888/api/handle-sync
```

## Netlify Deployment

1. Push this repository to GitHub.
2. In Netlify, create a new site from this repository.
3. Netlify will use `netlify.toml` automatically:
   - Build base: `client`
   - Build command: `npm run build`
   - Publish directory: `dist/client/browser`
4. Add environment variables in Netlify Site Settings:
   - `NETLIFY_DATABASE_URL`
   - `NETLIFY_DATABASE_URL_UNPOOLED`
   - `PLAID_CLIENT_ID`
   - `PLAID_SECRET`
   - `PLAID_ENV`
5. If you deploy the API separately, set `CORS_ORIGIN` to your Netlify site URL.

## Card Connectivity in Production

For direct card/bank sync, use an aggregator provider such as Plaid. Keep credentials in environment variables and perform token exchange only in backend/serverless endpoints. Never expose provider secrets in Angular frontend code.

## Security Notes

- No database credentials are hardcoded in source files.
- Use environment variables for all secrets.
- Enable MFA for both exchange and banking accounts.

## Netlify + Neon Database Notes

- This project supports Netlify-managed Neon Postgres variables (`NETLIFY_DATABASE_URL` and `NETLIFY_DATABASE_URL_UNPOOLED`) for serverless persistence.
- Prefer `NETLIFY_DATABASE_URL_UNPOOLED` for Netlify Functions to reduce pooling-related connection issues in serverless environments.
- Keep all Plaid token exchange and sync logic in serverless functions only.
- The starter sync endpoint is available at `/api/handle-sync` and validates database connectivity.
