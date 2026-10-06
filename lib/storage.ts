"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeConfig } from "./config.ts";
import { DEFAULT_CONFIG } from "./defaultConfig.ts";
import { STATUSES, type AppConfig, type Lead } from "./types.ts";

const CONFIG_KEY = "lcl.config.v1";
const LEADS_KEY = "lcl.leads.v1";

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function sanitizeLeads(input: unknown): Lead[] {
  if (!Array.isArray(input)) return [];
  const s = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const raw of input.slice(0, 5000)) {
    const l = (raw ?? {}) as Record<string, unknown>;
    const id = s(l.apolloId, 64);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const status = (STATUSES as readonly string[]).includes(l.status as string) ? (l.status as Lead["status"]) : "todo";
    out.push({
      apolloId: id,
      firstName: s(l.firstName, 80),
      lastName: s(l.lastName, 80),
      name: s(l.name, 160),
      title: s(l.title, 200),
      company: s(l.company, 200),
      location: s(l.location, 200),
      linkedinUrl: s(l.linkedinUrl, 300),
      email: s(l.email, 200),
      emailStatus: s(l.emailStatus, 40),
      enriched: Boolean(l.enriched),
      icpId: s(l.icpId, 60),
      status,
      message: s(l.message),
      notes: s(l.notes),
      addedAt: s(l.addedAt, 40),
      sentAt: s(l.sentAt, 40),
    });
  }
  return out;
}

/** Instellingen en leads, opgeslagen in de browser van de gebruiker. */
export function useStore() {
  const [config, setConfigState] = useState<AppConfig>(DEFAULT_CONFIG);
  const [leads, setLeadsState] = useState<Lead[]>([]);
  const [ready, setReady] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const c = read<unknown>(CONFIG_KEY);
    if (c) setConfigState(sanitizeConfig(c));
    setLeadsState(sanitizeLeads(read<unknown>(LEADS_KEY) ?? []));
    setReady(true);
  }, []);

  const setConfig = useCallback((next: AppConfig) => {
    const clean = sanitizeConfig(next);
    setConfigState(clean);
    setStorageOk(write(CONFIG_KEY, clean));
  }, []);

  const setLeads = useCallback((updater: (prev: Lead[]) => Lead[]) => {
    setLeadsState((prev) => {
      const next = updater(prev);
      setStorageOk(write(LEADS_KEY, next));
      return next;
    });
  }, []);

  return { config, setConfig, leads, setLeads, ready, storageOk };
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
