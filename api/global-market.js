/**
 * Quant Engine live global market layer.
 *
 * Server-side endpoint: works with Vercel/Netlify-style Node runtimes.
 * Sources:
 *   - Yahoo Finance chart endpoint for US + India index snapshots.
 *   - Upstox Global Index LTP for GIFT NIFTY when UPSTOX_ACCESS_TOKEN is set.
 *
 * The dashboard never invents prices: unavailable fields are returned as null.
 */

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const UPSTOX = 'https://api.upstox.com/v3/market-quote/ltp';

const symbols = {
  nifty: '^NSEI',
  sensex: '^BSESN',
  dow: '^DJI',
  sp500: '^GSPC',
  nasdaq: '^IXIC',
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.end(JSON.stringify(body));
}

function yahooSnapshot(payload) {
  const r = payload?.chart?.result?.[0];
  const meta = r?.meta || {};
  const value = Number(meta.regularMarketPrice ?? meta.previousClose);
  const previous = Number(meta.previousClose ?? meta.chartPreviousClose);
  const change = Number.isFinite(value) && Number.isFinite(previous) ? value - previous : null;
  const changePct = Number.isFinite(change) && Number.isFinite(previous) && previous !== 0 ? (change / previous) * 100 : null;
  return {
    value: Number.isFinite(value) ? value : null,
    change: Number.isFinite(change) ? change : null,
    change_pct: Number.isFinite(changePct) ? changePct : null,
    currency: meta.currency || null,
    timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    source: 'Yahoo Finance',
  };
}

async function yahooQuote(symbol) {
  const url = `${YAHOO}${encodeURIComponent(symbol)}?range=1d&interval=5m&includePrePost=true`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'QuantEngine/1.0',
    },
  });
  if (!response.ok) throw new Error(`Yahoo ${symbol}: HTTP ${response.status}`);
  return yahooSnapshot(await response.json());
}

async function upstoxGiftNifty() {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) return null;
  const instrumentKey = process.env.UPSTOX_GIFT_NIFTY_KEY || 'GLOBAL_INDEX|SGX NIFTY';
  const response = await fetch(`${UPSTOX}?instrument_key=${encodeURIComponent(instrumentKey)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error(`Upstox GIFT NIFTY: HTTP ${response.status}`);
  const payload = await response.json();
  const root = payload?.data || {};
  const raw = root[instrumentKey] || Object.values(root)[0] || {};
  const value = Number(raw.last_price ?? raw.ltp ?? raw.last_traded_price);
  const previous = Number(raw.cp ?? raw.previous_close ?? raw.prev_close);
  const change = Number.isFinite(value) && Number.isFinite(previous) ? value - previous : null;
  const changePct = Number.isFinite(change) && Number.isFinite(previous) && previous !== 0 ? (change / previous) * 100 : null;
  return {
    value: Number.isFinite(value) ? value : null,
    change: Number.isFinite(change) ? change : null,
    change_pct: Number.isFinite(changePct) ? changePct : null,
    timestamp: new Date().toISOString(),
    source: 'Upstox Global Index',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const entries = Object.entries(symbols);
  const settled = await Promise.allSettled(entries.map(([, symbol]) => yahooQuote(symbol)));
  const quotes = {};
  entries.forEach(([name], idx) => {
    quotes[name] = settled[idx].status === 'fulfilled' ? settled[idx].value : null;
  });

  let gift = null;
  try {
    gift = await upstoxGiftNifty();
  } catch (error) {
    console.error(error);
  }

  return json(res, 200, {
    updated_at: new Date().toISOString(),
    source_status: {
      yahoo: entries.every(([,], idx) => settled[idx].status === 'fulfilled') ? 'LIVE' : 'PARTIAL',
      gift_nifty: gift ? 'LIVE' : 'CONFIGURE_UPSTOX',
    },
    india: {
      nifty: quotes.nifty,
      sensex: quotes.sensex,
    },
    us_markets: {
      dow: quotes.dow,
      sp500: quotes.sp500,
      nasdaq: quotes.nasdaq,
    },
    gift_nifty: gift,
  });
};
