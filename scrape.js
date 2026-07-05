// Scrapes daily Bitcoin spot ETF net flows from farside.co.uk/btc/
// Writes data/etf-flows.json. No dependencies, Node 18+.
"use strict";
const fs = require("fs");
const path = require("path");

async function main() {
  const res = await fetch("https://farside.co.uk/btc/", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
  });
  if (!res.ok) throw new Error("Farside HTTP " + res.status);
  const html = await res.text();

  const tableMatch = html.match(/<table class="etf"[\s\S]*?<\/table>/);
  if (!tableMatch) throw new Error("ETF table not found in page");
  const table = tableMatch[0];

  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];
  const flows = [];
  const strip = (s) => s.replace(/<[^>]+>|&nbsp;/g, "").trim();

  for (const r of rows) {
    const cells = [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1]));
    if (cells.length < 2) continue;
    const dateMatch = cells[0].match(/^(\d{2}) (\w{3}) (\d{4})$/);
    if (!dateMatch) continue; // skip header/summary rows
    let raw = cells[cells.length - 1].replace(/,/g, "");
    let neg = false;
    const paren = raw.match(/^\((.*)\)$/);
    if (paren) { neg = true; raw = paren[1]; }
    const val = parseFloat(raw);
    if (isNaN(val)) continue;
    const months = { Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",
      Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12" };
    const iso = dateMatch[3] + "-" + months[dateMatch[2]] + "-" + dateMatch[1];
    flows.push({ date: iso, totalUsdM: neg ? -val : val });
  }

  if (!flows.length) throw new Error("No date rows parsed");
  flows.sort((a, b) => a.date.localeCompare(b.date));
  const latest = flows[flows.length - 1];

  const out = {
    source: "farside.co.uk/btc/",
    unit: "USD millions",
    updatedAt: new Date().toISOString(),
    latest: latest,
    recent: flows.slice(-15),
  };

  const dir = path.join(__dirname, "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "etf-flows.json"), JSON.stringify(out, null, 2));
  console.log("Wrote data/etf-flows.json, latest:", latest.date, latest.totalUsdM);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
