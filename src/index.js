/**
 * LUSTAT Remote MCP Server — Railway deployment
 * Dataset: DF_C1217 — Monthly wages by NACE sector and education level
 * No SDK dependency — plain HTTP/SSE + JSON-RPC 2.0
 */

import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);
const app     = express();
const PORT    = parseInt(process.env.PORT) || 8080;
const API_KEY = process.env.MCP_API_KEY || null;

app.use(cors());
app.use(express.json());
// Try multiple paths for the public folder
import { existsSync } from "fs";
const publicPaths = [
  join(__dir, "..", "public"),
  join(__dir, "public"),
  "/app/public",
];
const publicPath = publicPaths.find(p => existsSync(p)) || publicPaths[0];
console.log(`[STATIC] serving from: ${publicPath}`);
app.use(express.static(publicPath));

app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/" || req.path.endsWith(".html")) return next();
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
  "O":"Public administration","P":"Education sector","Q":"Health & social work",
  "R_S":"Arts & other services",
};

const EDUCATION_LEVELS = {
  "_T":    "Total (all levels)",
  "ED0_2": "Primary & lower secondary (ISCED 0-2)",
  "ED3_4": "Upper secondary (ISCED 3-4)",
  "ED5_8": "Tertiary education (ISCED 5-8)",
};

async function fetchLustatData(key, startPeriod, endPeriod) {
  const params = new URLSearchParams({ dimensionAtObservation: "AllDimensions" });
  if (startPeriod) params.set("startPeriod", startPeriod);
  if (endPeriod)   params.set("endPeriod", endPeriod);
  const url = `https://lustat.statec.lu/rest/data/LU1,DSD_ESS_EARN_M@DF_C1217,1.0/${key}?${params}`;
  console.log(`[LUSTAT] ${url}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let r, bodyText;
  try {
    r = await fetch(url, { signal: controller.signal, headers: { Accept: "application/vnd.sdmx.data+json", "Accept-Language": "en" } });
    bodyText = await r.text();
  } catch(e) { clearTimeout(timeout); throw new Error(`Network: ${e.message}`); }
  clearTimeout(timeout);
  console.log(`[HTTP] status=${r.status} len=${bodyText.length}`);
  if (!r.ok) throw new Error(`LUSTAT ${r.status}: ${bodyText.slice(0,200)}`);
  return parseSDMX(bodyText);
}

function parseSDMX(json) {
  try {
    const data = JSON.parse(json);
    const dataset = data?.data?.dataSets?.[0] || data?.dataSets?.[0] || {};
    const obs = dataset.observations || {};
    const structure = data?.data?.structures?.[0] || dataset.structure || {};
    const dimList = structure?.dimensions?.observation || [];
    console.log(`[JSON] observations=${Object.keys(obs).length} dims=${dimList.map(d=>d.id).join(",")}`);
    const rows = [];
    Object.entries(obs).forEach(([key, vals]) => {
      const indices = key.split(":").map(Number);
      const row = {};
      indices.forEach((idx, i) => {
        const dim = dimList[i];
        if (dim) row[dim.id] = dim.values?.[idx]?.id || String(idx);
        else row[`DIM_${i}`] = String(idx);
      });
      row["OBS_VALUE"] = Array.isArray(vals) ? String(vals[0] ?? "") : String(vals ?? "");
      rows.push(row);
    });
    if (rows.length > 0) console.log(`[JSON] row0: ${JSON.stringify(rows[0])}`);
    return rows;
  } catch(e) {
    console.log(`[JSON] error: ${e.message}`);
    return [];
  }
}

async function callTool(name, args={}) {
  if (name==="list_codes") return [
    "## LUSTAT DF_C1217 — Available Codes","","### NACE Rev.2 Sectors",
    ...Object.entries(NACE_SECTORS).map(([k,v])=>`  ${k.padEnd(8)} ${v}`),
    "","### Education Levels (ISCED)",
    ...Object.entries(EDUCATION_LEVELS).map(([k,v])=>`  ${k.padEnd(8)} ${v}`),
  ].join("\n");

  if (name==="get_wage_data") {
    const s=args.sector||"_T", edu=args.education||"_T";
    const rows = await fetchLustatData("all", args.startPeriod||"2010", args.endPeriod||null);
    const filtered = rows.filter(r => {
      const sMatch = s==="_T" || r.NACE_R2===s;
      const eMatch = edu==="_T" || r.EDUC_LEVEL===edu;
      return sMatch && eMatch;
    });
    const lines = filtered.map(r =>
      `${r.TIME_PERIOD} | ${r.NACE_R2} | ${r.EDUC_LEVEL} | ${parseFloat(r.OBS_VALUE).toLocaleString("fr-LU")} EUR`
    );
    return [`## Monthly Wages — ${NACE_SECTORS[s]||s}`,`Education: ${EDUCATION_LEVELS[edu]||edu}`,`Rows: ${filtered.length}`,"",lines.join("\n")].join("\n");
  }

  if (name==="compare_sectors") {
    const edu=args.education||"_T", yr=args.year||"2022";
    const rows = await fetchLustatData("all", yr, yr);
    const map={};
    rows.forEach(r => {
      const eMatch = edu==="_T" || r.EDUC_LEVEL===edu;
      const v=parseFloat(r.OBS_VALUE);
      if(r.NACE_R2&&v>0&&eMatch) { if(!map[r.NACE_R2]||v>map[r.NACE_R2]) map[r.NACE_R2]=v; }
    });
    const sorted=Object.entries(map).sort(([,a],[,b])=>b-a)
      .map(([c,v],i)=>`${i+1}. ${(NACE_SECTORS[c]||c).padEnd(45)} ${v.toLocaleString("fr-LU")} EUR`);
    return [`## Sector Ranking ${yr}`,`Education: ${EDUCATION_LEVELS[edu]||edu}`,"",sorted.join("\n")].join("\n");
  }

  if (name==="compare_education") {
    const s=args.sector||"_T", yr=args.year||"2022";
    const rows = await fetchLustatData("all", yr, yr);
    const map={};
    rows.forEach(r => {
      const sMatch = s==="_T" || r.NACE_R2===s;
      const v=parseFloat(r.OBS_VALUE);
      if(r.EDUC_LEVEL&&v>0&&sMatch) { if(!map[r.EDUC_LEVEL]||v>map[r.EDUC_LEVEL]) map[r.EDUC_LEVEL]=v; }
    });
    const sorted=Object.entries(map).sort(([,a],[,b])=>b-a)
      .map(([c,v])=>`${(EDUCATION_LEVELS[c]||c).padEnd(55)} ${v.toLocaleString("fr-LU")} EUR`);
    return [`## Education Comparison ${yr}`,`Sector: ${NACE_SECTORS[s]||s}`,"",sorted.join("\n")].join("\n");
  }

  throw new Error(`Unknown tool: ${name}`);
}

const TOOLS = [
  { name:"get_wage_data", description:"Time-series of monthly wages by NACE sector and education level.",
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
