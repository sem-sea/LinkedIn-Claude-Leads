// Zet Apollo-data (CSV-export of API) om naar één leadformaat.

const key = (h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES = {
  id: ["apollocontactid", "apollorecordid", "apolloid", "personid", "id"],
  first: ["firstname", "voornaam"],
  last: ["lastname", "achternaam"],
  name: ["name", "fullname", "naam"],
  title: ["title", "jobtitle", "functie"],
  company: ["companyname", "company", "organizationname", "organization", "bedrijf", "accountname"],
  linkedin: ["personlinkedinurl", "linkedinurl", "linkedinprofile", "linkedin"],
  city: ["city", "plaats", "stad"],
  state: ["state", "provincie", "region"],
  country: ["country", "land"],
  seniority: ["seniority", "senioriteit"],
  departments: ["departments", "department", "afdeling"],
  industry: ["industry", "branche"],
  employees: ["employees", "numberofemployees", "companysize", "medewerkers"],
};

function pick(row, field) {
  const map = row.__keys ?? (row.__keys = Object.fromEntries(Object.keys(row).map((h) => [key(h), h])));
  for (const a of ALIASES[field]) {
    const h = map[a];
    if (h && String(row[h] ?? "").trim()) return String(row[h]).trim();
  }
  return "";
}

/** Alleen echte profiel-URL's op linkedin.com/in/ worden geaccepteerd. */
export function normalizeLinkedin(url) {
  if (!url) return "";
  const raw = String(url).trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return "";
    const m = u.pathname.match(/^\/in\/([^/?#]+)/i);
    if (!m) return "";
    return `https://www.linkedin.com/in/${decodeURIComponent(m[1]).toLowerCase()}`;
  } catch {
    return "";
  }
}

export function linkedinSearchUrl(lead) {
  const q = [lead.name, lead.company].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function finish(l) {
  const name = l.name || [l.first, l.last].filter(Boolean).join(" ");
  const first = l.first || name.split(" ")[0] || "";
  const loc = [l.city, l.country].filter(Boolean).join(", ");
  const id = l.id || slug(`${name}-${l.company}`) || slug(l.linkedin);
  return {
    id,
    first,
    last: l.last || "",
    lastHidden: Boolean(l.lastHidden),
    name,
    title: l.title || "",
    company: l.company || "",
    loc,
    linkedin: normalizeLinkedin(l.linkedin),
    seniority: l.seniority || "",
    industry: l.industry || "",
    employees: l.employees || "",
  };
}

/** Rijen uit een Apollo CSV-export. */
export function leadsFromCsvRows(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const lead = finish({
      id: pick(row, "id"),
      first: pick(row, "first"),
      last: pick(row, "last"),
      name: pick(row, "name"),
      title: pick(row, "title"),
      company: pick(row, "company"),
      linkedin: pick(row, "linkedin"),
      city: pick(row, "city") || pick(row, "state"),
      country: pick(row, "country"),
      seniority: pick(row, "seniority"),
      industry: pick(row, "industry"),
      employees: pick(row, "employees"),
    });
    if (!lead.name || !lead.id || seen.has(lead.id)) continue;
    seen.add(lead.id);
    out.push(lead);
  }
  return out;
}

/** Personen uit Apollo People API Search. Achternamen zijn daar soms afgeschermd. */
export function leadFromApolloPerson(p) {
  const org = p.organization ?? {};
  const hiddenLast = !p.last_name && p.last_name_obfuscated;
  return finish({
    id: p.id,
    first: p.first_name,
    last: p.last_name || p.last_name_obfuscated || "",
    lastHidden: Boolean(hiddenLast),
    name: hiddenLast ? "" : p.name,
    title: p.title || p.headline,
    company: org.name || p.organization_name,
    linkedin: p.linkedin_url,
    city: p.city || p.state,
    country: p.country,
    seniority: p.seniority,
    industry: org.industry,
    employees: org.estimated_num_employees ? String(org.estimated_num_employees) : "",
  });
}
