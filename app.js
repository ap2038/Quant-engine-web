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
    
    if(pageId === 'overview' || pageId === 'positions') fetchData();
}

// ==========================================
// PASTE YOUR PUBLIC GIST "RAW" URL BELOW
// ==========================================
const GIST_URL = 'https://gist.githubusercontent.com/ap2038/941e59e4a43b6cbc639dd716757bfc57/raw/d43d53f3856551865e6dc65231012262a3bad01e/dashboard_data.json';

// CWE-79: Safe DOM Element Creator (XSS Mitigation)
function createSafeCell(content, className, isHTML = false) {
    const td = document.createElement('td');
    td.className = className;
    if (isHTML) {
        td.innerHTML = content; 
    } else {
        td.textContent = content; 
    }
    return td;
}

// Helper to safely update text content of an ID
function safeSetText(id, text, colorClass = null) {
    const el = document.getElementById(id);
    if(el) {
        el.textContent = text;
        if(colorClass) el.className = colorClass;
    }
}

// CWE-20: Updated Strict Schema Validation
function validateTradeData(data) {
    if (typeof data !== 'object' || data === null) return false;
    
    // Only validate the 'trades' object if it exists
    if (data.trades) {
        for (const [symbol, details] of Object.entries(data.trades)) {
            if (typeof symbol !== 'string' || symbol.length > 20) return false;
            if (!['OPEN', 'CLOSED'].includes(details.status)) return false;
        }
    }
    return true;
}

async function fetchData() {
    const tableBody = document.getElementById('positions-table');
    const topStocksBody = document.getElementById('top-stocks-table');
    
    try {
        // Cache-buster
        const response = await fetch(`${GIST_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        // Security Gate
        if (!validateTradeData(data)) throw new Error('Payload validation failed.');

        // --- 1. PARSE MARKET CONTEXT ---
        if (data.market_context) {
            const ctx = data.market_context;
            const isClosed = ctx.status.toUpperCase() === 'CLOSED';
            
            safeSetText('market-status-text', `Market: ${ctx.status}`);
            const statusInd = document.getElementById('status-indicator');
            if(statusInd) statusInd.className = isClosed ? 'w-2 h-2 bg-gray-500 rounded-full' : 'w-2 h-2 bg-green-500 rounded-full animate-pulse';

            safeSetText('ui-vix', ctx.vix ? ctx.vix.toFixed(2) : '--');
            safeSetText('ui-oi-data', ctx.oi_summary || 'No OI data available.');
            
            let sentColor = 'text-2xl font-bold mt-1 text-gray-400';
            if (ctx.sentiment === 'BULLISH') sentColor = 'text-2xl font-bold mt-1 text-green-500';
            if (ctx.sentiment === 'BEARISH') sentColor = 'text-2xl font-bold mt-1 text-red-500';
            safeSetText('ui-sentiment', ctx.sentiment || 'NEUTRAL', sentColor);
        }

        // --- 2. PARSE TOP 5 STOCKS ---
        if (data.top_stocks && Array.isArray(data.top_stocks) && topStocksBody) {
            topStocksBody.innerHTML = '';
            data.top_stocks.forEach(stock => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-800/50 transition text-gray-300";
                
                tr.appendChild(createSafeCell(stock.symbol || 'Unknown', 'px-6 py-3 font-bold text-white', false));
                tr.appendChild(createSafeCell(stock.volume || '0', 'px-6 py-3', false));
                
                const typeTd = document.createElement('td');
                typeTd.className = 'px-6 py-3 text-right font-bold';
                typeTd.className += (stock.type === 'BUYING') ? ' text-green-500' : ' text-red-500';
                typeTd.textContent = stock.type || 'N/A';
                tr.appendChild(typeTd);
                
                topStocksBody.appendChild(tr);
            });
        }

        // --- 3. PARSE OPTIONS TRADES ---
        const tradesData = data.trades || {};
        if (tableBody) {
            tableBody.innerHTML = ''; 
            for (const [symbol, details] of Object.entries(tradesData)) {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-800/50 transition text-gray-300";
                
                tr.appendChild(createSafeCell(symbol, 'px-6 py-4 font-bold text-white', false));
                tr.appendChild(createSafeCell(details.direction || 'N/A', 'px-6 py-4', false));
                tr.appendChild(createSafeCell(details.entry_price ? details.entry_price.toFixed(2) : 'N/A', 'px-6 py-4', false));
                tr.appendChild(createSafeCell(details.sl ? details.sl.toFixed(2) : '-', 'px-6 py-4 text-gray-500', false));
                
                const statusTd = document.createElement('td');
                statusTd.className = 'px-6 py-4 text-right';
                if (details.status === 'OPEN') {
                    statusTd.innerHTML = '<span class="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-bold border border-blue-500/30">OPEN</span>';
                } else {
                    const isProfit = details.pnl && details.pnl > 0;
                    statusTd.className += isProfit ? ' text-green-500 font-bold' : ' text-red-500 font-bold';
                    statusTd.textContent = `${isProfit ? '+' : ''}${details.pnl.toFixed(2)} pts`;
                }
                tr.appendChild(statusTd);
                tableBody.appendChild(tr);
            }
        }
        
        safeSetText('last-sync', new Date().toLocaleTimeString());

    } catch (error) {
        console.error("Fetch failed", error);
        if(tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-red-500">System Error: ${error.message}</td></tr>`;
    }
}

// Initialize and poll
fetchData();
setInterval(fetchData, 60000);
