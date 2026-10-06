"use client";

import { useEffect, useMemo, useState } from "react";
import { FiltersEditor } from "./FiltersEditor";
import { today } from "@/lib/storage";
import type { ApolloFilters, AppConfig, Lead, Person, SearchResult, StatusResponse } from "@/lib/types";

interface Props {
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
  leads: Lead[];
  setLeads: (u: (prev: Lead[]) => Lead[]) => void;
  status: StatusResponse | null;
  toast: (t: string) => void;
}

const PER_PAGE = 25;
const EMPTY_FILTERS: ApolloFilters = { titles: [], seniorities: [], personLocations: [], organizationLocations: [], employeeRanges: [], keywords: "" };

export function SearchPanel({ config, setConfig, leads, setLeads, status, toast }: Props) {
  const [icpId, setIcpId] = useState(config.icps[0]?.id ?? "");
  const icp = config.icps.find((i) => i.id === icpId) ?? config.icps[0];
  const [filters, setFilters] = useState<ApolloFilters>(icp?.filters ?? EMPTY_FILTERS);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<"" | "search" | "add">("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (icp) setFilters(icp.filters);
    setResult(null);
    setSelected(new Set());
    // Alleen opnieuw laden als de gebruiker een andere doelgroep kiest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icpId]);

  const inList = useMemo(() => new Set(leads.map((l) => l.apolloId)), [leads]);

  if (!icp) {
    return (
      <div className="empty">
        <b>Nog geen doelgroep</b>Maak eerst een doelgroep aan onder Instellingen.
      </div>
    );
  }

  async function search(page: number) {
    setLoading("search");
    setError("");
    try {
      const res = await fetch("/api/apollo/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, page, perPage: PER_PAGE }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Zoeken lukte niet.");
      setResult(json as SearchResult);
      setSelected(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading("");
    }
  }

  function saveFilters() {
    setConfig({ ...config, icps: config.icps.map((i) => (i.id === icp.id ? { ...i, filters } : i)) });
    toast("Filters opgeslagen in deze doelgroep");
  }

  async function addSelected(enrich: boolean) {
    if (!result) return;
    const chosen = result.people.filter((p) => selected.has(p.apolloId));
    if (!chosen.length) return;
    setLoading("add");
    setError("");
    const enrichedById = new Map<string, Person>();
    const errors: string[] = [];
    if (enrich) {
      for (let i = 0; i < chosen.length; i += 10) {
        const ids = chosen.slice(i, i + 10).map((p) => p.apolloId);
        try {
          const res = await fetch("/api/apollo/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Verrijken lukte niet.");
          for (const p of json.people as Person[]) enrichedById.set(p.apolloId, p);
          errors.push(...(json.errors as string[]));
        } catch (e) {
          errors.push((e as Error).message);
          break;
        }
      }
    }
    const added = chosen.map<Lead>((p) => {
      const e = enrichedById.get(p.apolloId);
      const base = e ? { ...p, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v !== "" && v !== false)) } : p;
      return { ...(base as Person), icpId: icp.id, status: "todo", message: "", notes: "", addedAt: today(), sentAt: "" };
    });
    setLeads((prev) => {
      const map = new Map(prev.map((l) => [l.apolloId, l]));
      for (const l of added) {
        const old = map.get(l.apolloId);
        map.set(l.apolloId, old ? { ...old, linkedinUrl: l.linkedinUrl || old.linkedinUrl, enriched: old.enriched || l.enriched, name: l.name || old.name, lastName: l.lastName || old.lastName } : l);
      }
      return [...map.values()];
    });
    setSelected(new Set());
    setLoading("");
    if (errors.length) setError([...new Set(errors)].join(" "));
    toast(`${added.length} ${added.length === 1 ? "persoon" : "personen"} toegevoegd aan je lijst`);
  }

  const people = result?.people ?? [];
  const allSelected = people.length > 0 && people.every((p) => selected.has(p.apolloId));

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Zoek profielen via Apollo</h2>
            <p className="hint">Zoeken kost geen Apollo-credits. Verrijken met het LinkedIn-profiel kost ongeveer 1 credit per persoon.</p>
          </div>
          <label className="field" htmlFor="icp-select" style={{ minWidth: 220 }}>
            Doelgroep
            <select id="icp-select" value={icp.id} onChange={(e) => setIcpId(e.target.value)}>
              {config.icps.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FiltersEditor idPrefix="search" value={filters} onChange={setFilters} />
        <div className="row">
          <button className="btn" type="button" onClick={() => search(1)} disabled={loading !== ""}>
            {loading === "search" ? "Zoeken…" : "Zoeken"}
          </button>
          <button className="btn quiet" type="button" onClick={saveFilters}>
            Filters opslaan in doelgroep
          </button>
        </div>
        {status && !status.apollo && (
          <p className="notice info">Demo-modus: er is nog geen APOLLO_API_KEY ingesteld. Je ziet voorbeelddata.</p>
        )}
        {error && <p className="notice error">{error}</p>}
      </section>

      {result && (
        <section className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <p className="hint">
              {result.totalEntries.toLocaleString("nl-NL")} resultaten · pagina {result.page} van {Math.max(1, result.totalPages)}
              {result.demo ? " · demo" : ""}
            </p>
            <div className="row">
              <button className="btn ghost" type="button" disabled={!selected.size || loading !== ""} onClick={() => addSelected(false)}>
                Toevoegen ({selected.size})
              </button>
              <button className="btn" type="button" disabled={!selected.size || loading !== ""} onClick={() => addSelected(true)}>
                {loading === "add" ? "Bezig…" : `Verrijken en toevoegen (${selected.size})`}
              </button>
            </div>
          </div>
          {people.length === 0 ? (
            <div className="empty">
              <b>Geen resultaten</b>Maak de filters ruimer, bijvoorbeeld met minder functietitels of zonder bedrijfsgrootte.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        aria-label="Alles selecteren"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(people.map((p) => p.apolloId)))}
                      />
                    </th>
                    <th>Naam</th>
                    <th>Functie</th>
                    <th>Organisatie</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.apolloId}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Selecteer ${p.name}`}
                          checked={selected.has(p.apolloId)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.apolloId)) next.delete(p.apolloId);
                              else next.add(p.apolloId);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>
                        {p.name || p.firstName} {inList.has(p.apolloId) && <span className="badge">In lijst</span>}
                        {p.location && <div className="sub">{p.location}</div>}
                      </td>
                      <td>{p.title}</td>
                      <td>{p.company}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.totalPages > 1 && (
            <div className="row">
              <button className="btn quiet small" type="button" disabled={result.page <= 1 || loading !== ""} onClick={() => search(result.page - 1)}>
                Vorige
              </button>
              <button className="btn quiet small" type="button" disabled={result.page >= result.totalPages || loading !== ""} onClick={() => search(result.page + 1)}>
                Volgende
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
