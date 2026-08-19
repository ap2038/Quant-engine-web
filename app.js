const MARKET_URL = './data/market.json';
const REPORT_URL = 'https://gist.githubusercontent.com/ap2038/941e59e4a43b6cbc639dd716757bfc57/raw/dashboard_data.json';

const $ = id => document.getElementById(id);
const setText = (id, value, cls) => { const n = $(id); if (!n) return; n.textContent = value ?? '--'; if (cls) n.className = cls; };
const num = v => typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2}) : '--';
const pct = v => typeof v === 'number' && Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '--';
const tone = v => typeof v === 'number' ? (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-400') : 'text-slate-400';

function status(tz, india) {
  const p = new Intl.DateTimeFormat('en-IN', {timeZone:tz, weekday:'short', hour:'2-digit', minute:'2-digit', hour12:false}).formatToParts(new Date());
  const wd = p.find(x=>x.type==='weekday')?.value;
  const h = Number(p.find(x=>x.type==='hour')?.value || 0), m = Number(p.find(x=>x.type==='minute')?.value || 0), t = h*60+m;
  if (wd === 'Sat' || wd === 'Sun') return 'CLOSED';
  if (india) return t>=555 && t<930 ? 'OPEN' : t>=540 && t<555 ? 'PRE-OPEN' : t>=930 && t<960 ? 'POST-MARKET' : 'CLOSED';
  return t>=570 && t<960 ? 'OPEN' : t>=510 && t<570 ? 'PRE-OPEN' : t>=960 && t<1200 ? 'AFTER-HOURS' : 'CLOSED';
}

function renderClock() {
  const india = status('Asia/Kolkata', true), us = status('America/New_York', false);
  setText('market-status-text', india);
  setText('india-market-label', `India Market ${india.replace('-', ' ')}`);
  setText('us-market-label', `US Market ${us.replace('-', ' ')}`);
  setText('global-cue', india === 'OPEN' ? 'LIVE INTRADAY' : 'MARKET CLOSED / PREP');
  if ($('india-market-status')) $('india-market-status').textContent = india;
  if ($('us-market-status')) $('us-market-status').textContent = us;
  if ($('status-indicator')) $('status-indicator').className = india === 'OPEN' ? 'w-2 h-2 rounded-full bg-emerald-400 scan-dot' : 'w-2 h-2 rounded-full bg-slate-500';
}

function renderMarket(d) {
  const n = d?.india?.nifty, s = d?.india?.sensex, u = d?.us_markets || {}, g = d?.gift_nifty || {};
  if (n) { setText('level-nifty', num(n.value)); const c=$('level-nifty-change'); if(c){c.textContent=`${num(n.change)} pts • ${pct(n.change_pct)}`;c.className=`text-sm mt-1 ${tone(n.change_pct)}`;} }
  if (s) { setText('level-sensex', num(s.value)); const c=$('level-sensex-change'); if(c){c.textContent=`${num(s.change)} pts • ${pct(s.change_pct)}`;c.className=`text-sm mt-1 ${tone(s.change_pct)}`;} }
  setText('level-gift', num(g.value)); const gc=$('level-gift-change'); if(gc){gc.textContent=`${num(g.change)} pts • ${pct(g.change_pct)}`;gc.className=`text-sm mt-1 ${tone(g.change_pct)}`;}
  setText('gift-state', g.value == null ? 'FEED PENDING' : 'LIVE SNAPSHOT'); setText('gift-signal', g.signal || '--'); setText('gift-time', d?.updated_at || '--');
  const put=(id,o)=>{const x=$(id);if(!x)return;x.textContent=`${num(o?.value)} ${pct(o?.change_pct)}`;x.className=`metric-num text-lg font-bold mt-2 ${tone(o?.change_pct)}`;};
  put('us-dow',u.dow); put('us-sp',u.sp500); put('us-nasdaq',u.nasdaq); setText('us-data-time',d?.updated_at||'--');
  setText('global-source-status', d?.updated_at ? 'LIVE SNAPSHOT' : 'WAITING', d?.updated_at ? 'text-xs font-bold text-emerald-300' : 'text-xs font-bold text-amber-300');
}

function renderCall(report) {
  const trades=report?.trades||{}; const open=Object.entries(trades).filter(([,x])=>x?.status==='OPEN');
  setText('call-count', open.length);
  if(open.length){setText('call-status','CALL GIVEN','text-4xl md:text-5xl font-extrabold mt-4 text-emerald-300');setText('call-detail',open.slice(0,3).map(([s,x])=>`${s} ${x.direction||''}`.trim()).join(' • '),'text-slate-300 mt-2');setText('call-confidence',open[0][1].confidence||open[0][1].score||'HIGH');setText('call-bias',(open[0][1].direction||'').toUpperCase());}
  else {setText('call-status','WAIT','text-4xl md:text-5xl font-extrabold mt-4 text-yellow-300');setText('call-detail','Wait for the right movement to enter.','text-slate-400 mt-2');setText('call-confidence','--');setText('call-bias','NEUTRAL');}
  setText('ui-vix',typeof report?.market_context?.vix==='number'?report.market_context.vix.toFixed(2):'--'); setText('ui-sentiment',report?.market_context?.sentiment||'NEUTRAL'); setText('ui-oi-data',report?.market_context?.oi_summary||'No OI data');
}

function renderStocks(report) {
  const body=$('top-stocks-table'); if(!body)return; body.innerHTML=''; const stocks=Array.isArray(report?.top_stocks)?report.top_stocks.slice(0,10):[];
  if(!stocks.length){body.innerHTML='<tr><td colspan="7" class="px-5 py-8 text-center text-slate-600">No breakout data in report feed.</td></tr>';return;}
  stocks.forEach((s,i)=>{const tr=document.createElement('tr');[i+1,s.symbol||'--',num(s.price??s.ltp),s.volume??'--',s.score??'--',s.type||s.pressure||'--',s.setup||s.signal||'WATCH'].forEach((v,j)=>{const td=document.createElement('td');td.className=`px-5 py-3 ${j===0?'text-slate-600':j===1?'font-bold text-white':'text-right font-mono'}`;td.textContent=v;tr.appendChild(td)});body.appendChild(tr);});
}

async function getJSON(url){const r=await fetch(`${url}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json();}

async function load(){
  renderClock();
  try { renderMarket(await getJSON(MARKET_URL)); } catch(e) { console.warn('Market snapshot unavailable',e); setText('global-source-status','DATA OFFLINE','text-xs font-bold text-rose-300'); }
  try { const r=await getJSON(REPORT_URL); renderCall(r); renderStocks(r); setText('last-sync',new Date().toLocaleTimeString('en-IN',{hour12:false})); } catch(e) { console.warn('Report feed unavailable',e); setText('call-status','WAIT','text-4xl md:text-5xl font-extrabold mt-4 text-yellow-300'); setText('call-detail','Wait for the right movement to enter.','text-slate-400 mt-2'); }
}

function navigate(pageId){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));$(`page-${pageId}`)?.classList.add('active');$(`nav-${pageId}`)?.classList.add('active');load();}

window.addEventListener('DOMContentLoaded',()=>{renderClock();setText('call-status','WAIT','text-4xl md:text-5xl font-extrabold mt-4 text-yellow-300');setText('call-detail','Wait for the right movement to enter.','text-slate-400 mt-2');load();setInterval(load,30000);setInterval(renderClock,15000);});
