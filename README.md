# LUSTAT Wages — Remote MCP Server (Railway)

Remote MCP server for **LUSTAT DF_C1217**: monthly average wages by NACE sector and education level (Luxembourg / STATEC).

---

## Deploy to Railway — Step by Step

### 1. Create a GitHub repository

```bash
git init
git add .
git commit -m "Initial commit"
# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/lustat-mcp.git
git push -u origin main
```

### 2. Deploy on Railway

1. Go to https://railway.app and sign in (free account)
2. Click **New Project → Deploy from GitHub repo**
3. Select your `lustat-mcp` repository
4. Railway auto-detects Node.js and deploys automatically

### 3. Set environment variables

In Railway dashboard → your project → **Variables**, add:

| Variable | Value | Required |
|----------|-------|----------|
| `MCP_API_KEY` | any strong secret string | Recommended |
| `PORT` | (leave empty — Railway sets this) | Auto |

### 4. Get your public URL

In Railway dashboard → your project → **Settings → Domains**,
click **Generate Domain**. You get a URL like:
```
https://lustat-mcp-production.up.railway.app
```

### 5. Test the deployment

```bash
# Health check (no auth needed)
curl https://lustat-mcp-production.up.railway.app/health

# Expected response:
# {"status":"ok","service":"lustat-mcp","dataset":"DF_C1217"}
```

---

## Connect Claude Desktop to your remote MCP

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "lustat-wages": {
      "url": "https://lustat-mcp-production.up.railway.app/mcp",
      "headers": {
        "x-api-key": "YOUR_MCP_API_KEY"
      }
    }
  }
}
```

Restart Claude Desktop. The LUSTAT tools are now available to anyone
you share the URL and API key with — no local installation needed.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `get_wage_data` | Time series by sector + education level |
| `compare_sectors` | Rank all sectors by wage for a given year |
| `compare_education` | Compare wages across education levels |
| `list_codes` | List all valid filter codes |

### Example prompts in Claude

- *"Which sector pays the most in Luxembourg in 2022?"*
- *"Show me wage trends in finance from 2010 to 2023"*
- *"How much does a university degree affect wages in construction?"*
- *"Compare wages across education levels overall"*

---

## NACE Sector Codes

| Code | Sector |
|------|--------|
| `_T` | Total all sectors |
| `B-E` | Industry |
| `F` | Construction |
| `G` | Wholesale & retail |
| `H` | Transportation |
| `I` | Accommodation & food |
| `J` | Information & communication |
| `K` | Financial & insurance |
| `L_N` | Real estate & professional services |
| `M` | Scientific & technical |
| `O` | Public administration |
| `P` | Education |
| `Q` | Health & social work |
| `R_S` | Arts & other services |

## Education Codes

| Code | Level |
|------|-------|
| `A4` | All levels |
| `ED0_2` | Primary & lower secondary (ISCED 0-2) |
| `ED3_4` | Upper secondary (ISCED 3-4) |
| `ED5_8` | Tertiary (ISCED 5-8) |

---

## Data Source

- **Provider:** STATEC Luxembourg
- **API:** `https://lustat.statec.lu/rest/` (SDMX 2.1)
- **Dataflow:** `DF_C1217`
- **Frequency:** Annual
- **Coverage:** 2010 – present
- **Unit:** Monthly average gross wages, EUR
