import json
import os
from datetime import datetime, timezone
from pathlib import Path

import requests
import yfinance as yf

GIST_ID = os.environ.get("GIST_ID", "941e59e4a43b6cbc639dd716757bfc57")
GIST_FILENAME = "dashboard_data.json"
GIST_TOKEN = os.environ.get("GIST_TOKEN")

SYMBOLS = {
    "nifty": "^NSEI",
    "sensex": "^BSESN",
    "dow": "^DJI",
    "sp500": "^GSPC",
    "nasdaq": "^IXIC",
}


def quote(symbol: str):
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period="5d", interval="1d", auto_adjust=False)
    if hist is None or hist.empty:
        return {}
    row = hist.iloc[-1]
    previous = hist.iloc[-2] if len(hist) > 1 else row
    close = float(row["Close"])
    prev_close = float(previous["Close"])
    change = close - prev_close
    return {
        "close": close,
        "change": change,
        "change_pct": (change / prev_close * 100) if prev_close else 0,
        "high": float(row["High"]),
        "low": float(row["Low"]),
        "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
    }


def market_status():
    now = datetime.now().astimezone()
    weekday = now.weekday()
    minute = now.hour * 60 + now.minute
    if weekday >= 5:
        return "CLOSED"
    if 555 <= minute < 930:
        return "OPEN"
    if 540 <= minute < 555:
        return "PRE-OPEN"
    if 930 <= minute < 960:
        return "POST-MARKET"
    return "CLOSED"


def load_current():
    response = requests.get(
        f"https://api.github.com/gists/{GIST_ID}",
        headers={"Authorization": f"Bearer {GIST_TOKEN}"} if GIST_TOKEN else {},
        timeout=20,
    )
    response.raise_for_status()
    files = response.json().get("files", {})
    text = files.get(GIST_FILENAME, {}).get("content", "{}")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


def publish(data):
    if not GIST_TOKEN:
        raise RuntimeError("GIST_TOKEN secret is required to publish live data")
    response = requests.patch(
        f"https://api.github.com/gists/{GIST_ID}",
        headers={
            "Authorization": f"Bearer {GIST_TOKEN}",
            "Accept": "application/vnd.github+json",
        },
        json={"files": {GIST_FILENAME: {"content": json.dumps(data, separators=(",", ":"))}}},
        timeout=20,
    )
    response.raise_for_status()


def main():
    data = load_current()
    nifty = quote(SYMBOLS["nifty"])
    sensex = quote(SYMBOLS["sensex"])
    dow = quote(SYMBOLS["dow"])
    sp500 = quote(SYMBOLS["sp500"])
    nasdaq = quote(SYMBOLS["nasdaq"])

    now = datetime.now(timezone.utc).isoformat()
    data["market_levels"] = data.get("market_levels", {})
    data["market_levels"].update({
        "nifty": nifty,
        "sensex": sensex,
        "us_markets": {
            "dow": {"value": dow.get("close"), "change_pct": dow.get("change_pct")},
            "sp500": {"value": sp500.get("close"), "change_pct": sp500.get("change_pct")},
            "nasdaq": {"value": nasdaq.get("close"), "change_pct": nasdaq.get("change_pct")},
            "timestamp": now,
        },
        "updated_at": now,
    })

    ctx = data.get("market_context", {})
    ctx["status"] = market_status()
    data["market_context"] = ctx
    data["live_feed"] = {
        "status": "LIVE",
        "source": "GitHub Actions + Yahoo Finance",
        "updated_at": now,
    }

    publish(data)
    print("Published live market data at", now)
    print(json.dumps(data["market_levels"], indent=2))


if __name__ == "__main__":
    main()
