// --- MULTI-PAGE ROUTING SYSTEM ---
function navigate(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageId}`);
    const targetNav = document.getElementById(`nav-${pageId}`);
    if (targetPage && targetNav) {
        targetPage.classList.add('active');
        targetNav.classList.add('active');
    }
    if (pageId === 'overview' || pageId === 'positions') fetchData();
}

const GIST_URL = 'https://gist.githubusercontent.com/ap2038/941e59e4a43b6cbc639dd716757bfc57/raw/d43d53f3856551865e6dc65231012262a3bad01e/dashboard_data.json';

function createSafeCell(content, className, isHTML = false) {
    const td = document.createElement('td');
    td.className = className;
    if (isHTML) td.innerHTML = content;
    else td.textContent = content;
    return td;
}

function safeSetText(id, text, colorClass = null) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
        if (colorClass) el.className = colorClass;
    }
}

function validateTradeData(data) {
    if (typeof data !== 'object' || data === null) return false;
    if (data.trades) {
        for (const [symbol, details] of Object.entries(data.trades)) {
            if (typeof symbol !== 'string' || symbol.length > 20) return false;
            if (!details || !['OPEN', 'CLOSED'].includes(details.status)) return false;
        }
    }
    return true;
}

function formatNum(value, decimals = 2) {
    return typeof value === 'number' && Number.isFinite(value)
        ? value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : '--';
}

function formatPct(value) {
    return typeof value === 'number' && Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '--';
}

function toneClass(value) {
    if (typeof value !== 'number') return 'text-gray-400';
    return value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-gray-400';
}

function getIndiaMarketStatus(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
    const total = hour * 60 + minute;
    if (weekday === 'Sat' || weekday === 'Sun') return { status: 'CLOSED', label: 'India Market Closed' };
    if (total >= 540 && total < 555) return { status: 'PRE-OPEN', label: 'India Pre-Open' };
    if (total >= 555 && total < 930) return { status: 'OPEN', label: 'India Market Open' };
    if (total >= 930 && total < 960) return { status: 'POST-MARKET', label: 'India Post-Market' };
    return { status: 'CLOSED', label: 'India Market Closed' };
}

function getUSMarketStatus(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
    const total = hour * 60 + minute;
    if (weekday === 'Sat' || weekday === 'Sun') return { status: 'CLOSED', label: 'US Market Closed' };
    if (total >= 510 && total < 570) return { status: 'PRE-OPEN', label: 'US Pre-Market' };
    if (total >= 570 && total < 960) return { status: 'OPEN', label: 'US Market Open' };
    if (total >= 960 && total < 1200) return { status: 'AFTER-HOURS', label: 'US After-Hours' };
    return { status: 'CLOSED', label: 'US Market Closed' };
}

function statusPill(status) {
    const colors = {
        OPEN: 'bg-green-500/20 text-green-400 border-green-500/30',
        'PRE-OPEN': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'POST-MARKET': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'AFTER-HOURS': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        CLOSED: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return `<span class="px-2 py-1 rounded text-xs font-bold border ${colors[status] || colors.CLOSED}">${status}</span>`;
}

function ensureMarketDashboard() {
    const page = document.getElementById('page-overview');
    if (!page || document.getElementById('live-market-strip')) return;
    const header = page.querySelector('div.flex.justify-between.items-center.mb-6');
    const strip = document.createElement('div');
    strip.id = 'live-market-strip';
    strip.className = 'mb-8';
    strip.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="bg-panel p-5 rounded border border-gray-800 shadow-lg">
                <div class="flex justify-between items-center"><p class="text-gray-400 text-xs uppercase tracking-wider">India Market</p><span id="india-market-status">--</span></div>
                <p id="india-market-label" class="text-lg font-bold text-white mt-3">--</p>
            </div>
            <div class="bg-panel p-5 rounded border border-gray-800 shadow-lg">
                <div class="flex justify-between items-center"><p class="text-gray-400 text-xs uppercase tracking-wider">US Market</p><span id="us-market-status">--</span></div>
                <p id="us-market-label" class="text-lg font-bold text-white mt-3">--</p>
            </div>
            <div class="bg-panel p-5 rounded border border-gray-800 shadow-lg">
                <p class="text-gray-400 text-xs uppercase tracking-wider">Trading Call</p>
                <p id="call-status" class="text-lg font-bold text-yellow-400 mt-3">WAIT</p>
                <p id="call-detail" class="text-xs text-gray-500 mt-1">Waiting for a qualified setup.</p>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-panel p-5 rounded border border-gray-800 shadow-lg"><p class="text-gray-400 text-xs uppercase tracking-wider">NIFTY Close</p><p id="level-nifty" class="text-xl font-bold text-white mt-2">--</p><p id="level-nifty-change" class="text-xs mt-1 text-gray-500">--</p></div>
            <div class="bg-panel p-5 rounded border border-gray-800 shadow-lg"><p class="text-gray-400 text-xs uppercase tracking-wider">SENSEX Close</p><p id="level-sensex" class="text-xl font-bold text-white mt-2">--</p><p id="level-sensex-change" class="text-xs mt-1 text-gray-500">--</p></div>
            <div class="bg-panel p-5 rounded border border-gray-800 shadow-lg"><p class="text-gray-400 text-xs uppercase tracking-wider">GIFT NIFTY</p><p id="level-gift" class="text-xl font-bold text-white mt-2">--</p><p id="level-gift-change" class="text-xs mt-1 text-gray-500">--</p></div>
        </div>
        <div class="mt-4 bg-panel p-5 rounded border border-gray-800 shadow-lg">
            <div class="flex justify-between items-center mb-4"><p class="text-gray-400 text-xs uppercase tracking-wider">US Market Update</p><p id="us-data-time" class="text-xs text-gray-600">--</p></div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><p class="text-gray-500 text-xs">Dow Jones</p><p id="us-dow" class="text-lg font-bold text-white mt-1">--</p></div>
                <div><p class="text-gray-500 text-xs">S&amp;P 500</p><p id="us-sp" class="text-lg font-bold text-white mt-1">--</p></div>
                <div><p class="text-gray-500 text-xs">Nasdaq</p><p id="us-nasdaq" class="text-lg font-bold text-white mt-1">--</p></div>
            </div>
        </div>`;
    page.insertBefore(strip, header?.nextSibling || page.firstChild);
}

