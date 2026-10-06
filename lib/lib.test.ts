import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSearchParams, clampInt, demoEnrich, demoSearch, mapPerson, normalizeLinkedinUrl, parseSearchResponse } from "./apollo.ts";
import { sanitizeConfig, slugify } from "./config.ts";
import { leadsToCsv } from "./csv.ts";
import { DEFAULT_CONFIG } from "./defaultConfig.ts";
import { CONNECT_LIMIT, cleanMessage, fillTemplate, lengthWarning, systemPrompt } from "./messages.ts";
import type { ApolloFilters, Lead } from "./types.ts";

const filters: ApolloFilters = {
  titles: ["CMO", " Head of Marketing ", ""],
  seniorities: ["c_suite", "head"],
  personLocations: ["Netherlands"],
  organizationLocations: [],
  employeeRanges: ["51, 200"],
  keywords: " SaaS ",
};

test("buildSearchParams zet arrays, trefwoorden en paginering goed", () => {
  const p = buildSearchParams(filters, 0, 500);
  assert.deepEqual(p.getAll("person_titles[]"), ["CMO", "Head of Marketing"]);
  assert.deepEqual(p.getAll("person_seniorities[]"), ["c_suite", "head"]);
  assert.deepEqual(p.getAll("person_locations[]"), ["Netherlands"]);
  assert.deepEqual(p.getAll("organization_locations[]"), []);
  assert.deepEqual(p.getAll("organization_num_employees_ranges[]"), ["51,200"]);
  assert.equal(p.get("q_keywords"), "SaaS");
  assert.equal(p.get("page"), "1");
  assert.equal(p.get("per_page"), "100");
});

test("clampInt vangt rare waarden af", () => {
  assert.equal(clampInt(Number.NaN, 1, 10), 1);
  assert.equal(clampInt(7.9, 1, 10), 7);
  assert.equal(clampInt(99, 1, 10), 10);
});

test("mapPerson leest Apollo-velden en verborgen achternaam", () => {
  const p = mapPerson(
    {
      id: "abc",
      first_name: "Sanne",
      last_name_obfuscated: "d***s",
      title: "CMO",
      organization: { name: "Voorbeeld BV" },
      city: "Utrecht",
      country: "Netherlands",
      linkedin_url: "http://www.linkedin.com/in/sanne/",
    },
    false,
  );
  assert.equal(p.apolloId, "abc");
  assert.equal(p.name, "Sanne d***s");
  assert.equal(p.company, "Voorbeeld BV");
  assert.equal(p.location, "Utrecht, Netherlands");
  assert.equal(p.linkedinUrl, "https://www.linkedin.com/in/sanne");
  assert.equal(p.enriched, false);
});

test("normalizeLinkedinUrl accepteert alleen linkedin.com", () => {
  assert.equal(normalizeLinkedinUrl("linkedin.com/in/test"), "https://linkedin.com/in/test");
  assert.equal(normalizeLinkedinUrl("https://evil.com/in/test"), "");
  assert.equal(normalizeLinkedinUrl("https://notlinkedin.com/in/test"), "");
  assert.equal(normalizeLinkedinUrl(""), "");
});

test("parseSearchResponse leest personen en paginering", () => {
  const r = parseSearchResponse({
    total_entries: 120,
    people: [{ id: "1", first_name: "A", title: "CMO" }, { first_name: "zonder id" }],
    pagination: { page: 2, total_pages: 5 },
  });
  assert.equal(r.people.length, 1);
  assert.equal(r.page, 2);
  assert.equal(r.totalPages, 5);
  assert.equal(r.totalEntries, 120);
});

test("demo-modus geeft voorbeelddata en verrijking", () => {
  assert.ok(demoSearch(filters).length > 0);
  const e = demoEnrich("demo-1");
  assert.ok(e?.linkedinUrl.startsWith("https://www.linkedin.com/in/"));
  assert.equal(demoEnrich("bestaat-niet"), null);
});

