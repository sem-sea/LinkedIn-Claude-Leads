// Claude Messages API: LinkedIn-profiel zoeken (web search) en het bericht schrijven.
import { normalizeLinkedin } from "./leads.mjs";

const API = () => (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com") + "/v1/messages";
export const DEFAULT_MODEL = "claude-sonnet-5-5";

export const usage = { calls: 0, input: 0, output: 0, searches: 0 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(apiKey, body) {
  const waits = [2000, 6000, 15000];
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API(), {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.ok) return res.json();
    const retry = res.status === 429 || res.status === 529 || res.status >= 500;
    if (retry && attempt < waits.length) {
      const after = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : waits[attempt]);
      continue;
    }
    let detail = "";
    try {
      detail = (await res.json())?.error?.message ?? "";
    } catch {}
    const fail = (message) => Object.assign(new Error(message), { fatal: [400, 401, 403, 404].includes(res.status) });
    if (res.status === 401) throw fail("Claude weigert de sleutel. Controleer ANTHROPIC_API_KEY.");
    if (res.status === 400 && /web.?search/i.test(detail)) {
      throw fail("Web search staat uit voor je Claude-organisatie. Een beheerder zet hem aan in de Claude Console.");
    }
    throw fail(`Claude gaf foutcode ${res.status}${detail ? `: ${detail}` : ""}`);
  }
}

/** Roept Claude aan en gaat door bij pause_turn (lange zoekacties). */
export async function callClaude(apiKey, { model, system, messages, tools, maxTokens = 1024 }) {
  const convo = [...messages];
  const content = [];
  for (let round = 0; round < 4; round++) {
    const json = await post(apiKey, { model, max_tokens: maxTokens, system, messages: convo, ...(tools ? { tools } : {}) });
    usage.calls++;
    usage.input += json.usage?.input_tokens ?? 0;
    usage.output += json.usage?.output_tokens ?? 0;
    usage.searches += json.usage?.server_tool_use?.web_search_requests ?? 0;
    content.push(...(json.content ?? []));
    if (json.stop_reason !== "pause_turn") break;
    convo.push({ role: "assistant", content: json.content });
  }
  return content;
}

export function textOf(content) {
  return content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
}

/** Pakt het laatste JSON-object uit een tekst, ook als er uitleg of codeblokken omheen staan. */
export function lastJson(text) {
  const end = text.lastIndexOf("}");
  if (end < 0) return null;
  for (let i = end; i >= 0; i--) {
    if (text[i] !== "{") continue;
    try {
      return JSON.parse(text.slice(i, end + 1));
    } catch {}
  }
  return null;
}

/** Alle URL's die de zoekfunctie echt heeft teruggegeven. */
export function searchResultUrls(content) {
  const urls = new Set();
  for (const b of content) {
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) {
        const u = normalizeLinkedin(r.url);
        if (u) urls.add(u);
      }
    }
    if (b.type === "text" && Array.isArray(b.citations)) {
      for (const c of b.citations) {
        const u = normalizeLinkedin(c.url);
        if (u) urls.add(u);
      }
    }
  }
  return urls;
}

