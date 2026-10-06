import { STATUS_LABELS, type Icp, type Lead } from "./types.ts";

function cell(value: string): string {
  const v = value ?? "";
  // Voorkom formule-injectie in Excel en Google Sheets.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV met puntkomma als scheidingsteken, zodat Nederlandse Excel het direct goed opent. */
export function leadsToCsv(leads: Lead[], icps: Icp[]): string {
  const icpName = new Map(icps.map((i) => [i.id, i.name]));
  const header = ["Naam", "Functie", "Organisatie", "Locatie", "LinkedIn", "E-mail", "Doelgroep", "Status", "Verstuurd op", "Bericht", "Notities"];
  const rows = leads.map((l) => [
    l.name,
    l.title,
    l.company,
    l.location,
    l.linkedinUrl,
    l.email,
    icpName.get(l.icpId) ?? l.icpId,
    STATUS_LABELS[l.status],
    l.sentAt,
    l.message,
    l.notes,
  ]);
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}
