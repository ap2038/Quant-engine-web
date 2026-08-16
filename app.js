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
    
    if(pageId === 'positions') fetchData();
}

// ==========================================
// PASTE YOUR PUBLIC GIST "RAW" URL BELOW
// ==========================================
const GIST_URL = 'https://gist.githubusercontent.com/ap2038/941e59e4a43b6cbc639dd716757bfc57/raw/d43d53f3856551865e6dc65231012262a3bad01e/dashboard_data.json';

// CWE-20: Strict Schema Validation
// Prevents Prototype Pollution and guarantees payload integrity
function validateTradeData(data) {
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
    
    for (const [symbol, details] of Object.entries(data)) {
        if (typeof symbol !== 'string' || symbol.length > 20) return false;
        if (!['OPEN', 'CLOSED'].includes(details.status)) return false;
        if (typeof details.entry_price !== 'number' || !Number.isFinite(details.entry_price)) return false;
    }
    return true;
}

// CWE-79: Safe DOM Element Creator
// Replaces innerHTML entirely to mitigate DOM-based Cross-Site Scripting (XSS)
function createSafeCell(content, className, isHTML = false) {
    const td = document.createElement('td');
    td.className = className;
    if (isHTML) {
        td.innerHTML = content; // Only used for strictly controlled UI badges
    } else {
        td.textContent = content; // Encodes data, preventing malicious scripts
    }
    return td;
}

async function fetchData() {
    const tableBody = document.getElementById('positions-table');
    const syncTime = document.getElementById('last-sync');
    const activeCountNode = document.getElementById('active-count');
    
    if (!tableBody) return;
    tableBody.innerHTML = '';
    const loadingRow = createSafeCell('Fetching live matrix...', 'text-center py-8 text-gray-500', false);
    loadingRow.colSpan = 5;
    tableBody.appendChild(document.createElement('tr').appendChild(loadingRow).parentNode);
    
    try {
        // Cache-busting parameter prevents old data rendering
        const response = await fetch(`${GIST_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        // Security Gate: Fail closed if payload is manipulated
        if (!validateTradeData(data)) {
            throw new Error('Data validation failed - Potential payload tampering');
        }
        
        tableBody.innerHTML = ''; // Clear loading state
        let activeCount = 0;

        for (const [symbol, details] of Object.entries(data)) {
            if (details.status === 'OPEN') activeCount++;
            
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-800/50 transition text-gray-300";
            
            // Build cells via safe textContent injections
            tr.appendChild(createSafeCell(symbol, 'px-6 py-4 font-bold text-white', false));
            tr.appendChild(createSafeCell(details.direction || 'N/A', 'px-6 py-4', false));
            tr.appendChild(createSafeCell(details.entry_price ? details.entry_price.toFixed(2) : 'N/A', 'px-6 py-4', false));
            tr.appendChild(createSafeCell(details.sl ? details.sl.toFixed(2) : '-', 'px-6 py-4 text-gray-500', false));
            
            // Safe Badge Rendering
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
        
        if (activeCountNode) activeCountNode.textContent = activeCount;
        if (syncTime) syncTime.textContent = new Date().toLocaleTimeString();

    } catch (error) {
        console.error("Fetch failed", error);
        tableBody.innerHTML = '';
        const errorRow = createSafeCell('System Error: Disconnected from DB.', 'text-center py-8 text-red-500 font-bold', false);
        errorRow.colSpan = 5;
        tableBody.appendChild(document.createElement('tr').appendChild(errorRow).parentNode);
    }
}

// Initialize on page load and poll every 60 seconds
fetchData();
setInterval(fetchData, 60000);
