// Schrijft outreach.json (zelfde velden als de Netwerk Outreach-lijst), outreach.csv en outreach.html.
import { readFileSync } from "node:fs";
import { toCsv } from "./csv.mjs";

const TEMPLATE = new URL("../template.html", import.meta.url);

/** Contact in het format van de Netwerk Outreach-lijst, plus bedrijf en LinkedIn-URL. */
export function toContact(lead, result, order) {
  return {
    id: lead.id,
    name: result.naam || lead.name,
    first: lead.first,
    title: lead.title,
    company: lead.company,
    loc: lead.loc,
    seg: result.seg,
    prio: result.prio,
    icp: result.icp,
    msg: result.msg,
    linkedin: result.linkedin || "",
    linkedinBron: result.linkedinBron || "",
    status: "todo",
    order,
  };
}

export function renderHtml(contacts, cfg, bron) {
  const data = {
    bron,
    sporen: cfg.sporen,
    groepen: Object.fromEntries(
      Object.entries(cfg.groepen).map(([k, g]) => [k, { label: g.label, spoor: g.spoor, sjabloon: g.sjabloon ?? "" }]),
    ),
    dagLimiet: cfg.dagLimiet,
    maxTekens: cfg.bericht.type === "bericht" ? 700 : cfg.bericht.maxTekens,
    contacts,
  };
  // "<" escapen voorkomt dat tekst uit Apollo het script-blok kan afsluiten.
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .split(String.fromCharCode(0x2028)).join("\\u2028")
    .split(String.fromCharCode(0x2029)).join("\\u2029");
  return readFileSync(TEMPLATE, "utf8").replace("__DATA__", () => json);
}

export function renderCsv(contacts, cfg) {
  const header = ["Naam", "Functie", "Bedrijf", "Locatie", "Groep", "Spoor", "Prioriteit", "Binnen ICP", "LinkedIn", "Bericht", "Tekens"];
  const rows = contacts.map((c) => {
    const g = cfg.groepen[c.seg];
    return [c.name, c.title, c.company, c.loc, g?.label ?? c.seg, cfg.sporen[g?.spoor] ?? "", c.prio, c.icp ? "ja" : "nee", c.linkedin, c.msg, c.msg.length];
  });
  return toCsv(header, rows);
}
