import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { searchParams } from "../lib/apollo.mjs";
import { cleanMessage, lastJson, searchResultUrls } from "../lib/claude.mjs";
import { parseCsv, toCsv } from "../lib/csv.mjs";
import { leadFromApolloPerson, leadsFromCsvRows, normalizeLinkedin } from "../lib/leads.mjs";
import { renderHtml } from "../lib/output.mjs";
import { loadConfig, run } from "../outreach.mjs";
import { startMock } from "./mock-server.mjs";

test("parseCsv leest komma, puntkomma, quotes en BOM", () => {
  const rows = parseCsv('\uFEFFFirst Name,Title,Company Name\r\nSanne,"Head of Marketing, EMEA",Voorbeeld BV\r\n\r\n');
  assert.deepEqual(rows, [{ "First Name": "Sanne", Title: "Head of Marketing, EMEA", "Company Name": "Voorbeeld BV" }]);
  const semi = parseCsv('Naam;Functie\n"Mark ""MJ"" Jansen";CIO\n');
  assert.equal(semi[0].Naam, 'Mark "MJ" Jansen');
});

test("toCsv blokkeert formules en gebruikt puntkomma", () => {
  const csv = toCsv(["a", "b"], [["=SUM(1)", "x;y"]]);
  assert.ok(csv.includes("'=SUM(1)"));
  assert.ok(csv.includes('"x;y"'));
});

test("Apollo CSV-export wordt een lead met genormaliseerde LinkedIn-URL", () => {
  const rows = parseCsv(readFileSync(new URL("../input/voorbeeld-apollo.csv", import.meta.url), "utf8"));
  const leads = leadsFromCsvRows(rows);
  assert.equal(leads.length, 3);
  assert.equal(leads[0].id, "demo-001");
  assert.equal(leads[0].name, "Sanne de Vries");
  assert.equal(leads[0].company, "Voorbeeld Software BV");
  assert.equal(leads[0].loc, "Amsterdam, Netherlands");
  assert.equal(leads[2].linkedin, "https://www.linkedin.com/in/fatima-el-amrani-voorbeeld");
});

test("normalizeLinkedin accepteert alleen profielen op linkedin.com/in/", () => {
  assert.equal(normalizeLinkedin("nl.linkedin.com/in/Jan-Jansen/?x=1"), "https://www.linkedin.com/in/jan-jansen");
  assert.equal(normalizeLinkedin("https://www.linkedin.com/company/acme"), "");
  assert.equal(normalizeLinkedin("https://linkedin.com.evil.io/in/x"), "");
  assert.equal(normalizeLinkedin(""), "");
});

test("Apollo-zoekresultaat met afgeschermde achternaam", () => {
  const l = leadFromApolloPerson({ id: "1", first_name: "Joost", last_name_obfuscated: "Vi***r", title: "VP", organization: { name: "X" } });
  assert.equal(l.lastHidden, true);
  assert.equal(l.name, "Joost Vi***r");
});

test("searchParams bouwt de Apollo-query", () => {
  const p = searchParams({ functies: ["CMO", ""], senioriteit: ["c_suite"], locaties: ["Netherlands"], bedrijfsgrootte: ["51, 200"], trefwoorden: " SaaS " }, 2, 500);
  assert.deepEqual(p.getAll("person_titles[]"), ["CMO"]);
  assert.deepEqual(p.getAll("organization_num_employees_ranges[]"), ["51,200"]);
  assert.equal(p.get("q_keywords"), "SaaS");
  assert.equal(p.get("per_page"), "100");
  assert.equal(p.get("page"), "2");
});

test("lastJson vindt JSON tussen tekst en codeblokken", () => {
  assert.deepEqual(lastJson('Uitleg {niet} hier\n```json\n{"url": null, "zekerheid": "laag"}\n```'), { url: null, zekerheid: "laag" });
  assert.equal(lastJson("geen json"), null);
});

