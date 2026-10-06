import { DEFAULT_CONFIG } from "./defaultConfig.ts";
import { SENIORITIES, type AppConfig, type ApolloFilters, type Icp, type Profile, type Seniority } from "./types.ts";

const s = (v: unknown, fallback = "", max = 4000): string => (typeof v === "string" ? v.slice(0, max) : fallback);
const arr = (v: unknown, max = 50): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, max) : [];

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `icp-${Date.now()}`
  );
}

function sanitizeFilters(v: unknown): ApolloFilters {
  const f = (v ?? {}) as Record<string, unknown>;
  return {
    titles: arr(f.titles),
    seniorities: arr(f.seniorities).filter((x): x is Seniority => (SENIORITIES as readonly string[]).includes(x)),
    personLocations: arr(f.personLocations),
    organizationLocations: arr(f.organizationLocations),
    employeeRanges: arr(f.employeeRanges).filter((r) => /^\d+,\d+$/.test(r.replace(/\s+/g, ""))),
    keywords: s(f.keywords, "", 200),
  };
}

function sanitizeIcp(v: unknown, index: number): Icp {
  const i = (v ?? {}) as Record<string, unknown>;
  const name = s(i.name, `Doelgroep ${index + 1}`, 120) || `Doelgroep ${index + 1}`;
  return {
    id: s(i.id, "", 60) || slugify(name),
    name,
    goal: s(i.goal),
    messageGuidance: s(i.messageGuidance),
    template: s(i.template),
    filters: sanitizeFilters(i.filters),
  };
}

function sanitizeProfile(v: unknown): Profile {
  const p = (v ?? {}) as Record<string, unknown>;
  const d = DEFAULT_CONFIG.profile;
  return {
    name: s(p.name, d.name, 120),
    headline: s(p.headline, d.headline, 200),
    pitch: s(p.pitch, d.pitch),
    proof: s(p.proof, d.proof),
    greeting: s(p.greeting, d.greeting, 120),
    opener: s(p.opener, d.opener, 200),
    closing: s(p.closing, d.closing, 200),
    writingRules: s(p.writingRules, d.writingRules),
    language: p.language === "en" ? "en" : "nl",
  };
}

/** Maakt van willekeurige JSON een geldige configuratie. Onbekende velden vallen weg. */
export function sanitizeConfig(input: unknown): AppConfig {
  const c = (input ?? {}) as Record<string, unknown>;
  const icps = Array.isArray(c.icps) ? c.icps.slice(0, 30).map(sanitizeIcp) : structuredClone(DEFAULT_CONFIG.icps);
  const seen = new Set<string>();
  for (const icp of icps) {
    while (seen.has(icp.id)) icp.id = `${icp.id}-2`;
    seen.add(icp.id);
  }
  const limit = Number(c.dailyLimit);
  return {
    version: 1,
    profile: sanitizeProfile(c.profile),
    icps: icps.length ? icps : structuredClone(DEFAULT_CONFIG.icps),
    dailyLimit: Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.floor(limit)) : DEFAULT_CONFIG.dailyLimit,
    messageKind: c.messageKind === "message" ? "message" : "connect",
    noteLimit: Number(c.noteLimit) === 200 ? 200 : 300,
  };
}
