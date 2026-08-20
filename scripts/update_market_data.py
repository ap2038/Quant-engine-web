import json
import os
import re
from datetime import datetime
from io import StringIO
from zoneinfo import ZoneInfo

import pandas as pd
import requests
import yfinance as yf

IST = ZoneInfo("Asia/Kolkata")
ET = ZoneInfo("America/New_York")
OUT = "data/market.json"
DHAN_BASE = "https://api.dhan.co/v2"
INSTRUMENT_MASTER = "https://images.dhan.co/api-data/api-scrip-master-detailed.csv"
NSE_GIFT_URL = "https://www.nseindia.com/market-data/live-equity-market"


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


def dhan_headers():
    token = os.environ.get("DHAN_ACCESS_TOKEN")
    client_id = os.environ.get("DHAN_CLIENT_ID")
    if not token or not client_id:
        return None
    return {"Accept": "application/json", "Content-Type": "application/json", "access-token": token, "client-id": client_id}


def resolve_gift_nifty():
    response = requests.get(INSTRUMENT_MASTER, timeout=45)
    response.raise_for_status()
    df = pd.read_csv(StringIO(response.text), low_memory=False)
    cols = {str(c).upper().strip(): c for c in df.columns}
    def col(*names):
        for name in names:
            if name in cols:
                return cols[name]
        return None
    security_col = col("SECURITY_ID", "SEM_SECURITY_ID")
    segment_col = col("SEGMENT", "SEM_SEGMENT")
    instrument_col = col("INSTRUMENT", "SEM_INSTRUMENT_NAME")
    symbol_col = col("SYMBOL_NAME", "SM_SYMBOL_NAME")
    display_col = col("DISPLAY_NAME", "SEM_CUSTOM_SYMBOL")
    exchange_col = col("EXCH_ID", "SEM_EXM_EXCH_ID")
    if not security_col:
        raise RuntimeError("Dhan instrument master has no Security ID column")
    text_cols = [c for c in [symbol_col, display_col] if c]
    if not text_cols:
        raise RuntimeError("Dhan instrument master has no symbol/display column")
    mask = False
    for c in text_cols:
        s = df[c].fillna("").astype(str).str.upper().str.replace("-", " ", regex=False)
        mask = mask | s.str.contains("GIFT NIFTY|GIFTNIFTY|SGX NIFTY|SGXNIFTY", regex=True)
    candidates = df[mask].copy()
    if instrument_col:
        inst = candidates[instrument_col].fillna("").astype(str).str.upper()
        index_candidates = candidates[inst.str.contains("INDEX", na=False)]
        if not index_candidates.empty:
            candidates = index_candidates
    if candidates.empty:
        raise RuntimeError("GIFT Nifty was not found in Dhan instrument master")
    if segment_col:
        idx = candidates[segment_col].fillna("").astype(str).str.upper()
        preferred = candidates[idx.eq("IDX_I")]
        if not preferred.empty:
            candidates = preferred
    row = candidates.iloc[0]
    security_id = str(row[security_col]).split(".")[0]
    segment = str(row[segment_col]) if segment_col else "IDX_I"
    display = str(row[display_col]) if display_col else str(row[symbol_col])
    exchange = str(row[exchange_col]) if exchange_col else ""
    return security_id, segment, display, exchange


def dhan_gift_nifty():
    headers = dhan_headers()
    if not headers:
        return None, "Dhan feed unavailable"
    try:
        security_id, segment, display, exchange = resolve_gift_nifty()
        response = requests.post(f"{DHAN_BASE}/marketfeed/quote", headers=headers, json={segment: [int(security_id)]}, timeout=20)
        response.raise_for_status()
        body = response.json()
        if body.get("status") not in (None, "success"):
            raise RuntimeError("Dhan quote request failed")
        bucket = body.get("data", {}).get(segment, {})
        item = bucket.get(security_id) or bucket.get(str(int(security_id)))
        if not item:
            raise RuntimeError("No GIFT Nifty quote returned")
        value = item.get("last_price")
        net_change = item.get("net_change")
        if value is None:
            raise RuntimeError("GIFT Nifty price unavailable")
        value = float(value)
        change = float(net_change) if net_change is not None else None
        previous = value - change if change is not None else None
        change_pct = (change / previous * 100) if previous not in (None, 0) else None
        return {"value": value, "change": change, "change_pct": change_pct, "status": "LIVE", "source": "Dhan", "security_id": security_id, "segment": segment, "instrument": display, "exchange": exchange, "updated_at": datetime.now(IST).isoformat()}, None
    except Exception as exc:
        return None, str(exc)


def public_gift_nifty():
    """Parse the GIFT Nifty futures quote exposed in NSE's public market page."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; QuantEngine/1.0)", "Accept": "text/html,application/xhtml+xml"}
    response = requests.get(NSE_GIFT_URL, headers=headers, timeout=20)
    response.raise_for_status()
    text = re.sub(r"\\s+", " ", response.text)
    marker = re.search(r"GiftNiftyFutures[^0-9]{0,120}([0-9][0-9,]*\\.?[0-9]*)[^0-9+-]{0,80}([+-]?[0-9][0-9,]*\\.?[0-9]*)\\s*\\(?([+-]?[0-9]+\\.?[0-9]*)%", text, re.I)
    if not marker:
        marker = re.search(r"GiftNiftyFutures[^0-9]{0,120}([0-9][0-9,]*\\.?[0-9]*)[^0-9+-]{0,80}([+-]?[0-9][0-9,]*\\.?[0-9]*)", text, re.I)
    if not marker:
        raise RuntimeError("Public NSE GIFT Nifty quote not found")
    value = float(marker.group(1).replace(",", ""))
    change = float(marker.group(2).replace(",", ""))
    change_pct = float(marker.group(3)) if marker.lastindex and marker.lastindex >= 3 else None
    return {"value": value, "change": change, "change_pct": change_pct, "status": "LIVE", "source": "NSE Public", "instrument": "GIFT NIFTY Futures", "updated_at": datetime.now(IST).isoformat()}


def get_gift_nifty():
    value, error = dhan_gift_nifty()
    if value is not None:
        return value
    try:
        return public_gift_nifty()
    except Exception:
        return {"value": None, "change": None, "change_pct": None, "status": "UNAVAILABLE", "source": "Public fallback", "signal": "GIFT Nifty feed temporarily unavailable", "updated_at": datetime.now(IST).isoformat()}


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
    gift_nifty = get_gift_nifty()
    payload = {"updated_at": datetime.now(IST).isoformat(), "source": "GitHub Actions / Yahoo Finance + Dhan + public NSE fallback", "market_status": {"india": status(), "us": us_status()}, "india": {"nifty": nifty, "sensex": sensex}, "us_markets": {"dow": dow, "sp500": sp, "nasdaq": nasdaq}, "gift_nifty": gift_nifty}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(json.dumps({"gift_nifty_status": gift_nifty.get("status"), "gift_nifty_source": gift_nifty.get("source"), "updated_at": payload["updated_at"]}, indent=2))


if __name__ == "__main__":
    main()
