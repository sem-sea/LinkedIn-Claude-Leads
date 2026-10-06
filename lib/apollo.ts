import type { ApolloFilters, Person } from "./types.ts";

export const APOLLO_BASE = "https://api.apollo.io/api/v1";

/** Bouwt de querystring voor POST /mixed_people/api_search (0 credits). */
export function buildSearchParams(filters: ApolloFilters, page: number, perPage: number): URLSearchParams {
  const params = new URLSearchParams();
  const add = (key: string, values: string[]) => {
    for (const v of values) {
      const t = v.trim();
      if (t) params.append(`${key}[]`, t);
    }
  };
  add("person_titles", filters.titles);
  add("person_seniorities", filters.seniorities);
  add("person_locations", filters.personLocations);
  add("organization_locations", filters.organizationLocations);
  add("organization_num_employees_ranges", filters.employeeRanges.map((r) => r.replace(/\s+/g, "")));
  if (filters.keywords.trim()) params.set("q_keywords", filters.keywords.trim());
  params.set("page", String(clampInt(page, 1, 500)));
  params.set("per_page", String(clampInt(perPage, 1, 100)));
  return params;
}

export function clampInt(n: number, min: number, max: number): number {
  const v = Math.floor(Number.isFinite(n) ? n : min);
  return Math.min(max, Math.max(min, v));
}

type Raw = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Zet een persoon uit een Apollo-antwoord om naar ons eigen formaat. */
export function mapPerson(raw: Raw, enriched: boolean): Person {
  const org = (raw.organization ?? {}) as Raw;
  const firstName = str(raw.first_name);
  const lastName = str(raw.last_name) || str(raw.last_name_obfuscated);
  const name = str(raw.name) || [firstName, lastName].filter(Boolean).join(" ");
  const location = [str(raw.city), str(raw.state), str(raw.country)].filter(Boolean).join(", ");
  return {
    apolloId: str(raw.id),
    firstName: firstName || name.split(" ")[0] || "",
    lastName,
    name,
    title: str(raw.title) || str(raw.headline),
    company: str(org.name) || str(raw.organization_name),
    location,
    linkedinUrl: normalizeLinkedinUrl(str(raw.linkedin_url)),
    email: str(raw.email),
    emailStatus: str(raw.email_status),
    enriched,
  };
}

export function normalizeLinkedinUrl(url: string): string {
  if (!url) return "";
  const u = url.startsWith("http") ? url : `https://${url}`;
  try {
    const parsed = new URL(u);
    if (!/(^|\.)linkedin\.com$/.test(parsed.hostname)) return "";
    parsed.protocol = "https:";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

/** Zoekt naar het profiel op LinkedIn als Apollo nog geen profiel-URL heeft. */
export function linkedinSearchUrl(person: Pick<Person, "name" | "company">): string {
  const q = [person.name, person.company].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}

export function parseSearchResponse(json: Raw): { people: Person[]; page: number; totalPages: number; totalEntries: number } {
  const list = (Array.isArray(json.people) ? json.people : []) as Raw[];
  const pagination = (json.pagination ?? {}) as Raw;
  const people = list.map((p) => mapPerson(p, false)).filter((p) => p.apolloId);
  const totalEntries = Number(json.total_entries ?? pagination.total_entries ?? people.length) || 0;
  return {
    people,
    page: Number(pagination.page ?? 1) || 1,
    totalPages: Number(pagination.total_pages ?? 1) || 1,
    totalEntries,
  };
}

/* ---------- Demo-modus: voorbeelddata zonder API-sleutel ---------- */

const DEMO_PEOPLE: Array<Omit<Person, "enriched" | "email" | "emailStatus">> = [
  { apolloId: "demo-1", firstName: "Sanne", lastName: "de Vries", name: "Sanne de Vries", title: "Head of Marketing", company: "Voorbeeld Software BV", location: "Amsterdam, Netherlands", linkedinUrl: "" },
  { apolloId: "demo-2", firstName: "Mark", lastName: "Jansen", name: "Mark Jansen", title: "CMO", company: "Demo Cloud Solutions", location: "Utrecht, Netherlands", linkedinUrl: "" },
  { apolloId: "demo-3", firstName: "Fatima", lastName: "El Amrani", name: "Fatima El Amrani", title: "HR Director", company: "Testbedrijf Logistiek", location: "Rotterdam, Netherlands", linkedinUrl: "" },
  { apolloId: "demo-4", firstName: "Pieter", lastName: "Bakker", name: "Pieter Bakker", title: "Marketing Director", company: "Fictief Data Group", location: "Eindhoven, Netherlands", linkedinUrl: "" },
  { apolloId: "demo-5", firstName: "Lisa", lastName: "Smit", name: "Lisa Smit", title: "Chief People Officer", company: "Voorbeeld Zorggroep", location: "Den Haag, Netherlands", linkedinUrl: "" },
  { apolloId: "demo-6", firstName: "Joost", lastName: "Visser", name: "Joost Visser", title: "VP Marketing", company: "Demo Security BV", location: "Amersfoort, Netherlands", linkedinUrl: "" },
];

export function demoSearch(filters: ApolloFilters): Person[] {
  const terms = [...filters.titles, filters.keywords]
    .join(" ")
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length > 2);
  const match = DEMO_PEOPLE.filter((p) => !terms.length || terms.some((t) => `${p.title} ${p.company}`.toLowerCase().includes(t)));
  const list = match.length ? match : DEMO_PEOPLE;
  return list.map((p) => ({ ...p, email: "", emailStatus: "", enriched: false }));
}

export function demoEnrich(id: string): Person | null {
  const p = DEMO_PEOPLE.find((d) => d.apolloId === id);
  if (!p) return null;
  const slug = p.name.toLowerCase().replace(/[^a-z]+/g, "-");
  return { ...p, linkedinUrl: `https://www.linkedin.com/in/${slug}-voorbeeld`, email: "", emailStatus: "demo", enriched: true };
}
