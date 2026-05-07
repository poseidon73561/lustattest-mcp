



/**
 * LUSTAT Remote MCP Server — Railway deployment
 * Dataset: DF_C1217 — Salaire mensuel moyen par secteur (NACE Rév.2) et niveau d'éducation
 * Transport: HTTP + SSE (Server-Sent Events) for remote MCP
 */
 
import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
 
const app  = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.MCP_API_KEY || null; // set in Railway environment variables
 
// ── Middleware ────────────────────────────────────────────────────────────────
 
app.use(cors());
app.use(express.json());
 
// API key authentication (skip if no key configured, for testing)
app.use((req, res, next) => {
  if (req.path === "/health") return next(); // health check always open
  if (!API_KEY) return next();               // no key set = open (dev mode)
  const provided = req.headers["x-api-key"] || req.query.apiKey;
  if (provided !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized — invalid or missing API key" });
  }
  next();
});
 
// ── Constants ─────────────────────────────────────────────────────────────────
 
const BASE_URL = "https://lustat.statec.lu/rest";
const AGENCY   = "LU1";
const DATAFLOW = "DF_C1217";
 
const NACE_SECTORS = {
  "_T":   "Total (all sectors)",
  "B-E":  "Industry (B–E)",
  "F":    "Construction",
  "G":    "Wholesale & retail trade",
  "H":    "Transportation & storage",
  "I":    "Accommodation & food service",
  "J":    "Information & communication",
  "K":    "Financial & insurance activities",
  "L_N":  "Real estate, professional & admin services",
  "M":    "Professional, scientific & technical activities",
  "O":    "Public administration & defence",
  "P":    "Education",
  "Q":    "Human health & social work",
  "R_S":  "Arts, entertainment & other services",
};
 
const EDUCATION_LEVELS = {
  "_T":    "Total (all levels)",
  "A4":    "All education levels combined",
  "ED0_2": "Less than primary to lower secondary (ISCED 0-2)",
  "ED3_4": "Upper secondary and post-secondary (ISCED 3-4)",
  "ED5_8": "Tertiary education (ISCED 5-8)",
};
 
// ── LUSTAT API helpers ────────────────────────────────────────────────────────
 
async function fetchLustatData(key, startPeriod = "2010", endPeriod = null) {
  const params = new URLSearchParams({ dimensionAtObservation: "AllDimensions" });
  if (startPeriod) params.set("startPeriod", startPeriod);
  if (endPeriod)   params.set("endPeriod", endPeriod);
 
  const url = `${BASE_URL}/data/${AGENCY},${DATAFLOW}/${key}?${params}`;
  console.log(`[LUSTAT] Fetching: ${url}`);
 
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.sdmx.data+csv;urn=true;file=true;labels=both",
    },
  });
 
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LUSTAT API error ${response.status}: ${text.slice(0, 200)}`);
  }
 
  return parseCSV(await response.text());
}
 
function parseCSV(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]?.replace(/"/g, "").trim() || ""; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
}
 
function splitCSVLine(line) {
  const result = []; let current = ""; let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += char; }
  }
  result.push(current);
  return result;
}
 
function formatRows(rows, limit = 100) {
  if (!rows.length) return "No data found for this query.";
  const sample = rows.slice(0, limit);
  const lines = sample.map(row => {
    const period = row["TIME_PERIOD"] || row["time_period"] || "";
    const value  = row["OBS_VALUE"]   || row["obs_value"]   || "";
    const sector = row["ACTIVITY"]    || row["NACE_R2"]     || "";
    const edu    = row["EDUCATION"]   || row["ISCED11"]     || "";
    const unit   = row["UNIT_MEASURE"]|| row["unit_measure"]|| "EUR";
    return `${period} | Sector: ${sector} | Education: ${edu} | ${value} ${unit}`;
  });
  if (rows.length > limit) lines.push(`\n... ${rows.length - limit} more rows (apply filters to narrow down)`);
  return lines.join("\n");
}
 
// ── Tool handlers ─────────────────────────────────────────────────────────────
 
async function handleGetWageData({ sector, education, startPeriod, endPeriod }) {
  const s   = sector     || "_T";
  const edu = education  || "A4";
  const key = `A.${edu}.${s}._T._T._T._T._T`;
  try {
    const rows = await fetchLustatData(key, startPeriod || "2010", endPeriod || null);
    return { content: [{ type: "text", text: [
      `## LUSTAT — Monthly Average Wages (DF_C1217)`,
      `**Sector:** ${NACE_SECTORS[s] || s} | **Education:** ${EDUCATION_LEVELS[edu] || edu}`,
      `**Period:** ${startPeriod || "2010"} → ${endPeriod || "latest"} | **Rows:** ${rows.length}`,
      "", formatRows(rows),
    ].join("\n") }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
}
 
