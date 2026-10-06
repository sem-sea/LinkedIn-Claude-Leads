"use client";

import { SENIORITIES, SENIORITY_LABELS, type ApolloFilters, type Seniority } from "@/lib/types";

export function toList(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Bedrijfsgroottes staan als "51,200"; in het invoerveld als "51-200". */
export function rangesToText(ranges: string[]): string {
  return ranges.map((r) => r.replace(",", "-")).join(", ");
}

export function textToRanges(text: string): string[] {
  return text
    .split(/[\n,;]+|\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/\s/g, "").replace("-", ","))
    .filter((t) => /^\d+,\d+$/.test(t));
}

interface Props {
  idPrefix: string;
  value: ApolloFilters;
  onChange: (next: ApolloFilters) => void;
}

export function FiltersEditor({ idPrefix, value, onChange }: Props) {
  const set = <K extends keyof ApolloFilters>(key: K, v: ApolloFilters[K]) => onChange({ ...value, [key]: v });
  const toggleSeniority = (s: Seniority) =>
    set("seniorities", value.seniorities.includes(s) ? value.seniorities.filter((x) => x !== s) : [...value.seniorities, s]);

  return (
    <div className="stack">
      <div className="grid2">
        <label className="field" htmlFor={`${idPrefix}-titles`}>
          Functietitels <span className="sub">Gescheiden door komma's. Eén match is genoeg.</span>
          <input
            id={`${idPrefix}-titles`}
            type="text"
            defaultValue={value.titles.join(", ")}
            key={`t-${value.titles.join("|")}`}
            onBlur={(e) => set("titles", toList(e.target.value))}
            placeholder="Head of Marketing, CMO"
          />
        </label>
        <label className="field" htmlFor={`${idPrefix}-kw`}>
          Trefwoorden <span className="sub">Zoekt breed in profiel en bedrijf.</span>
          <input
            id={`${idPrefix}-kw`}
            type="text"
            value={value.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="SaaS, cybersecurity"
          />
        </label>
        <label className="field" htmlFor={`${idPrefix}-ploc`}>
          Locatie persoon <span className="sub">Land, provincie of stad.</span>
          <input
            id={`${idPrefix}-ploc`}
            type="text"
            defaultValue={value.personLocations.join(", ")}
            key={`p-${value.personLocations.join("|")}`}
            onBlur={(e) => set("personLocations", toList(e.target.value))}
            placeholder="Netherlands"
          />
        </label>
        <label className="field" htmlFor={`${idPrefix}-oloc`}>
          Locatie hoofdkantoor <span className="sub">Optioneel.</span>
          <input
            id={`${idPrefix}-oloc`}
            type="text"
            defaultValue={value.organizationLocations.join(", ")}
            key={`o-${value.organizationLocations.join("|")}`}
            onBlur={(e) => set("organizationLocations", toList(e.target.value))}
            placeholder="Rotterdam"
          />
        </label>
        <label className="field" htmlFor={`${idPrefix}-size`}>
          Aantal medewerkers <span className="sub">Bijvoorbeeld 51-200, 201-500.</span>
          <input
            id={`${idPrefix}-size`}
            type="text"
            defaultValue={rangesToText(value.employeeRanges)}
            key={`s-${value.employeeRanges.join("|")}`}
            onBlur={(e) => set("employeeRanges", textToRanges(e.target.value))}
            placeholder="51-200, 201-500"
          />
        </label>
      </div>
      <div className="field" role="group" aria-label="Senioriteit">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Senioriteit</span>
        <div className="checks">
          {SENIORITIES.map((s) => (
            <label className="check" key={s}>
              <input type="checkbox" checked={value.seniorities.includes(s)} onChange={() => toggleSeniority(s)} />
              {SENIORITY_LABELS[s]}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