test("fillTemplate vult invulvelden in", () => {
  const out = fillTemplate("Goedendag {voornaam},\n\n\n\nBij {bedrijf} als {functie}.\n{mijnnaam}", { firstName: "Mark", company: "", title: "CMO" }, { name: "Sam" });
  assert.equal(out, "Goedendag Mark,\n\nBij jullie organisatie als CMO.\nSam");
});

test("cleanMessage haalt gedachtestreepjes en aanhalingstekens weg", () => {
  assert.equal(cleanMessage('"Goedendag Mark — fijn dat je er bent"'), "Goedendag Mark, fijn dat je er bent");
  assert.equal(cleanMessage("Dit – en dat"), "Dit, en dat");
});

test("lengthWarning bewaakt de 300 tekens van een connectieverzoek", () => {
  assert.equal(lengthWarning("a".repeat(CONNECT_LIMIT), "connect"), "");
  assert.notEqual(lengthWarning("a".repeat(CONNECT_LIMIT + 1), "connect"), "");
  assert.equal(lengthWarning("a".repeat(600), "message"), "");
  assert.notEqual(lengthWarning("a".repeat(250), "connect", 200), "");
  assert.match(systemPrompt(DEFAULT_CONFIG.profile, "connect", 200), /maximaal 200 tekens/);
});

test("noteLimit is 200 of 300", () => {
  assert.equal(sanitizeConfig({ noteLimit: 200 }).noteLimit, 200);
  assert.equal(sanitizeConfig({ noteLimit: "200" }).noteLimit, 200);
  assert.equal(sanitizeConfig({ noteLimit: 999 }).noteLimit, 300);
  assert.equal(sanitizeConfig({}).noteLimit, 300);
});

test("systemPrompt bevat stijl en lengteregel", () => {
  const sp = systemPrompt(DEFAULT_CONFIG.profile, "connect");
  assert.match(sp, /300 tekens/);
  assert.match(sp, /Verzin geen feiten/);
});

test("sanitizeConfig maakt van rommel een geldige configuratie", () => {
  const c = sanitizeConfig({
    profile: { name: "Sam", language: "fr" },
    icps: [
      { id: "x", name: "A", filters: { seniorities: ["c_suite", "koning"], employeeRanges: ["51,200", "veel"] } },
      { id: "x", name: "B" },
    ],
    dailyLimit: 5000,
    messageKind: "iets",
  });
  assert.equal(c.profile.name, "Sam");
  assert.equal(c.profile.language, "nl");
  assert.deepEqual(c.icps[0].filters.seniorities, ["c_suite"]);
  assert.deepEqual(c.icps[0].filters.employeeRanges, ["51,200"]);
  assert.notEqual(c.icps[0].id, c.icps[1].id);
  assert.equal(c.dailyLimit, 100);
  assert.equal(c.messageKind, "connect");
  assert.equal(sanitizeConfig(null).icps.length, DEFAULT_CONFIG.icps.length);
});

test("slugify maakt nette id's", () => {
  assert.equal(slugify("HR-directeuren Één"), "hr-directeuren-een");
});

test("leadsToCsv gebruikt puntkomma's en blokkeert formules", () => {
  const lead: Lead = {
    apolloId: "1",
    firstName: "Mark",
    lastName: "Jansen",
    name: "Mark Jansen",
    title: "CMO",
    company: "=HYPERLINK(\"x\")",
    location: "Utrecht",
    linkedinUrl: "",
    email: "",
    emailStatus: "",
    enriched: false,
    icpId: DEFAULT_CONFIG.icps[0].id,
    status: "sent",
    message: "Regel 1; regel 2",
    notes: "",
    addedAt: "2026-10-06",
    sentAt: "2026-10-06",
  };
  const csv = leadsToCsv([lead], DEFAULT_CONFIG.icps);
  const [header, row] = csv.replace(/^﻿/, "").split("\r\n");
  assert.ok(header.startsWith("Naam;Functie;Organisatie"));
  assert.ok(row.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(row.includes('"Regel 1; regel 2"'));
  assert.ok(row.includes("Verstuurd"));
});
