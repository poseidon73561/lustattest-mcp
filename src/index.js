/**
 * LUSTAT Remote MCP Server — Railway deployment
 * Dataset: DF_C1217 — Salaire mensuel moyen par secteur (NACE Rév.2) et niveau d'éducation
 * No SDK dependency — plain HTTP/SSE + JSON-RPC 2.0
 */

import express from "express";
import cors from "cors";

const app     = express();
const PORT = parseInt(process.env.PORT) || 8080;
const API_KEY = process.env.MCP_API_KEY || null;

app.use(cors());
app.use(express.json());
// Serve web interface inline — no public folder needed
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LUSTAT · Wage Explorer</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,wght@0,300;0,600;1,300&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0e0f;
    --surface: #111618;
    --border: #1e2729;
    --accent: #00e5a0;
    --accent2: #00b4ff;
    --text: #e8edef;
    --muted: #5a6b70;
    --danger: #ff4d6d;
    --card: #141a1c;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* Grid background */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(0,229,160,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,229,160,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  .container {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    position: relative;
    z-index: 1;
  }

  /* Header */
  header {
    border-bottom: 1px solid var(--border);
    padding-bottom: 2rem;
    margin-bottom: 2.5rem;
  }

  .logo {
    font-family: 'Fraunces', serif;
    font-size: 0.75rem;
    font-weight: 300;
    letter-spacing: 0.3em;
    color: var(--accent);
    text-transform: uppercase;
    margin-bottom: 0.75rem;
  }

  h1 {
    font-family: 'Fraunces', serif;
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  h1 span {
    font-style: italic;
    font-weight: 300;
    color: var(--accent);
  }

  .subtitle {
    margin-top: 0.75rem;
    color: var(--muted);
    font-size: 0.8rem;
    letter-spacing: 0.05em;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 2rem;
    border-bottom: 1px solid var(--border);
  }

  .tab {
    padding: 0.6rem 1.2rem;
    font-family: 'DM Mono', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    color: var(--muted);
    background: none;
    border: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.2s;
  }

  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  /* Panel */
  .panel { display: none; }
  .panel.active { display: block; }

  /* Controls grid */
  .controls {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .field label {
    display: block;
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 0.4rem;
  }

  .field select, .field input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    padding: 0.6rem 0.8rem;
    border-radius: 4px;
    outline: none;
    transition: border-color 0.2s;
    appearance: none;
    -webkit-appearance: none;
  }

  .field select:focus, .field input:focus {
    border-color: var(--accent);
  }

  /* Button */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.7rem 1.5rem;
    background: var(--accent);
    color: #000;
    font-family: 'DM Mono', monospace;
    font-size: 0.8rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:hover { background: #00ffb3; transform: translateY(-1px); }
  .btn:active { transform: translateY(0); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  .btn-row {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }

  /* Results */
  .result-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1.5rem;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .result-title {
    font-family: 'Fraunces', serif;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .result-meta {
    font-size: 0.7rem;
    color: var(--muted);
    letter-spacing: 0.05em;
  }

  /* Table */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    margin-top: 1rem;
  }

  .data-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
  }

  .data-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(30,39,41,0.6);
  }

  .data-table tr:hover td { background: rgba(0,229,160,0.03); }

  .val {
    color: var(--accent);
    font-weight: 500;
    text-align: right;
  }

  /* Bar chart */
  .bar-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(30,39,41,0.5);
  }

  .bar-label {
    font-size: 0.72rem;
    color: var(--text);
    width: 220px;
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-track {
    flex: 1;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    border-radius: 3px;
    transition: width 0.8s cubic-bezier(0.16,1,0.3,1);
  }

  .bar-val {
    font-size: 0.72rem;
    color: var(--accent);
    width: 90px;
    text-align: right;
    flex-shrink: 0;
  }

  /* Loading */
  .loading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .spinner {
    width: 16px; height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Error */
  .error-box {
    border: 1px solid var(--danger);
    background: rgba(255,77,109,0.05);
    border-radius: 4px;
    padding: 1rem;
    font-size: 0.8rem;
    color: var(--danger);
    margin-top: 1.5rem;
  }

  /* Status badge */
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    color: var(--muted);
  }

  .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--muted);
  }

  .dot.online { background: var(--accent); box-shadow: 0 0 6px var(--accent); }

  /* Responsive */
  @media (max-width: 600px) {
    .bar-label { width: 120px; font-size: 0.65rem; }
    .bar-val { width: 70px; font-size: 0.65rem; }
    .controls { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<div class="container">

  <header>
    <div class="logo">STATEC Luxembourg · LUSTAT</div>
    <h1>Wage <span>Explorer</span></h1>
    <div class="subtitle">DF_C1217 · Monthly average wages · NACE Rev.2 × Education level · 2010–present</div>
  </header>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('timeseries')">Time Series</button>
    <button class="tab" onclick="switchTab('sectors')">Compare Sectors</button>
    <button class="tab" onclick="switchTab('education')">Compare Education</button>
  </div>

  <!-- TIME SERIES -->
  <div id="tab-timeseries" class="panel active">
    <div class="controls">
      <div class="field">
        <label>Sector (NACE)</label>
        <select id="ts-sector"></select>
      </div>
      <div class="field">
        <label>Education Level</label>
        <select id="ts-edu"></select>
      </div>
      <div class="field">
        <label>From Year</label>
        <input type="number" id="ts-start" value="2010" min="2010" max="2024">
      </div>
      <div class="field">
        <label>To Year</label>
        <input type="number" id="ts-end" placeholder="latest" min="2010" max="2024">
      </div>
    </div>
    <div class="btn-row">
      <button class="btn" onclick="runTimeSeries()">▶ Run Query</button>
      <div class="status"><div class="dot online" id="status-dot"></div><span id="status-text">API online</span></div>
    </div>
    <div id="ts-result"></div>
  </div>

  <!-- COMPARE SECTORS -->
  <div id="tab-sectors" class="panel">
    <div class="controls">
      <div class="field">
        <label>Education Level</label>
        <select id="sec-edu"></select>
      </div>
      <div class="field">
        <label>Year</label>
        <input type="number" id="sec-year" value="2022" min="2010" max="2024">
      </div>
    </div>
    <div class="btn-row">
      <button class="btn" onclick="runSectors()">▶ Compare All Sectors</button>
    </div>
    <div id="sec-result"></div>
  </div>

  <!-- COMPARE EDUCATION -->
  <div id="tab-education" class="panel">
    <div class="controls">
      <div class="field">
        <label>Sector (NACE)</label>
        <select id="edu-sector"></select>
      </div>
      <div class="field">
        <label>Year</label>
        <input type="number" id="edu-year" value="2022" min="2010" max="2024">
      </div>
    </div>
    <div class="btn-row">
      <button class="btn" onclick="runEducation()">▶ Compare Education Levels</button>
    </div>
    <div id="edu-result"></div>
  </div>

</div>

<script>
const NACE = {
  "_T":"Total (all sectors)","B-E":"Industry (B–E)","F":"Construction",
  "G":"Wholesale & retail","H":"Transportation","I":"Accommodation & food",
  "J":"Information & communication","K":"Financial & insurance",
  "L_N":"Real estate & professional","M":"Scientific & technical",
  "O":"Public administration","P":"Education sector","Q":"Health & social work",
  "R_S":"Arts & other services"
};

const EDU = {
  "A4":"All levels combined",
  "ED0_2":"Primary & lower secondary (ISCED 0-2)",
  "ED3_4":"Upper secondary (ISCED 3-4)",
  "ED5_8":"Tertiary education (ISCED 5-8)"
};

// Populate selects
function populate(id, map, includeAll=false) {
  const sel = document.getElementById(id);
  if (includeAll) sel.innerHTML = \`<option value="_T">Total (all sectors)</option>\`;
  else sel.innerHTML = '';
  Object.entries(map).forEach(([k,v]) => {
    if (k==="_T") return;
    sel.innerHTML += \`<option value="\${k}">\${v}</option>\`;
  });
}

populate("ts-sector", NACE, true);
populate("ts-edu", EDU);
populate("sec-edu", EDU);
populate("edu-sector", NACE, true);

// Tab switching
function switchTab(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  event.target.classList.add('active');
}

// Call the Railway MCP server
async function callMCP(toolName, args) {
  const base = window.location.origin;
  let res, raw, data;
  try {
    res = await fetch(\`\${base}/messages\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc:'2.0', id:Date.now(), method:'tools/call', params:{name:toolName,arguments:args} })
    });
    raw = await res.text();
  } catch(e) { throw new Error(\`Network: \${e.message}\`); }
  console.log('[RAW]', raw.slice(0,500));
  if (!res.ok) throw new Error(\`HTTP \${res.status}: \${raw.slice(0,200)}\`);
  try { data = JSON.parse(raw); } catch(e) { throw new Error(\`Bad JSON: \${raw.slice(0,100)}\`); }
  if (data.error) throw new Error(data.error.message);
  const text = data.result?.content?.[0]?.text || '';
  if (!text) throw new Error(\`Empty result: \${raw.slice(0,300)}\`);
  return text;
}

// Parse raw text into rows
function parseTextToRows(text) {
  return text.split('\\n')
    .filter(l => l.includes('|'))
    .map(l => {
      const parts = l.split('|').map(s => s.trim());
      return parts;
    });
}

// Show loading
function showLoading(id) {
  document.getElementById(id).innerHTML = \`
    <div class="loading"><div class="spinner"></div>Querying LUSTAT API...</div>\`;
}

// Show error
function showError(id, msg) {
  document.getElementById(id).innerHTML = \`<div class="error-box">⚠ \${msg}</div>\`;
}

// TIME SERIES
async function runTimeSeries() {
  const sector = document.getElementById('ts-sector').value;
  const edu    = document.getElementById('ts-edu').value;
  const start  = document.getElementById('ts-start').value;
  const end    = document.getElementById('ts-end').value;

  showLoading('ts-result');
  try {
    const text = await callMCP('get_wage_data', {
      sector, education: edu,
      startPeriod: start,
      ...(end ? { endPeriod: end } : {})
    });

    const rows = parseTextToRows(text);
    if (!rows.length) { showError('ts-result', 'No data returned. Try different filters.'); return; }

    // Build chart — values over time
    const dataRows = rows.map(r => ({ year: r[0], val: parseFloat(r[3]) }))
      .filter(r => !isNaN(r.val) && r.year);
    const maxVal = Math.max(...dataRows.map(r => r.val));

    const sectorLabel = NACE[sector] || sector;
    const eduLabel = EDU[edu] || edu;

    document.getElementById('ts-result').innerHTML = \`
      <div class="result-card">
        <div class="result-header">
          <div class="result-title">\${sectorLabel}</div>
          <div class="result-meta">\${eduLabel} · \${start}\${end?'–'+end:' → latest'}</div>
        </div>
        \${dataRows.map(r => \`
          <div class="bar-row">
            <div class="bar-label">\${r.year}</div>
            <div class="bar-track"><div class="bar-fill" style="width:\${(r.val/maxVal*100).toFixed(1)}%"></div></div>
            <div class="bar-val">\${r.val.toLocaleString('fr-LU')} €</div>
          </div>\`).join('')}
      </div>\`;
  } catch(e) {
    showError('ts-result', e.message);
  }
}

// COMPARE SECTORS
async function runSectors() {
  const edu  = document.getElementById('sec-edu').value;
  const year = document.getElementById('sec-year').value;

  showLoading('sec-result');
  try {
    const text = await callMCP('compare_sectors', { education: edu, year });
    const lines = text.split('\\n').filter(l => l.match(/^\\s*\\d+\\./));

    const data = lines.map(l => {
      const match = l.match(/(\\d[\\d,.\\s]+)\\s*EUR/);
      const val = match ? parseFloat(match[1].replace(/[\\s,]/g,'').replace(',','.')) : 0;
      const label = l.replace(/^\\s*\\d+\\.\\s*/, '').replace(/[\\d,.\\s]+EUR.*/, '').trim();
      return { label, val };
    }).filter(r => r.val > 0);

    const maxVal = Math.max(...data.map(r => r.val));
    const eduLabel = EDU[edu] || edu;

    document.getElementById('sec-result').innerHTML = \`
      <div class="result-card">
        <div class="result-header">
          <div class="result-title">Sector Ranking \${year}</div>
          <div class="result-meta">\${eduLabel}</div>
        </div>
        \${data.map((r,i) => \`
          <div class="bar-row">
            <div class="bar-label" title="\${r.label}">\${i+1}. \${r.label}</div>
            <div class="bar-track"><div class="bar-fill" style="width:\${(r.val/maxVal*100).toFixed(1)}%"></div></div>
            <div class="bar-val">\${r.val.toLocaleString('fr-LU')} €</div>
          </div>\`).join('')}
      </div>\`;
  } catch(e) {
    showError('sec-result', e.message);
  }
}

// COMPARE EDUCATION
async function runEducation() {
  const sector = document.getElementById('edu-sector').value;
  const year   = document.getElementById('edu-year').value;

  showLoading('edu-result');
  try {
    const text = await callMCP('compare_education', { sector, year });
    const lines = text.split('\\n').filter(l => l.includes('EUR') && !l.startsWith('#'));

    const data = lines.map(l => {
      const match = l.match(/([\\d,.\\s]+)\\s*EUR/);
      const val = match ? parseFloat(match[1].replace(/[\\s]/g,'').replace(',','.')) : 0;
      const label = l.replace(/([\\d,.\\s]+)\\s*EUR.*/, '').trim();
      return { label, val };
    }).filter(r => r.val > 0);

    const maxVal = Math.max(...data.map(r => r.val));
    const sectorLabel = NACE[sector] || sector;

    document.getElementById('edu-result').innerHTML = \`
      <div class="result-card">
        <div class="result-header">
          <div class="result-title">Education Impact \${year}</div>
          <div class="result-meta">\${sectorLabel}</div>
        </div>
        \${data.map(r => \`
          <div class="bar-row">
            <div class="bar-label" title="\${r.label}">\${r.label}</div>
            <div class="bar-track"><div class="bar-fill" style="width:\${(r.val/maxVal*100).toFixed(1)}%"></div></div>
            <div class="bar-val">\${r.val.toLocaleString('fr-LU')} €</div>
          </div>\`).join('')}
      </div>\`;
  } catch(e) {
    showError('edu-result', e.message);
  }
}

// Check API status on load
(async () => {
  try {
    const r = await fetch('/health');
    const d = await r.json();
    if (d.status === 'ok') {
      document.getElementById('status-dot').className = 'dot online';
      document.getElementById('status-text').textContent = 'API online';
    }
  } catch(e) {
    document.getElementById('status-dot').className = 'dot';
    document.getElementById('status-text').textContent = 'API offline';
  }
})();
</script>
</body>
</html>
`;
app.get("/", (req,res) => res.setHeader("Content-Type","text/html").end(HTML_PAGE));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  if (!API_KEY) return next();
  const provided = req.headers["x-api-key"] || req.query.apiKey;
  if (provided !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
});

const NACE_SECTORS = {
  "_T":"Total (all sectors)","B-E":"Industry (B-E)","F":"Construction",
  "G":"Wholesale & retail","H":"Transportation","I":"Accommodation & food",
  "J":"Information & communication","K":"Financial & insurance",
  "L_N":"Real estate & professional","M":"Scientific & technical",
  "O":"Public administration","P":"Education","Q":"Health & social work",
  "R_S":"Arts & other services",
};

const EDUCATION_LEVELS = {
  "_T":"Total (all levels)","A4":"All levels combined",
  "ED0_2":"Primary & lower secondary (ISCED 0-2)",
  "ED3_4":"Upper secondary (ISCED 3-4)",
  "ED5_8":"Tertiary education (ISCED 5-8)",
};

async function fetchLustatData(key, startPeriod, endPeriod) {
  // Use 'all' as fallback if key fails
  const params = new URLSearchParams({ dimensionAtObservation: "AllDimensions" });
  if (startPeriod) params.set("startPeriod", startPeriod);
  if (endPeriod)   params.set("endPeriod", endPeriod);
  // Try multiple URL formats to find what works
  const formats = [
    `https://lustat.statec.lu/rest/data/LU1,DSD_ESS_EARN_M@DF_C1217,1.0/${key}?${params}`,
    `https://lustat.statec.lu/rest/data/LU1,DSD_ESS_EARN_M@DF_C1217/${key}?${params}`,
  ];
  const url = formats[0];
  console.log(`[LUSTAT] ${url}`);
  // 15 second timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let r, bodyText;
  try {
    r = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.sdmx.data+json",
        "Accept-Language": "en"
      }
    });
    bodyText = await r.text();
  } catch(fetchErr) {
    clearTimeout(timeout);
    console.log(`[FETCH ERROR] ${fetchErr.message}`);
    throw new Error(`Network error: ${fetchErr.message}`);
  }
  clearTimeout(timeout);
  console.log(`[HTTP] status=${r.status} len=${bodyText.length} preview="${bodyText.slice(0,300)}"`);
  if (!r.ok) throw new Error(`LUSTAT ${r.status}: ${bodyText.slice(0,200)}`);
  if (!bodyText.trim()) throw new Error("Empty response from LUSTAT");
  if (bodyText.trim().startsWith("{")) return parseJSON(bodyText);
  return parseCSV(bodyText);
}


