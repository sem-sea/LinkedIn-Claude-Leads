"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LeadsPanel } from "./LeadsPanel";
import { SearchPanel } from "./SearchPanel";
import { SettingsPanel } from "./SettingsPanel";
import { useStore } from "@/lib/storage";
import type { StatusResponse } from "@/lib/types";

type Tab = "search" | "leads" | "settings";

export function App() {
  const { config, setConfig, leads, setLeads, ready, storageOk } = useStore();
  const [tab, setTab] = useState<Tab>("search");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [toastText, setToastText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s: StatusResponse | null) => setStatus(s))
      .catch(() => setStatus(null));
  }, []);

  const toast = useCallback((t: string) => {
    setToastText(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastText(""), 2200);
  }, []);

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "search", label: "Zoeken" },
    { id: "leads", label: "Mijn leads", count: leads.length },
    { id: "settings", label: "Instellingen" },
  ];

  return (
    <main className="wrap">
      <header className="top">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">in</div>
          <div>
            <h1>LinkedIn Claude Leads</h1>
            <p>Vind profielen via Apollo, laat Claude het bericht schrijven, verstuur zelf.</p>
          </div>
        </div>
        <div className="pills" aria-live="polite">
          <span className={`pill ${status?.apollo ? "ok" : "warn"}`}>Apollo: {status ? (status.apollo ? "verbonden" : "demo") : "…"}</span>
          <span className={`pill ${status?.claude ? "ok" : "warn"}`}>Claude: {status ? (status.claude ? "verbonden" : "alleen sjablonen") : "…"}</span>
          {status && !status.protected && <span className="pill warn">Geen wachtwoord ingesteld</span>}
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Onderdelen">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            className="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {typeof t.count === "number" && <span className="count">{t.count}</span>}
          </button>
        ))}
      </nav>

      {!storageOk && (
        <p className="notice error">Je browser staat opslaan niet toe. Exporteer je leads regelmatig als back-up.</p>
      )}

      {!ready ? (
        <div className="empty"><b>Laden</b>Je instellingen en leads worden opgehaald.</div>
      ) : tab === "search" ? (
        <SearchPanel config={config} setConfig={setConfig} leads={leads} setLeads={setLeads} status={status} toast={toast} />
      ) : tab === "leads" ? (
        <LeadsPanel config={config} leads={leads} setLeads={setLeads} status={status} toast={toast} />
      ) : (
        <SettingsPanel config={config} setConfig={setConfig} toast={toast} />
      )}

      <p className="footer">
        Berichten verstuur je zelf via LinkedIn. Deze app automatiseert geen acties op LinkedIn. Instellingen en leads staan alleen in deze browser.
      </p>

      {toastText && <div className="toast" role="status">{toastText}</div>}
    </main>
  );
}
