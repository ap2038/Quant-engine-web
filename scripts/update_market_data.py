import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
import yfinance as yf

IST = ZoneInfo("Asia/Kolkata")
ET = ZoneInfo("America/New_York")
OUT = "data/market.json"
NSE_GIFT_URLS = [
    "https://www.nseindia.com/market-data/live-equity-market?symbol=NIFTY+LARGEMIDCAP+250",
    "https://www.nseindia.com/get-quotes/derivatives?symbol=NIFTY",
]
INVESTING_GIFT = "https://www.investing.com/indices/gift-nifty-50-c1-futures"


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
    return {"value": last, "change": last - prev, "change_pct": ((last / prev) - 1) * 100 if prev else 0, "timestamp": data.index[-1].isoformat()}


def parse_gift_html(text, source):
    clean = re.sub(r"\s+", " ", text)
    patterns = [
        r"(?:GiftNiftyFutures|gift-nifty-logo)\s*(?:Futures)?\s*\d{1,2}-[A-Za-z]{3}-\d{4}\s*([\d,]+\.\d+)\s*([+-]?[\d,]+\.\d+)\s*\(([+-]?[\d.]+)%\)",
        r"Futures\s+\d{1,2}-[A-Za-z]{3}-\d{4}\s+([\d,]+\.\d+)\s+([+-]?[\d,]+\.\d+)\s+\(([+-]?[\d.]+)%\)",
        r"Gift Nifty 50(?: Futures)?[^0-9]{0,250}([\d,]+\.\d+)\s+([+-]?[\d,]+\.\d+)\s*\(([+-]?[\d.]+)%\)",
    ]
    for pattern in patterns:
        match = re.search(pattern, clean, flags=re.IGNORECASE)
        if match:
            value = float(match.group(1).replace(",", ""))
            change = float(match.group(2).replace(",", ""))
            change_pct = float(match.group(3))
            return {
                "value": value,
                "change": change,
                "change_pct": change_pct,
                "status": "LIVE",
                "source": source,
                "updated_at": datetime.now(IST).isoformat(),
            }
    return None


def public_gift_nifty():
    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
        "Connection": "keep-alive",
    }
    session = requests.Session()
    session.headers.update(headers)

    # NSE publishes the GIFT Nifty futures snapshot in its public market pages.
    for url in NSE_GIFT_URLS:
        try:
            session.get("https://www.nseindia.com/", timeout=10)
            response = session.get(url, timeout=25)
            response.raise_for_status()
            parsed = parse_gift_html(response.text, "NSE Public")
            if parsed:
                return parsed
        except Exception:
            continue

    # Secondary public source; no credentials are used.
    try:
        response = requests.get(INVESTING_GIFT, headers=headers, timeout=25)
        response.raise_for_status()
        parsed = parse_gift_html(response.text, "Investing Public")
        if parsed:
            return parsed
    except Exception:
        pass

    return {
        "value": None,
        "change": None,
        "change_pct": None,
        "status": "UNAVAILABLE",
        "source": "Public feed",
        "signal": "GIFT Nifty public feed temporarily unavailable",
        "updated_at": datetime.now(IST).isoformat(),
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
    gift_nifty = public_gift_nifty()

    payload = {
        "updated_at": datetime.now(IST).isoformat(),
        "source": "GitHub Actions / Yahoo Finance + Public GIFT Nifty",
        "market_status": {"india": status(), "us": us_status()},
        "india": {"nifty": nifty, "sensex": sensex},
        "us_markets": {"dow": dow, "sp500": sp, "nasdaq": nasdaq},
        "gift_nifty": gift_nifty,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(json.dumps({"gift_nifty_status": gift_nifty.get("status"), "gift_nifty_source": gift_nifty.get("source"), "updated_at": payload["updated_at"]}, indent=2))


if __name__ == "__main__":
    main()
