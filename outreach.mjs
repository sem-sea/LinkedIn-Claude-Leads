#!/usr/bin/env node
// Apollo-leads -> LinkedIn-profiel via Claude -> persoonlijk bericht -> outreachlijst.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { apolloSearch } from "./lib/apollo.mjs";
import { DEFAULT_MODEL, findLinkedin, usage, writeMessage } from "./lib/claude.mjs";
import { parseCsv } from "./lib/csv.mjs";
import { leadsFromCsvRows } from "./lib/leads.mjs";
import { renderCsv, renderHtml, toContact } from "./lib/output.mjs";

const HELP = `Gebruik:
  npm start -- leads.csv        Leads uit een Apollo CSV-export
  npm start -- --zoek           Zoek leads in Apollo met de filters uit config.json

Opties:
  --max 25                      Maximaal aantal nieuwe leads per keer
  --zonder-zoeken               LinkedIn-profielen niet opzoeken
  --config config.json          Ander instellingenbestand
  --uit output                  Andere uitvoermap`;

function loadEnv(file = ".env") {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function parseArgs(argv) {
  const a = { file: "", zoek: false, max: 0, zonderZoeken: false, config: "", uit: "output", help: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--zoek") a.zoek = true;
    else if (v === "--zonder-zoeken") a.zonderZoeken = true;
    else if (v === "--max") a.max = Number(argv[++i]);
    else if (v === "--config") a.config = argv[++i];
    else if (v === "--uit") a.uit = argv[++i];
    else if (v === "-h" || v === "--help") a.help = true;
    else if (!v.startsWith("-")) a.file = v;
  }
  return a;
}

export function loadConfig(path) {
  const file = path || (existsSync("config.json") ? "config.json" : "config.voorbeeld.json");
  const cfg = JSON.parse(readFileSync(file, "utf8"));
  const missing = ["afzender", "bericht", "sporen", "groepen", "standaardGroep"].filter((k) => !cfg[k]);
  if (missing.length) throw new Error(`${file} mist: ${missing.join(", ")}`);
  if (!cfg.groepen[cfg.standaardGroep]) throw new Error(`standaardGroep "${cfg.standaardGroep}" staat niet in groepen.`);
  for (const [k, g] of Object.entries(cfg.groepen)) {
    if (!cfg.sporen[g.spoor]) throw new Error(`Groep "${k}" verwijst naar onbekend spoor "${g.spoor}".`);
  }
  cfg.bericht.maxTekens = cfg.bericht.maxTekens === 200 ? 200 : 300;
  cfg.dagLimiet = Number(cfg.dagLimiet) > 0 ? Number(cfg.dagLimiet) : 25;
  return { cfg, file };
}

async function pool(items, size, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

export async function run(argv) {
  loadEnv();
  const args = parseArgs(argv);
  if (args.help || (!args.file && !args.zoek)) {
    console.log(HELP);
    return 0;
  }
  const { cfg, file: cfgFile } = loadConfig(args.config);
  if (cfgFile === "config.voorbeeld.json") console.log("Let op: config.json ontbreekt, ik gebruik config.voorbeeld.json.");

  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeKey) throw new Error("Zet ANTHROPIC_API_KEY in het bestand .env (zie .env.example).");
  const model = process.env.CLAUDE_MODEL || DEFAULT_MODEL;
  const max = args.max > 0 ? Math.floor(args.max) : Number(cfg.maxPerKeer) || 25;

  let leads;
  let bron;
  if (args.zoek) {
    const apolloKey = process.env.APOLLO_API_KEY;
    if (!apolloKey) throw new Error("Zet APOLLO_API_KEY in .env om in Apollo te zoeken, of gebruik een CSV-export.");
    console.log("Zoeken in Apollo (kost geen credits)...");
    leads = await apolloSearch(apolloKey, cfg.apollo ?? {}, max * 3);
    bron = "Apollo-zoekopdracht · LinkedIn";
  } else {
    if (!existsSync(args.file)) throw new Error(`Bestand niet gevonden: ${args.file}`);
    leads = leadsFromCsvRows(parseCsv(readFileSync(args.file, "utf8")));
    bron = "Apollo-export · LinkedIn";
  }

  const outDir = resolve(args.uit);
  mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, "outreach.json");
  const existing = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, "utf8")) : [];
  const known = new Set(existing.map((c) => c.id));
  const todo = leads.filter((l) => !known.has(l.id)).slice(0, max);

  console.log(`${leads.length} leads gelezen, ${todo.length} nieuw om te verwerken.`);
  const contacts = [...existing];
  const baseOrder = existing.reduce((m, c) => Math.max(m, c.order || 0), 0);
  for (const k of Object.keys(usage)) usage[k] = 0;

  const save = () => {
    contacts.sort((a, b) => (a.order || 0) - (b.order || 0));
    writeFileSync(jsonPath, JSON.stringify(contacts, null, 2) + "\n");
    writeFileSync(resolve(outDir, "outreach.csv"), renderCsv(contacts, cfg));
    writeFileSync(resolve(outDir, "outreach.html"), renderHtml(contacts, cfg, bron));
  };

  let found = 0;
  let failed = 0;
  let done = 0;
  let fatal = null;
  await pool(todo, 3, async (lead, i) => {
    if (fatal) return;
    try {
      let linkedin = lead.linkedin;
      let linkedinBron = linkedin ? "apollo" : "";
      let naam = "";
      if (!linkedin && !args.zonderZoeken) {
        const hit = await findLinkedin(claudeKey, model, lead);
        if (hit) {
          linkedin = hit.url;
          linkedinBron = `claude (${hit.zekerheid})`;
          if (lead.lastHidden && hit.naam && hit.naam.toLowerCase().startsWith(lead.first.toLowerCase())) naam = hit.naam;
        }
      }
      if (linkedin) found++;
      if (!lead.name && !naam) naam = [lead.first, lead.last].filter(Boolean).join(" ");
      const written = await writeMessage(claudeKey, model, { ...lead, name: naam || lead.name }, cfg);
      contacts.push(toContact({ ...lead, name: naam || lead.name }, { ...written, linkedin, linkedinBron, naam }, baseOrder + i + 1));
      save();
      const limit = cfg.bericht.type === "bericht" ? 700 : cfg.bericht.maxTekens;
      console.log(
        `[${++done}/${todo.length}] ${naam || lead.name}: ${linkedin ? `profiel ${linkedinBron}` : "geen profiel, zoek op naam"}, ` +
          `${cfg.groepen[written.seg].label}, ${written.msg.length}/${limit} tekens`,
      );
    } catch (e) {
      if (e.fatal) fatal = e;
      failed++;
      console.log(`[${++done}/${todo.length}] ${lead.name || lead.first}: overgeslagen (${e.message})`);
    }
  });
  if (fatal) throw fatal;
  save();

  const searchCost = (usage.searches * 0.01).toFixed(2);
  console.log("");
  console.log(`Klaar: ${todo.length - failed} leads toegevoegd, ${found} met LinkedIn-profiel, ${failed} overgeslagen.`);
  console.log(`Claude: ${usage.calls} aanroepen, ${usage.input} invoertokens, ${usage.output} uitvoertokens, ${usage.searches} zoekopdrachten ($${searchCost} zoekkosten).`);
  console.log(`Open ${resolve(outDir, "outreach.html")} in je browser.`);
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  run(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`Fout: ${e.message}`);
      process.exit(1);
    });
}