function personLine(lead) {
  const last = lead.lastHidden
    ? `afgeschermd in Apollo (${lead.last}); de eerste en laatste letter kloppen`
    : lead.last || "onbekend";
  return [
    `Voornaam: ${lead.first}`,
    `Achternaam: ${last}`,
    `Functie: ${lead.title || "onbekend"}`,
    `Organisatie: ${lead.company || "onbekend"}`,
    lead.loc ? `Locatie: ${lead.loc}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Zoekt het LinkedIn-profiel. Een URL telt alleen als hij echt in de zoekresultaten stond,
 * zodat Claude geen profiel kan verzinnen.
 */
export async function findLinkedin(apiKey, model, lead) {
  const content = await callClaude(apiKey, {
    model,
    maxTokens: 800,
    system:
      "Je zoekt het openbare LinkedIn-profiel van één persoon met de zoekfunctie. " +
      "Kies alleen een profiel als voornaam en organisatie of functie duidelijk overeenkomen. Verzin nooit een URL. " +
      'Sluit af met één regel JSON: {"url": "https://www.linkedin.com/in/..." of null, "naam": "volledige naam zoals op het profiel", "zekerheid": "hoog" of "middel" of "laag"}',
    messages: [{ role: "user", content: `Zoek het LinkedIn-profiel van deze persoon:\n${personLine(lead)}` }],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3, allowed_domains: ["linkedin.com"] }],
  });
  const answer = lastJson(textOf(content));
  const url = normalizeLinkedin(answer?.url);
  if (!url) return null;
  if (!searchResultUrls(content).has(url)) return null;
  const zekerheid = ["hoog", "middel", "laag"].includes(answer.zekerheid) ? answer.zekerheid : "laag";
  if (zekerheid === "laag") return null;
  const naam = typeof answer.naam === "string" ? answer.naam.trim().slice(0, 120) : "";
  return { url, naam, zekerheid };
}

export function cleanMessage(text) {
  return String(text ?? "")
    .replace(/\s*[\u2014\u2013]\s*/g, ", ")
    .replace(/ ,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
}

function writerSystem(cfg) {
  const b = cfg.bericht;
  const a = cfg.afzender;
  const kind =
    b.type === "bericht"
      ? "een LinkedIn-bericht aan een bestaande connectie, maximaal 700 tekens"
      : `een notitie bij een LinkedIn-connectieverzoek, maximaal ${b.maxTekens} tekens inclusief aanhef en groet`;
  const groups = Object.entries(cfg.groepen)
    .map(([k, g]) => `- ${k}: ${g.label}. Wie: ${g.wie}. Wat ik ze bied: ${g.aanbod}`)
    .join("\n");
  return [
    `Je schrijft namens ${a.naam} (${a.wie}) ${kind}.`,
    "",
    "Kies eerst de groep die het best past bij de ontvanger:",
    groups,
    "",
    "Prioriteit A als de ontvanger beslisser is en de groep sterk past, anders B.",
    "Zet icp op false als geen enkele groep echt past.",
    "",
    "Opbouw van het bericht:",
    `- Begin met: ${b.aanhef}`,
    `- Dan een witregel en: ${b.opening}`,
    "- Eén of twee zinnen die passen bij de functie en de organisatie, dan één duidelijke vraag.",
    `- Sluit af met een witregel en: ${b.afsluiting.replaceAll("{mijnnaam}", a.naam.split(" ")[0])}`,
    `Bewijs dat je mag noemen als het past: ${a.bewijs}`,
    `Schrijfregels: ${a.schrijfregels}`,
    "Verzin geen feiten over de ontvanger. Gebruik alleen de gegevens die je krijgt.",
    "",
    'Antwoord alleen met JSON: {"groep": "sleutel", "prioriteit": "A" of "B", "icp": true of false, "bericht": "de tekst"}',
  ].join("\n");
}

/** Kiest de groep en schrijft het bericht in de stijl uit config.json. */
export async function writeMessage(apiKey, model, lead, cfg) {
  const system = writerSystem(cfg);
  const first = { role: "user", content: `Ontvanger:\n${personLine({ ...lead, lastHidden: false })}` };
  let content = await callClaude(apiKey, { model, system, messages: [first], maxTokens: 900 });
  let answer = lastJson(textOf(content)) ?? {};
  let msg = cleanMessage(answer.bericht).replaceAll("{voornaam}", lead.first);
  const limit = cfg.bericht.type === "bericht" ? 700 : cfg.bericht.maxTekens;
  if (msg.length > limit) {
    content = await callClaude(apiKey, {
      model,
      system,
      maxTokens: 900,
      messages: [
        first,
        { role: "assistant", content: textOf(content) || JSON.stringify(answer) },
        { role: "user", content: `Het bericht is ${msg.length} tekens. Maak het korter dan ${limit} tekens met behoud van aanhef, kern en groet. Antwoord weer alleen met de JSON.` },
      ],
    });
    const shorter = lastJson(textOf(content));
    if (shorter?.bericht) {
      answer = { ...answer, ...shorter };
      msg = cleanMessage(shorter.bericht).replaceAll("{voornaam}", lead.first);
    }
  }
  const seg = cfg.groepen[answer.groep] ? answer.groep : cfg.standaardGroep;
  return {
    seg,
    prio: answer.prioriteit === "A" ? "A" : "B",
    icp: answer.icp !== false,
    msg,
  };
}
