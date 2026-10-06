"use client";

import { useRef, useState } from "react";
import { FiltersEditor } from "./FiltersEditor";
import { sanitizeConfig, slugify } from "@/lib/config";
import { DEFAULT_CONFIG } from "@/lib/defaultConfig";
import { downloadFile } from "@/lib/storage";
import type { AppConfig, Icp, Profile } from "@/lib/types";

interface Props {
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
  toast: (t: string) => void;
}

export function SettingsPanel({ config, setConfig, toast }: Props) {
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setProfile = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setConfig({ ...config, profile: { ...config.profile, [key]: value } });

  const setIcp = (id: string, patch: Partial<Icp>) =>
    setConfig({ ...config, icps: config.icps.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  function addIcp() {
    const name = `Nieuwe doelgroep ${config.icps.length + 1}`;
    const icp: Icp = {
      id: `${slugify(name)}-${Date.now().toString(36)}`,
      name,
      goal: "",
      messageGuidance: "",
      template: "",
      filters: { titles: [], seniorities: [], personLocations: [], organizationLocations: [], employeeRanges: [], keywords: "" },
    };
    setConfig({ ...config, icps: [...config.icps, icp] });
  }

  function removeIcp(id: string) {
    if (config.icps.length <= 1) {
      setError("Je hebt minstens één doelgroep nodig.");
      return;
    }
    setConfig({ ...config, icps: config.icps.filter((i) => i.id !== id) });
  }

  function importConfig(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setConfig(sanitizeConfig(parsed));
        setError("");
        toast("Instellingen geïmporteerd");
      } catch {
        setError("Dit bestand is geen geldige instellingen-JSON.");
      }
    };
    reader.readAsText(file);
  }

  const p = config.profile;

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <h2>Jouw profiel</h2>
          <p className="hint">Claude gebruikt dit om berichten in jouw naam en stijl te schrijven. Gebruik {"{voornaam}"} en {"{mijnnaam}"} als invulvelden.</p>
        </div>
        <div className="grid2">
          <label className="field" htmlFor="p-name">
            Naam
            <input id="p-name" type="text" value={p.name} onChange={(e) => setProfile("name", e.target.value)} />
          </label>
          <label className="field" htmlFor="p-headline">
            Wat je doet, in één regel
            <input id="p-headline" type="text" value={p.headline} onChange={(e) => setProfile("headline", e.target.value)} />
          </label>
        </div>
        <label className="field" htmlFor="p-pitch">
          Waarmee je helpt
          <textarea id="p-pitch" value={p.pitch} onChange={(e) => setProfile("pitch", e.target.value)} />
        </label>
        <label className="field" htmlFor="p-proof">
          Bewijs <span className="sub">Klanten, resultaten of ervaring. Claude gebruikt alleen wat hier staat.</span>
          <textarea id="p-proof" value={p.proof} onChange={(e) => setProfile("proof", e.target.value)} />
        </label>
        <div className="grid2">
          <label className="field" htmlFor="p-greeting">
            Aanhef
            <input id="p-greeting" type="text" value={p.greeting} onChange={(e) => setProfile("greeting", e.target.value)} />
          </label>
          <label className="field" htmlFor="p-opener">
            Eerste zin
            <input id="p-opener" type="text" value={p.opener} onChange={(e) => setProfile("opener", e.target.value)} />
          </label>
          <label className="field" htmlFor="p-closing">
            Afsluiting
            <textarea id="p-closing" rows={2} value={p.closing} onChange={(e) => setProfile("closing", e.target.value)} />
          </label>
          <label className="field" htmlFor="p-lang">
            Taal van de berichten
            <select id="p-lang" value={p.language} onChange={(e) => setProfile("language", e.target.value === "en" ? "en" : "nl")}>
              <option value="nl">Nederlands</option>
              <option value="en">Engels</option>
            </select>
          </label>
        </div>
        <label className="field" htmlFor="p-rules">
          Schrijfregels
          <textarea id="p-rules" value={p.writingRules} onChange={(e) => setProfile("writingRules", e.target.value)} />
        </label>
      </section>

      <section className="card stack">
        <div>
          <h2>Outreach</h2>
          <p className="hint">Met een gratis LinkedIn-account mag een notitie bij een connectieverzoek 200 tekens zijn en kun je er ongeveer 5 per maand sturen. Met Premium is dat 300 tekens. Houd het aantal verzoeken per dag beperkt.</p>
        </div>
        <div className="grid2">
          <label className="field" htmlFor="o-kind">
            Soort bericht
            <select id="o-kind" value={config.messageKind} onChange={(e) => setConfig({ ...config, messageKind: e.target.value === "message" ? "message" : "connect" })}>
              <option value="connect">Notitie bij connectieverzoek</option>
              <option value="message">Bericht aan bestaande connectie</option>
            </select>
          </label>
          <label className="field" htmlFor="o-note">
            LinkedIn-account
            <select id="o-note" value={config.noteLimit} onChange={(e) => setConfig({ ...config, noteLimit: e.target.value === "200" ? 200 : 300 })}>
              <option value={300}>Premium of Sales Navigator (300 tekens)</option>
              <option value={200}>Gratis account (200 tekens)</option>
            </select>
          </label>
          <label className="field" htmlFor="o-limit">
            Daglimiet
            <input id="o-limit" type="number" min={1} max={100} value={config.dailyLimit} onChange={(e) => setConfig({ ...config, dailyLimit: Number(e.target.value) || 1 })} />
          </label>
        </div>
      </section>

      <section className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 16, margin: 0 }}>Doelgroepen</h2>
            <p className="hint">Per doelgroep: wat je ze biedt, hoe het bericht moet klinken en welke Apollo-filters horen erbij.</p>
          </div>
          <button className="btn" type="button" onClick={addIcp}>Doelgroep toevoegen</button>
        </div>
        {config.icps.map((icp) => (
          <div className="icp-card" key={icp.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label className="field" htmlFor={`i-name-${icp.id}`} style={{ flex: "1 1 240px" }}>
                Naam
                <input id={`i-name-${icp.id}`} type="text" value={icp.name} onChange={(e) => setIcp(icp.id, { name: e.target.value })} />
              </label>
              <button className="btn danger small" type="button" onClick={() => removeIcp(icp.id)}>Verwijder</button>
            </div>
            <label className="field" htmlFor={`i-goal-${icp.id}`}>
              Wat je deze groep biedt
              <textarea id={`i-goal-${icp.id}`} value={icp.goal} onChange={(e) => setIcp(icp.id, { goal: e.target.value })} />
            </label>
            <label className="field" htmlFor={`i-guide-${icp.id}`}>
              Instructie voor Claude <span className="sub">Bijvoorbeeld de vraag waarmee je afsluit.</span>
              <textarea id={`i-guide-${icp.id}`} value={icp.messageGuidance} onChange={(e) => setIcp(icp.id, { messageGuidance: e.target.value })} />
            </label>
            <label className="field" htmlFor={`i-tpl-${icp.id}`}>
              Sjabloon <span className="sub">Werkt zonder Claude. Invulvelden: {"{voornaam}"}, {"{bedrijf}"}, {"{functie}"}, {"{mijnnaam}"}.</span>
              <textarea id={`i-tpl-${icp.id}`} rows={9} value={icp.template} onChange={(e) => setIcp(icp.id, { template: e.target.value })} />
            </label>
            <details>
              <summary>Apollo-filters</summary>
              <div style={{ marginTop: 10 }}>
                <FiltersEditor idPrefix={`icp-${icp.id}`} value={icp.filters} onChange={(f) => setIcp(icp.id, { filters: f })} />
              </div>
            </details>
          </div>
        ))}
      </section>

      <section className="card stack">
        <div>
          <h2>Delen en back-up</h2>
          <p className="hint">Exporteer je instellingen om ze te bewaren of met een collega te delen. Leads blijven in je eigen browser.</p>
        </div>
        <div className="row">
          <button className="btn quiet" type="button" onClick={() => downloadFile("instellingen.json", JSON.stringify(config, null, 2), "application/json")}>
            Exporteer instellingen
          </button>
          <button className="btn quiet" type="button" onClick={() => fileRef.current?.click()}>
            Importeer instellingen
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importConfig(f); e.target.value = ""; }} />
          {confirmReset ? (
            <>
              <button className="btn danger" type="button" onClick={() => { setConfig(DEFAULT_CONFIG); setConfirmReset(false); toast("Standaardinstellingen hersteld"); }}>
                Ja, herstel standaard
              </button>
              <button className="btn quiet" type="button" onClick={() => setConfirmReset(false)}>Annuleer</button>
            </>
          ) : (
            <button className="btn danger" type="button" onClick={() => setConfirmReset(true)}>Herstel standaard</button>
          )}
        </div>
        {error && <p className="notice error">{error}</p>}
      </section>
    </div>
  );
}
