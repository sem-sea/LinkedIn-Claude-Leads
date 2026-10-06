"use client";

import { useMemo, useRef, useState } from "react";
import { linkedinSearchUrl } from "@/lib/apollo";
import { leadsToCsv } from "@/lib/csv";
import { copyText, downloadFile, sanitizeLeads, today } from "@/lib/storage";
import { STATUSES, STATUS_LABELS, type AppConfig, type Lead, type LeadStatus, type StatusResponse } from "@/lib/types";

interface Props {
  config: AppConfig;
  leads: Lead[];
  setLeads: (u: (prev: Lead[]) => Lead[]) => void;
  status: StatusResponse | null;
  toast: (t: string) => void;
}

export function LeadsPanel({ config, leads, setLeads, status, toast }: Props) {
  const [icpFilter, setIcpFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("todo");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const icpById = useMemo(() => new Map(config.icps.map((i) => [i.id, i])), [config.icps]);
  const kind = config.messageKind;
  const noteLimit = config.noteLimit;
  const sentToday = leads.filter((l) => l.sentAt === today()).length;

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads
      .filter((l) => icpFilter === "all" || l.icpId === icpFilter)
      .filter((l) => statusFilter === "all" || l.status === statusFilter)
      .filter((l) => !term || `${l.name} ${l.title} ${l.company} ${l.location}`.toLowerCase().includes(term))
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.name.localeCompare(b.name));
  }, [leads, icpFilter, statusFilter, q]);

  const update = (id: string, patch: Partial<Lead>) =>
    setLeads((prev) => prev.map((l) => (l.apolloId === id ? { ...l, ...patch } : l)));

  function setStatus(lead: Lead, s: LeadStatus) {
    const patch: Partial<Lead> = { status: s };
    if (s === "sent" && !lead.sentAt) patch.sentAt = today();
    if (s === "todo") patch.sentAt = "";
    update(lead.apolloId, patch);
  }

  async function write(lead: Lead, mode: "claude" | "template"): Promise<boolean> {
    const icp = icpById.get(lead.icpId) ?? config.icps[0];
    if (!icp) {
      setError("Deze lead hoort bij een doelgroep die niet meer bestaat. Kies of maak een doelgroep onder Instellingen.");
      return false;
    }
    setBusy((b) => new Set(b).add(lead.apolloId));
    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: config.profile, icp, person: lead, kind, mode, noteLimit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Het bericht kon niet worden gemaakt.");
      update(lead.apolloId, { message: json.message as string });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(lead.apolloId);
        return n;
      });
    }
  }

  async function writeAll() {
    const todo = visible.filter((l) => !l.message && l.status === "todo").slice(0, 10);
    if (!todo.length) return;
    setBulk(true);
    setError("");
    let done = 0;
    for (const lead of todo) {
      const ok = await write(lead, status?.claude ? "claude" : "template");
      if (!ok) break;
      done++;
    }
    setBulk(false);
    toast(`${done} ${done === 1 ? "bericht" : "berichten"} geschreven`);
  }

  async function copy(lead: Lead) {
    const ok = await copyText(lead.message);
    toast(ok ? "Bericht gekopieerd" : "Kopiëren lukte niet, selecteer de tekst zelf");
  }

  function importLeads(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = sanitizeLeads(JSON.parse(String(reader.result)));
        if (!incoming.length) throw new Error("Geen leads gevonden in dit bestand.");
        setLeads((prev) => {
          const map = new Map(prev.map((l) => [l.apolloId, l]));
          for (const l of incoming) if (!map.has(l.apolloId)) map.set(l.apolloId, l);
          return [...map.values()];
        });
        toast(`${incoming.length} leads geïmporteerd`);
      } catch (e) {
        setError((e as Error).message || "Dit bestand kon niet worden gelezen.");
      }
    };
    reader.readAsText(file);
  }

  const counts = {
    total: leads.length,
    todo: leads.filter((l) => l.status === "todo").length,
    sent: leads.filter((l) => l.status === "sent").length,
    replied: leads.filter((l) => l.status === "replied" || l.status === "meeting").length,
  };
  const pct = Math.min(100, Math.round((sentToday / Math.max(1, config.dailyLimit)) * 100));

  return (
    <div className="stack">
      <div className="stats">
        <div className="stat"><b>{counts.total}</b><span>Leads</span></div>
        <div className="stat"><b>{counts.todo}</b><span>Te doen</span></div>
        <div className="stat"><b>{counts.sent}</b><span>Verstuurd</span></div>
        <div className="stat"><b>{counts.replied}</b><span>Gereageerd of gesprek</span></div>
        <div className="stat">
          <b>{sentToday} / {config.dailyLimit}</b>
          <span>Vandaag verstuurd</span>
          <div className={`meter ${pct >= 100 ? "full" : ""}`}><i style={{ width: `${pct}%` }} /></div>
        </div>
      </div>

      <section className="card stack">
        <div className="row">
          <label className="field" htmlFor="f-q" style={{ flex: "1 1 200px" }}>
            Zoeken
            <input id="f-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Naam, functie of organisatie" />
          </label>
          <label className="field" htmlFor="f-icp">
            Doelgroep
            <select id="f-icp" value={icpFilter} onChange={(e) => setIcpFilter(e.target.value)}>
              <option value="all">Alle doelgroepen</option>
              {config.icps.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="f-status">
            Status
            <select id="f-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | LeadStatus)}>
              <option value="all">Alle statussen</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={writeAll} disabled={bulk || !visible.some((l) => !l.message && l.status === "todo")}>
            {bulk ? "Schrijven…" : status?.claude ? "Schrijf berichten met Claude (max 10)" : "Vul sjabloon in (max 10)"}
          </button>
          <button className="btn quiet" type="button" disabled={!leads.length} onClick={() => downloadFile(`leads-${today()}.csv`, leadsToCsv(leads, config.icps), "text/csv;charset=utf-8")}>
            Exporteer CSV
          </button>
          <button className="btn quiet" type="button" disabled={!leads.length} onClick={() => downloadFile(`leads-${today()}.json`, JSON.stringify(leads, null, 2), "application/json")}>
            Back-up (JSON)
          </button>
          <button className="btn quiet" type="button" onClick={() => fileRef.current?.click()}>
            Importeer back-up
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importLeads(f); e.target.value = ""; }} />
        </div>
        {sentToday >= config.dailyLimit && (
          <p className="notice warn">Je hebt je daglimiet van {config.dailyLimit} berichten bereikt. Morgen verder houdt je account veilig.</p>
        )}
        {error && <p className="notice error">{error}</p>}
      </section>

      <p className="hint">{visible.length} van {leads.length} leads</p>

      {leads.length === 0 ? (
        <div className="empty">
          <b>Nog geen leads</b>Zoek profielen op het tabblad Zoeken en voeg ze toe aan je lijst.
        </div>
      ) : visible.length === 0 ? (
        <div className="empty">
          <b>Geen leads in deze selectie</b>Kies een andere status of doelgroep.
        </div>
      ) : (
        visible.map((lead) => {
          const icp = icpById.get(lead.icpId);
          const over = kind === "connect" && lead.message.length > noteLimit;
          const url = lead.linkedinUrl || linkedinSearchUrl(lead);
          const isBusy = busy.has(lead.apolloId);
          return (
            <article className="lead" key={lead.apolloId} data-status={lead.status}>
              <div className="lead-head">
                <div>
                  <div className="lead-name">{lead.name || lead.firstName}</div>
                  <div className="lead-meta">
                    {[lead.title, lead.company].filter(Boolean).join(" · ")}
                    {lead.location ? ` · ${lead.location}` : ""}
                  </div>
                  <div className="row" style={{ marginTop: 6 }}>
                    {icp && <span className="badge">{icp.name}</span>}
                    {!lead.linkedinUrl && <span className="pill warn">Geen profiel-URL, zoek op naam</span>}
                    {lead.sentAt && <span className="pill">Verstuurd {lead.sentAt}</span>}
                  </div>
                </div>
                <select
                  className="status"
                  data-v={lead.status}
                  aria-label={`Status van ${lead.name}`}
                  value={lead.status}
                  onChange={(e) => setStatus(lead, e.target.value as LeadStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <label className="field" htmlFor={`m-${lead.apolloId}`}>
                <span className="row" style={{ justifyContent: "space-between" }}>
                  <span>{kind === "connect" ? "Notitie bij connectieverzoek" : "Bericht"}</span>
                  <span className={`chars ${over ? "over" : ""}`}>
                    {lead.message.length}{kind === "connect" ? ` / ${noteLimit}` : ""}
                  </span>
                </span>
                <textarea
                  id={`m-${lead.apolloId}`}
                  rows={kind === "connect" ? 7 : 11}
                  value={lead.message}
                  placeholder="Nog geen bericht. Laat Claude er een schrijven of vul het sjabloon in."
                  onChange={(e) => update(lead.apolloId, { message: e.target.value })}
                />
              </label>

              <div className="row">
                {status?.claude && (
                  <button className="btn small" type="button" disabled={isBusy} onClick={() => { setError(""); void write(lead, "claude"); }}>
                    {isBusy ? "Schrijven…" : lead.message ? "Opnieuw met Claude" : "Schrijf met Claude"}
                  </button>
                )}
                <button className="btn ghost small" type="button" disabled={isBusy} onClick={() => { setError(""); void write(lead, "template"); }}>
                  Sjabloon
                </button>
                <button className="btn ghost small" type="button" disabled={!lead.message} onClick={() => copy(lead)}>
                  Kopieer
                </button>
                <a className="btn ghost small" href={url} target="_blank" rel="noopener noreferrer">
                  Open LinkedIn
                </a>
                {lead.status === "todo" && (
                  <button className="btn quiet small" type="button" onClick={() => setStatus(lead, "sent")}>
                    Markeer als verstuurd
                  </button>
                )}
                {confirmDelete === lead.apolloId ? (
                  <>
                    <button className="btn danger small" type="button" onClick={() => { setLeads((prev) => prev.filter((l) => l.apolloId !== lead.apolloId)); setConfirmDelete(""); }}>
                      Ja, verwijder
                    </button>
                    <button className="btn quiet small" type="button" onClick={() => setConfirmDelete("")}>
                      Annuleer
                    </button>
                  </>
                ) : (
                  <button className="btn quiet small" type="button" onClick={() => setConfirmDelete(lead.apolloId)}>
                    Verwijder
                  </button>
                )}
              </div>

              <details>
                <summary>Notities</summary>
                <textarea
                  aria-label={`Notities bij ${lead.name}`}
                  rows={2}
                  value={lead.notes}
                  onChange={(e) => update(lead.apolloId, { notes: e.target.value })}
                  style={{ marginTop: 8 }}
                />
              </details>
            </article>
          );
        })
      )}
    </div>
  );
}
