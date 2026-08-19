# Live market data layer

`/api/global-market` is the server-side market feed used by `app.js`.

## What it provides
- NIFTY and SENSEX live snapshots
- Dow Jones, S&P 500 and Nasdaq live snapshots
- GIFT NIFTY when an Upstox Global Index token is configured
- Source status and server timestamp

The Yahoo requests run server-side to avoid browser CORS restrictions. Yahoo's chart endpoint is not suitable for direct browser calls because it does not expose browser CORS headers.

## Deployment
The repository now includes a Vercel-compatible `api/global-market.js` function. Deploy the repository on Vercel (or another Node/serverless host that supports `/api/*.js`). A static-only GitHub Pages deployment will continue to use the existing Gist report feed for fields that the live API cannot supply.

## GIFT NIFTY
Set the following environment variable on the server:

`UPSTOX_ACCESS_TOKEN=<your Upstox access token>`

Optionally override:

`UPSTOX_GIFT_NIFTY_KEY=GLOBAL_INDEX|SGX NIFTY`

Upstox documents GIFT NIFTY as a `GLOBAL_INDEX` instrument and provides LTP/quote APIs for global indexes.
