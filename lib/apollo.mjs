// Apollo People API Search: kost geen credits, geeft geen e-mail of telefoon.
import { leadFromApolloPerson } from "./leads.mjs";

const BASE = () => process.env.APOLLO_BASE_URL || "https://api.apollo.io/api/v1";

export function searchParams(filters, page, perPage) {
  const p = new URLSearchParams();
  const add = (k, list) => {
    for (const v of list ?? []) if (String(v).trim()) p.append(`${k}[]`, String(v).trim());
  };
  add("person_titles", filters.functies);
  add("person_seniorities", filters.senioriteit);
  add("person_locations", filters.locaties);
  add("organization_locations", filters.hoofdkantoor);
  add("organization_num_employees_ranges", (filters.bedrijfsgrootte ?? []).map((r) => String(r).replace(/\s+/g, "")));
  if (filters.trefwoorden?.trim()) p.set("q_keywords", filters.trefwoorden.trim());
  p.set("page", String(page));
  p.set("per_page", String(Math.min(100, Math.max(1, perPage))));
  return p;
}

export async function apolloSearch(apiKey, filters, max) {
  const leads = [];
  const perPage = Math.min(100, max);
  for (let page = 1; leads.length < max && page <= 500; page++) {
    const res = await fetch(`${BASE()}/mixed_people/api_search?${searchParams(filters, page, perPage)}`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 401 || res.status === 403) throw new Error("Apollo weigert de sleutel. Gebruik een API-sleutel met toegang tot mixed_people/api_search of een master key.");
    if (res.status === 429) throw new Error("Apollo-limiet bereikt. Probeer het over een paar minuten opnieuw.");
    if (!res.ok) throw new Error(`Apollo gaf foutcode ${res.status}.`);
    const json = await res.json();
    const people = Array.isArray(json.people) ? json.people : [];
    for (const p of people) {
      const lead = leadFromApolloPerson(p);
      if (lead.id && lead.first) leads.push(lead);
    }
    const totalPages = Number(json.pagination?.total_pages ?? 1);
    if (!people.length || page >= totalPages) break;
  }
  return leads.slice(0, max);
}