function renderLiveStatus() {
    const india = getIndiaMarketStatus();
    const us = getUSMarketStatus();
    safeSetText('india-market-label', india.label);
    safeSetText('us-market-label', us.label);
    const indiaEl = document.getElementById('india-market-status');
    const usEl = document.getElementById('us-market-status');
    if (indiaEl) indiaEl.innerHTML = statusPill(india.status);
    if (usEl) usEl.innerHTML = statusPill(us.status);
    const topStatus = document.getElementById('market-status-text');
    const topIndicator = document.getElementById('status-indicator');
    if (topStatus) topStatus.textContent = `Market: ${india.status}`;
    if (topIndicator) topIndicator.className = india.status === 'OPEN'
        ? 'w-2 h-2 bg-green-500 rounded-full animate-pulse'
        : 'w-2 h-2 bg-gray-500 rounded-full';
}

function renderReportMarketData(data) {
    ensureMarketDashboard();
    renderLiveStatus();
    const levels = data.market_levels || {};
    const nifty = levels.nifty || {};
    const sensex = levels.sensex || {};
    const gift = levels.gift_nifty || {};
    const us = levels.us_markets || {};
    safeSetText('level-nifty', formatNum(nifty.close));
    safeSetText('level-sensex', formatNum(sensex.close));
    safeSetText('level-gift', formatNum(gift.value));
    const nChange = document.getElementById('level-nifty-change');
    const sChange = document.getElementById('level-sensex-change');
    const gChange = document.getElementById('level-gift-change');
    if (nChange) { nChange.textContent = `${formatNum(nifty.change)} pts • ${formatPct(nifty.change_pct)}`; nChange.className = `text-xs mt-1 ${toneClass(nifty.change_pct)}`; }
    if (sChange) { sChange.textContent = `${formatNum(sensex.change)} pts • ${formatPct(sensex.change_pct)}`; sChange.className = `text-xs mt-1 ${toneClass(sensex.change_pct)}`; }
    if (gChange) { gChange.textContent = `${formatNum(gift.change)} pts • ${formatPct(gift.change_pct)}`; gChange.className = `text-xs mt-1 ${toneClass(gift.change_pct)}`; }
    const setUS = (id, obj) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = `${formatNum(obj?.value)}  ${formatPct(obj?.change_pct)}`;
        el.className = `text-lg font-bold mt-1 ${toneClass(obj?.change_pct)}`;
    };
    setUS('us-dow', us.dow);
    setUS('us-sp', us.sp500);
    setUS('us-nasdaq', us.nasdaq);
    safeSetText('us-data-time', us.timestamp || levels.updated_at || '--');

    const trades = data.trades || {};
    const openTrades = Object.entries(trades).filter(([, details]) => details?.status === 'OPEN');
    if (openTrades.length) {
        const names = openTrades.slice(0, 3).map(([symbol, d]) => `${symbol} ${d.direction || ''}`.trim()).join(' | ');
        safeSetText('call-status', 'CALL GIVEN', 'text-lg font-bold mt-3 text-green-400');
        safeSetText('call-detail', names);
    } else {
        safeSetText('call-status', 'WAIT', 'text-lg font-bold mt-3 text-yellow-400');
        safeSetText('call-detail', 'Wait for the right movement to enter.');
    }
}