async function handleCompareSectors({ education, year }) {
  const edu    = education || "A4";
  const period = year || "2022";
  const sectors = Object.keys(NACE_SECTORS).filter(s => s !== "_T").join("+");
  const key = `A.${edu}.${sectors}._T._T._T._T._T`;
  try {
    const rows = await fetchLustatData(key, period, period);
    const bySector = {};
    rows.forEach(row => {
      const s = row["ACTIVITY"] || row["NACE_R2"] || "";
      const v = parseFloat(row["OBS_VALUE"] || "0");
      if (!bySector[s] || v > 0) bySector[s] = v;
    });
    const sorted = Object.entries(bySector)
      .sort(([, a], [, b]) => b - a)
      .map(([code, val], i) =>
        `${String(i+1).padStart(2)}. ${(NACE_SECTORS[code] || code).padEnd(52)} ${val.toLocaleString("fr-LU")} EUR`
      );
    return { content: [{ type: "text", text: [
      `## Sector Ranking — Monthly Average Wages (${period})`,
      `**Education:** ${EDUCATION_LEVELS[edu] || edu}`, "",
      sorted.join("\n"),
    ].join("\n") }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
}
 
async function handleCompareEducation({ sector, year }) {
  const s      = sector || "_T";
  const period = year || "2022";
  const eduLevels = Object.keys(EDUCATION_LEVELS).filter(e => e !== "_T" && e !== "A4").join("+");
  const key = `A.${eduLevels}.${s}._T._T._T._T._T`;
  try {
    const rows = await fetchLustatData(key, period, period);
    const byEdu = {};
    rows.forEach(row => {
      const e = row["EDUCATION"] || row["ISCED11"] || "";
      const v = parseFloat(row["OBS_VALUE"] || "0");
      if (!byEdu[e]) byEdu[e] = v;
    });
    const sorted = Object.entries(byEdu)
      .sort(([, a], [, b]) => b - a)
      .map(([code, val]) =>
        `${(EDUCATION_LEVELS[code] || code).padEnd(62)} ${val.toLocaleString("fr-LU")} EUR`
      );
    return { content: [{ type: "text", text: [
      `## Education Level Comparison — Monthly Average Wages (${period})`,
      `**Sector:** ${NACE_SECTORS[s] || s}`, "",
      sorted.join("\n"),
    ].join("\n") }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
}
 
function handleListCodes() {
  return { content: [{ type: "text", text: [
    `## Available Codes — LUSTAT DF_C1217`,
    ``, `### NACE Rev.2 Sectors`,
    ...Object.entries(NACE_SECTORS).map(([k, v]) => `  ${k.padEnd(8)} ${v}`),
    ``, `### Education Levels (ISCED)`,
    ...Object.entries(EDUCATION_LEVELS).map(([k, v]) => `  ${k.padEnd(8)} ${v}`),
    ``, `### Notes`,
    `- Annual data from 2010 to present`,
    `- Unit: monthly average gross wages in EUR`,
    `- Source: STATEC Luxembourg / LUSTAT`,
  ].join("\n") }] };
}
 
// ── MCP Server factory ────────────────────────────────────────────────────────
// One server instance per SSE connection (required for SSE transport)
 
function createMCPServer() {
  const server = new Server(
    { name: "lustat-wages", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
 
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_wage_data",
        description: "Get time-series of monthly average wages from LUSTAT filtered by NACE sector and education level.",
        inputSchema: {
          type: "object",
          properties: {
            sector:      { type: "string", description: `NACE code. Options: ${Object.keys(NACE_SECTORS).join(", ")}` },
            education:   { type: "string", description: `Education code. Options: ${Object.keys(EDUCATION_LEVELS).join(", ")}` },
            startPeriod: { type: "string", description: "Start year e.g. '2015'" },
            endPeriod:   { type: "string", description: "End year e.g. '2023'" },
          },
        },
      },
      {
        name: "compare_sectors",
        description: "Rank all NACE sectors by monthly average wage for a given year and education level.",
        inputSchema: {
          type: "object",
          properties: {
            education: { type: "string", description: "Education level code. Default: A4" },
            year:      { type: "string", description: "Reference year e.g. '2022'" },
          },
        },
      },
      {
        name: "compare_education",
        description: "Compare monthly average wages across education levels for a given sector and year.",
        inputSchema: {
          type: "object",
          properties: {
            sector: { type: "string", description: "NACE sector code. Default: _T" },
            year:   { type: "string", description: "Reference year e.g. '2022'" },
          },
        },
      },
      {
        name: "list_codes",
        description: "List all valid sector and education level codes for the LUSTAT wage dataset.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));
 
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
      case "get_wage_data":     return handleGetWageData(args || {});
      case "compare_sectors":   return handleCompareSectors(args || {});
      case "compare_education": return handleCompareEducation(args || {});
      case "list_codes":        return handleListCodes();
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  });
 
  return server;
}
 
// ── Express routes ────────────────────────────────────────────────────────────
 
// Health check — Railway uses this to verify the service is alive
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "lustattest-mcp", dataset: "DF_C1217" });
});
 
// SSE endpoint — Claude connects here
const transports = {};
 
app.get("/mcp", async (req, res) => {
  console.log(`[MCP] New SSE connection from ${req.ip}`);
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
 
  res.on("close", () => {
    console.log(`[MCP] Connection closed: ${transport.sessionId}`);
    delete transports[transport.sessionId];
  });
 
  const server = createMCPServer();
  await server.connect(transport);
});
 
// Message endpoint — Claude sends tool calls here
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) {
    return res.status(404).json({ error: "Session not found" });
  }
  await transport.handlePostMessage(req, res);
});
 
// ── Start ─────────────────────────────────────────────────────────────────────
 
app.listen(PORT, () => {
  console.log(`LUSTAT MCP server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Auth: ${API_KEY ? "enabled" : "disabled (set MCP_API_KEY to enable)"}`);
});
 
