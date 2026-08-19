# Quant-engine-web

## Dashboard data contract
The frontend reads `dashboard_data.json` from the configured public Gist every 30 seconds. The report can include:

- `market_levels.nifty` and `market_levels.sensex` for latest close/change.
- `market_levels.gift_nifty` for live GIFT Nifty value/change/timestamp.
- `market_levels.us_markets` for live Dow, S&P 500 and Nasdaq values/change/timestamp.
- `market_context` for VIX, sentiment, OI and source status.
- `trades` for the current call state; an `OPEN` trade is shown as **CALL GIVEN**, otherwise the dashboard shows **WAIT — Wait for the right movement to enter.**

The UI independently calculates India and U.S. market open/close status from exchange-local time and refreshes the report every 30 seconds. See `market-data.schema.json` for the expected payload shape.