test("searchResultUrls neemt alleen echte zoekresultaten", () => {
  const urls = searchResultUrls([
    { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://nl.linkedin.com/in/a/" }] },
    { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
    { type: "text", text: "x", citations: [{ url: "https://www.linkedin.com/in/b" }] },
  ]);
  assert.deepEqual([...urls].sort(), ["https://www.linkedin.com/in/a", "https://www.linkedin.com/in/b"]);
});

test("cleanMessage haalt gedachtestreepjes weg", () => {
  assert.equal(cleanMessage('"AI \u2014 praktisch \u2013 en veilig"'), "AI, praktisch, en veilig");
});

test("renderHtml voorkomt dat data het script afsluit", () => {
  const { cfg } = loadConfig("config.voorbeeld.json");
  const html = renderHtml([{ id: "x", name: "</script><script>alert(1)</script>", first: "A", title: "", company: "", loc: "", seg: "bedrijf", prio: "B", icp: true, msg: "", linkedin: "", status: "todo", order: 1 }], cfg, "test");
  assert.equal(html.match(/<\/script>/g).length, 2);
  assert.ok(html.includes("\\u003c/script>"));
});

let mock;
let dir;
before(async () => {
  mock = await startMock();
  dir = mkdtempSync(join(tmpdir(), "outreach-"));
  process.env.ANTHROPIC_BASE_URL = `${mock.url}/claude`;
  process.env.APOLLO_BASE_URL = `${mock.url}/apollo`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.APOLLO_API_KEY = "apollo-test";
});
after(async () => {
  await mock.close();
  rmSync(dir, { recursive: true, force: true });
});

test("volledige run met een Apollo CSV-export", async () => {
  const log = console.log;
  console.log = () => {};
  try {
    await run(["input/voorbeeld-apollo.csv", "--config", "config.voorbeeld.json", "--uit", dir]);
  } finally {
    console.log = log;
  }
  const contacts = JSON.parse(readFileSync(join(dir, "outreach.json"), "utf8"));
  assert.equal(contacts.length, 3);
  const by = Object.fromEntries(contacts.map((c) => [c.first, c]));

  // Sanne: profiel via Claude gevonden, te lang bericht wordt ingekort, groep marketing.
  assert.equal(by.Sanne.linkedin, "https://www.linkedin.com/in/sanne-voorbeeld");
  assert.match(by.Sanne.linkedinBron, /^claude/);
  assert.equal(by.Sanne.seg, "marketing");
  assert.ok(by.Sanne.msg.length <= 300, `lengte ${by.Sanne.msg.length}`);

  // Mark: verzonnen URL staat niet in de resultaten en wordt geweigerd.
  assert.equal(by.Mark.linkedin, "");
  assert.equal(by.Mark.seg, "overheid");
  assert.equal(by.Mark.prio, "A");

  // Fatima: URL kwam al uit Apollo, Claude zoekt niet.
  assert.equal(by.Fatima.linkedinBron, "apollo");
  assert.equal(by.Fatima.seg, "bedrijf", "onbekende groep valt terug op standaardGroep");
  assert.ok(!by.Fatima.msg.includes("\u2014"));

  const searches = mock.calls.claude.filter((c) => c.tools);
  assert.equal(searches.length, 2, "alleen zoeken voor leads zonder URL");
  assert.equal(searches[0].tools[0].type, "web_search_20250305");
  assert.deepEqual(searches[0].tools[0].allowed_domains, ["linkedin.com"]);

  const html = readFileSync(join(dir, "outreach.html"), "utf8");
  assert.ok(html.includes("Sanne de Vries"));
  assert.ok(!html.includes("__DATA__"));
  const csv = readFileSync(join(dir, "outreach.csv"), "utf8");
  assert.ok(csv.startsWith("\uFEFFNaam;Functie;Bedrijf"));

  // Tweede run voegt niets dubbel toe.
  const before = mock.calls.claude.length;
  console.log = () => {};
  try {
    await run(["input/voorbeeld-apollo.csv", "--config", "config.voorbeeld.json", "--uit", dir]);
  } finally {
    console.log = log;
  }
  assert.equal(JSON.parse(readFileSync(join(dir, "outreach.json"), "utf8")).length, 3);
  assert.equal(mock.calls.claude.length, before);
});

test("volledige run met --zoek in Apollo, inclusief pause_turn en afgeschermde naam", async () => {
  const out = join(dir, "zoek");
  const log = console.log;
  console.log = () => {};
  try {
    await run(["--zoek", "--max", "5", "--config", "config.voorbeeld.json", "--uit", out]);
  } finally {
    console.log = log;
  }
  const contacts = JSON.parse(readFileSync(join(out, "outreach.json"), "utf8"));
  const joost = contacts.find((c) => c.first === "Joost");
  assert.equal(joost.linkedin, "https://www.linkedin.com/in/joostvisser-demo");
  assert.equal(joost.name, "Joost Visser", "volledige naam van het profiel vervangt de afgeschermde");
  const lisa = contacts.find((c) => c.first === "Lisa");
  assert.equal(lisa.icp, false);
  assert.ok(mock.calls.apollo[0].includes("person_titles%5B%5D=CMO"));
});

test("foute Claude-sleutel stopt direct met een duidelijke melding", async () => {
  process.env.ANTHROPIC_API_KEY = "fout";
  const log = console.log;
  console.log = () => {};
  try {
    await assert.rejects(run(["input/voorbeeld-apollo.csv", "--config", "config.voorbeeld.json", "--uit", join(dir, "fout")]), /weigert de sleutel/);
  } finally {
    console.log = log;
    process.env.ANTHROPIC_API_KEY = "test-key";
  }
});