function parseJSON(json) {
  try {
    const data = JSON.parse(json);
    const rows = [];
    // SDMX-JSON 2.0 format used by LUSTAT
    const dataset = data?.data?.dataSets?.[0] || data?.dataSets?.[0] || {};
    const obs = dataset.observations || dataset.series || {};
    // Dimensions can be in data.data.structure or data.structure
    const structure = data?.data?.structure || data?.structure || {};
    const dimList = structure?.dimensions?.observation 
      || structure?.dimensions?.dataSet
      || structure?.dimensions?.series
      || [];
    const attList = structure?.attributes?.observation || [];
    console.log(`[JSON] observations=${Object.keys(obs).length} dims=${dimList.map(d=>d.id).join(",")}`);
    console.log(`[JSON] structure keys=${Object.keys(structure).join(",")}`);
    console.log(`[JSON] dataset keys=${Object.keys(dataset).join(",")}`);
    // Also log raw structure for debugging
    if (dimList.length === 0) {
      console.log(`[JSON] full structure=${JSON.stringify(structure).slice(0,500)}`);
    }
    Object.entries(obs).forEach(([key, vals]) => {
      const indices = key.split(":").map(Number);
      const row = {};
      // Map dimension indices to values
      indices.forEach((idx, i) => {
        const dim = dimList[i];
        if (dim) {
          row[dim.id] = dim.values?.[idx]?.id || dim.values?.[idx]?.name || String(idx);
        } else {
          row[`DIM_${i}`] = String(idx);
        }
      });
      // OBS_VALUE is first element of vals array
      const obsVal = Array.isArray(vals) ? vals[0] : vals;
      row["OBS_VALUE"] = obsVal !== null && obsVal !== undefined ? String(obsVal) : "";
      rows.push(row);
    });
    if (rows.length > 0) console.log(`[JSON] row0: ${JSON.stringify(rows[0])}`);
    return rows;
  } catch(e) {
    console.log(`[JSON] parse error: ${e.message} stack=${e.stack?.slice(0,200)}`);
    return [];
  }
}
function parseCSV(csv) {
  const lines = csv.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  // Auto-detect separator: semicolon or comma
  const sep = lines[0].includes(";") ? ";" : ",";
  console.log(`[CSV] separator="${sep}", lines=${lines.length}, sample="${lines[0].slice(0,120)}"`);
  const headers = lines[0].split(sep).map(h => h.replace(/"/g,"").trim());
  console.log(`[CSV] headers: ${headers.join(" | ")}`);
  const rows = lines.slice(1).map(line => {
    const vals = splitLine(line, sep);
    const row = {};
    headers.forEach((h,i) => { row[h] = (vals[i]||"").replace(/"/g,"").trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v));
  if (rows.length > 0) console.log(`[CSV] row0: ${JSON.stringify(rows[0])}`);
  return rows;
}

function splitLine(line, sep=",") {
  const r=[]; let cur=""; let q=false;
  for(const c of line){ if(c==='"'){q=!q;}else if(c===sep&&!q){r.push(cur);cur="";}else{cur+=c;} }
  r.push(cur); return r;
}

function formatRows(rows) {
  if (!rows.length) return "No data found.";
  return rows.slice(0,100).map(row => {
    const p = row["TIME_PERIOD"]||"";
    const v = row["OBS_VALUE"]||"";
    const s = row["ACTIVITY"]||row["NACE_R2"]||"";
    const e = row["EDUCATION"]||row["ISCED11"]||"";
    return `${p} | ${s} | ${e} | ${v} EUR`;
  }).join("\n") + (rows.length>100 ? `\n...${rows.length-100} more rows` : "");
}

async function callTool(name, args={}) {
  // Helper: find column value case-insensitively
  function col(row, ...names) {
    for (const n of names) {
      const k = Object.keys(row).find(k => k.replace(/[^A-Z]/gi,"").toUpperCase() === n.replace(/[^A-Z]/gi,"").toUpperCase());
      if (k && row[k] && row[k].trim()) return row[k].trim();
    }
    return "";
  }

  if (name==="list_codes") return [
    "## LUSTAT DF_C1217 — Available Codes","","### NACE Sectors",
    ...Object.entries(NACE_SECTORS).map(([k,v])=>`  ${k.padEnd(8)} ${v}`),
    "","### Education Levels",
    ...Object.entries(EDUCATION_LEVELS).map(([k,v])=>`  ${k.padEnd(8)} ${v}`),
  ].join("\n");

  if (name==="get_wage_data") {
    const s=args.sector||"_T", edu=args.education||"A4";
    const eduKey = edu==="A4" ? "." : edu;
    const secKey = s==="_T" ? "." : s;
    const rows = await fetchLustatData("all", args.startPeriod||"2010", args.endPeriod||null);
    if (rows.length>0) console.log("[DEBUG HEADERS]", Object.keys(rows[0]).join(" | "));
    if (rows.length>0) console.log("[DEBUG ROW0]", JSON.stringify(rows[0]));
    // Try to find OBS_VALUE column
    const valKey = rows.length ? Object.keys(rows[0]).find(k=>k.toUpperCase().includes("OBS")||k.toUpperCase().includes("VALUE")||k.toUpperCase()==="WAGE") : "OBS_VALUE";
    const lines = rows.slice(0,50).map(r => {
      const period = col(r,"TIMEPERIOD","TIME","PERIOD","YEAR");
      const val = valKey ? r[valKey] : "";
      return `${period} | ${val} EUR`;
    });
    return [`## Monthly Wages — ${NACE_SECTORS[s]||s}`,`Education: ${EDUCATION_LEVELS[edu]||edu}`,`Rows: ${rows.length}`,"",lines.join("\n")].join("\n");
  }

  if (name==="compare_sectors") {
    const edu=args.education||"A4", yr=args.year||"2022";
    const rows=await fetchLustatData("all",yr,yr);
    if (rows.length>0) console.log("[DEBUG HEADERS]", Object.keys(rows[0]).join(" | "));
    if (rows.length>0) console.log("[DEBUG ROW0]", JSON.stringify(rows[0]));
    const valKey = rows.length ? Object.keys(rows[0]).find(k=>k.toUpperCase().includes("OBS")||k.toUpperCase().includes("VALUE")) : null;
    const map={};
    rows.forEach(r=>{
      const s=col(r,"ACTIVITY","NACE","NACER2","SECTOR");
      const v=parseFloat(valKey?r[valKey]:0);
      if(s&&v>100) { if(!map[s]||v>map[s]) map[s]=v; }
    });
    const sorted=Object.entries(map).sort(([,a],[,b])=>b-a)
      .map(([c,v],i)=>`${i+1}. ${(NACE_SECTORS[c]||c).padEnd(45)} ${v.toLocaleString()} EUR`);
    return [`## Sector Ranking ${yr}`,"",
      sorted.length?sorted.join("\n"):`Debug: ${rows.length} rows. Headers: ${rows.length?Object.keys(rows[0]).join(", "):""}`
    ].join("\n");
  }

  if (name==="compare_education") {
    const s=args.sector||"_T", yr=args.year||"2022";
    const rows=await fetchLustatData("all",yr,yr);
    if (rows.length>0) console.log("[DEBUG HEADERS]", Object.keys(rows[0]).join(" | "));
    if (rows.length>0) console.log("[DEBUG ROW0]", JSON.stringify(rows[0]));
    const valKey = rows.length ? Object.keys(rows[0]).find(k=>k.toUpperCase().includes("OBS")||k.toUpperCase().includes("VALUE")) : null;
    const map={};
    rows.forEach(r=>{
      const e=col(r,"EDUCATION","ISCED","EDU","EDUC");
      const v=parseFloat(valKey?r[valKey]:0);
      if(e&&v>100) { if(!map[e]||v>map[e]) map[e]=v; }
    });
    const sorted=Object.entries(map).sort(([,a],[,b])=>b-a)
      .map(([c,v])=>`${(EDUCATION_LEVELS[c]||c).padEnd(55)} ${v.toLocaleString()} EUR`);
    return [`## Education Comparison ${yr}`,`Sector: ${NACE_SECTORS[s]||s}`,"",
      sorted.length?sorted.join("\n"):`Debug: ${rows.length} rows. Headers: ${rows.length?Object.keys(rows[0]).join(", "):""}`
    ].join("\n");
  }

  throw new Error(`Unknown tool: ${name}`);
}

const TOOLS = [
  { name:"get_wage_data", description:"Time-series of monthly wages by sector and education level.",
    inputSchema:{type:"object",properties:{sector:{type:"string"},education:{type:"string"},startPeriod:{type:"string"},endPeriod:{type:"string"}}} },
  { name:"compare_sectors", description:"Rank all sectors by monthly wage for a given year.",
    inputSchema:{type:"object",properties:{education:{type:"string"},year:{type:"string"}}} },
  { name:"compare_education", description:"Compare wages across education levels for a sector and year.",
    inputSchema:{type:"object",properties:{sector:{type:"string"},year:{type:"string"}}} },
  { name:"list_codes", description:"List all valid sector and education codes.",
    inputSchema:{type:"object",properties:{}} },
];

async function handleMCP(body) {
  const {id, method, params} = body;
  if (method==="initialize") return {jsonrpc:"2.0",id,result:{protocolVersion:"2024-11-05",capabilities:{tools:{}},serverInfo:{name:"lustattest-mcp",version:"1.0.0"}}};
  if (method==="tools/list") return {jsonrpc:"2.0",id,result:{tools:TOOLS}};
  if (method==="tools/call") {
    try {
      const text = await callTool(params.name, params.arguments);
      return {jsonrpc:"2.0",id,result:{content:[{type:"text",text}]}};
    } catch(err) {
      return {jsonrpc:"2.0",id,result:{content:[{type:"text",text:`Error: ${err.message}`}],isError:true}};
    }
  }
  if (method==="notifications/initialized") return null;
  return {jsonrpc:"2.0",id,error:{code:-32601,message:`Method not found: ${method}`}};
}

app.get("/health", (req,res) => res.json({status:"ok",service:"lustattest-mcp",dataset:"DF_C1217"}));

app.get("/mcp", (req,res) => {
  console.log(`[MCP] SSE connection`);
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.setHeader("Connection","keep-alive");
  res.flushHeaders();
  const base = `${req.protocol}://${req.get("host")}`;
  res.write(`event: endpoint\ndata: ${base}/messages\n\n`);
  req.on("close", () => console.log("[MCP] SSE closed"));
});

app.post("/messages", async (req,res) => {
  console.log(`[MSG] method=${req.body?.method} tool=${req.body?.params?.name||""}`);
  try {
    const result = await handleMCP(req.body);
    if (result===null) return res.status(204).end();
    res.json(result);
  } catch(err) {
    console.log(`[MSG ERROR] ${err.message}`);
    res.status(500).json({jsonrpc:"2.0",error:{code:-32603,message:err.message}});
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LUSTAT MCP running on port ${PORT}`);
  console.log(`Auth: ${API_KEY?"enabled":"disabled"}`);
});
