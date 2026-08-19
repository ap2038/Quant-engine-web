# Live market data layer

The dashboard is a static site and reads `dashboard_data.json` from the existing GitHub Gist. Live market data is now published into that same Gist every 5 minutes by GitHub Actions.

## Live flow

`Yahoo Finance market feed -> GitHub Actions -> dashboard_data.json Gist -> Quant Engine UI`

This avoids requiring Vercel or another serverless host.

## One-time GitHub secret required

Create a GitHub Personal Access Token with **gist** permission and add it to:

`Quant-engine-web -> Settings -> Secrets and variables -> Actions -> New repository secret`

Secret name:

`GIST_TOKEN`

The token is used only by the scheduled publisher to update Gist `941e59e4a43b6cbc639dd716757bfc57`.

## Automatic refresh

`.github/workflows/live-market.yml` runs every 5 minutes on weekdays and can also be started manually from Actions.

The publisher updates:

- NIFTY
- SENSEX
- Dow Jones
- S&P 500
- Nasdaq
- market status
- live-feed timestamp/status

The dashboard refreshes the Gist every 30 seconds.

## GIFT NIFTY

GIFT NIFTY is supported as an optional upstream field through the existing report data. For a direct live GIFT NIFTY feed, configure an Upstox access token and the corresponding `GLOBAL_INDEX` instrument key in the upstream publisher.

GIFT Nifty trades on NSE IX in two sessions, including an evening/overnight session, which is why it is treated separately from NSE cash-market status.

## Important

The dashboard uses the **current unversioned Gist raw URL**. Do not replace it with a revision-pinned raw URL, otherwise future Gist updates will not appear on the screen.