async function fetchData() {
    ensureMarketDashboard();
    renderLiveStatus();
    const tableBody = document.getElementById('positions-table');
    const topStocksBody = document.getElementById('top-stocks-table');
    try {
        const response = await fetch(`${GIST_URL}?t=${Date.now()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (!validateTradeData(data)) throw new Error('Payload validation failed.');
        renderReportMarketData(data);
        if (data.market_context) {
            const ctx = data.market_context;
            safeSetText('ui-vix', typeof ctx.vix === 'number' ? ctx.vix.toFixed(2) : '--');
            safeSetText('ui-oi-data', ctx.oi_summary || 'No OI data available.');
            let sentColor = 'text-2xl font-bold mt-1 text-gray-400';
            if (ctx.sentiment === 'BULLISH') sentColor = 'text-2xl font-bold mt-1 text-green-500';
            if (ctx.sentiment === 'BEARISH') sentColor = 'text-2xl font-bold mt-1 text-red-500';
            safeSetText('ui-sentiment', ctx.sentiment || 'NEUTRAL', sentColor);
        }
        if (data.top_stocks && Array.isArray(data.top_stocks) && topStocksBody) {
            topStocksBody.innerHTML = '';
            data.top_stocks.forEach(stock => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-800/50 transition text-gray-300';
                tr.appendChild(createSafeCell(stock.symbol || 'Unknown', 'px-6 py-3 font-bold text-white'));
                tr.appendChild(createSafeCell(stock.volume || '0', 'px-6 py-3'));
                const typeTd = document.createElement('td');
                typeTd.className = `px-6 py-3 text-right font-bold${stock.type === 'BUYING' ? ' text-green-500' : ' text-red-500'}`;
                typeTd.textContent = stock.type || 'N/A';
                tr.appendChild(typeTd);
                topStocksBody.appendChild(tr);
            });
        }
        const tradesData = data.trades || {};
        if (tableBody) {
            tableBody.innerHTML = '';
            for (const [symbol, details] of Object.entries(tradesData)) {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-800/50 transition text-gray-300';
                tr.appendChild(createSafeCell(symbol, 'px-6 py-4 font-bold text-white'));
                tr.appendChild(createSafeCell(details.direction || 'N/A', 'px-6 py-4'));
                tr.appendChild(createSafeCell(details.entry_price ? details.entry_price.toFixed(2) : 'N/A', 'px-6 py-4'));
                tr.appendChild(createSafeCell(details.sl ? details.sl.toFixed(2) : '-', 'px-6 py-4 text-gray-500'));
                const statusTd = document.createElement('td');
                statusTd.className = 'px-6 py-4 text-right';
                if (details.status === 'OPEN') {
                    statusTd.innerHTML = '<span class="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-bold border border-blue-500/30">OPEN</span>';
                } else {
                    const isProfit = details.pnl && details.pnl > 0;
                    statusTd.className += isProfit ? ' text-green-500 font-bold' : ' text-red-500 font-bold';
                    statusTd.textContent = `${isProfit ? '+' : ''}${Number(details.pnl || 0).toFixed(2)} pts`;
                }
                tr.appendChild(statusTd);
                tableBody.appendChild(tr);
            }
        }
        safeSetText('last-sync', new Date().toLocaleTimeString('en-IN', { hour12: false }));
    } catch (error) {
        console.error('Fetch failed', error);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500">System Error: ${error.message}</td></tr>`;
    }
}

ensureMarketDashboard();
renderLiveStatus();
fetchData();
setInterval(fetchData, 30000);
setInterval(renderLiveStatus, 15000);
