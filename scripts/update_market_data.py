import json
import math
from datetime import datetime
from zoneinfo import ZoneInfo

import yfinance as yf

IST = ZoneInfo("Asia/Kolkata")
ET = ZoneInfo("America/New_York")
OUT = "data/market.json"


def quote(ticker):
    data = yf.download(ticker, period="2d", interval="5m", auto_adjust=False, progress=False, threads=False)
    if data is None or data.empty:
        return None
    if hasattr(data.columns, "nlevels") and data.columns.nlevels > 1:
        try:
            data = data.xs(ticker, axis=1, level=1)
        except Exception:
            try:
                data = data.xs(ticker, axis=1, level=0)
            except Exception:
                data.columns = [c[-1] if isinstance(c, tuple) else c for c in data.columns]
    data = data.dropna(subset=["Close"])
    if data.empty:
        return None
    last = float(data["Close"].iloc[-1])
    prev = float(data["Close"].iloc[-2]) if len(data) > 1 else last
    return {
        "value": last,
        "change": last - prev,
        "change_pct": ((last / prev) - 1) * 100 if prev else 0,
        "timestamp": data.index[-1].isoformat(),
    }


def status():
    now = datetime.now(IST)
    if now.weekday() >= 5:
        return "CLOSED"
    total = now.hour * 60 + now.minute
    if 555 <= total < 930:
        return "OPEN"
    if 540 <= total < 555:
        return "PRE-OPEN"
    if 930 <= total < 960:
        return "POST-MARKET"
    return "CLOSED"


def us_status():
    now = datetime.now(ET)
    if now.weekday() >= 5:
        return "CLOSED"
    total = now.hour * 60 + now.minute
    if 570 <= total < 960:
        return "OPEN"
    if 510 <= total < 570:
        return "PRE-OPEN"
    if 960 <= total < 1200:
        return "AFTER-HOURS"
    return "CLOSED"


def main():
    nifty = quote("^NSEI")
    sensex = quote("^BSESN")
    dow = quote("^DJI")
    sp = quote("^GSPC")
    nasdaq = quote("^IXIC")

    payload = {
        "updated_at": datetime.now(IST).isoformat(),
        "source": "GitHub Actions / Yahoo Finance server-side snapshot",
        "market_status": {"india": status(), "us": us_status()},
        "india": {"nifty": nifty, "sensex": sensex},
        "us_markets": {"dow": dow, "sp500": sp, "nasdaq": nasdaq},
        "gift_nifty": {"value": None, "change": None, "change_pct": None, "signal": "Awaiting dedicated GIFT NIFTY feed"},
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


if __name__ == "__main__":
    main()
