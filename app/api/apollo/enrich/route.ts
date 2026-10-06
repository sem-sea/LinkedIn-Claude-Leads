import { NextResponse } from "next/server";
import { APOLLO_BASE, demoEnrich, mapPerson } from "@/lib/apollo";
import { apolloError, env, fail, readJson } from "@/lib/server";
import type { Person } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_PER_REQUEST = 10;

/**
 * Verrijkt geselecteerde personen met hun LinkedIn-profiel via People Enrichment.
 * Dit kost Apollo-credits (ongeveer 1 per gevonden persoon). Telefoonnummers en
 * persoonlijke e-mailadressen worden bewust niet opgevraagd.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch (e) {
    return fail((e as Error).message);
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string" && /^[\w-]{1,64}$/.test(x)).slice(0, MAX_PER_REQUEST)
    : [];
  if (!ids.length) return fail("Selecteer minstens één persoon om te verrijken.");

  const { apolloKey } = env();
  if (!apolloKey) {
    const people = ids.map(demoEnrich).filter((p): p is Person => p !== null);
    return NextResponse.json({ people, errors: [], demo: true });
  }

  const people: Person[] = [];
  const errors: string[] = [];
  for (const id of ids) {
    const params = new URLSearchParams({ id, reveal_personal_emails: "false", reveal_phone_number: "false" });
    try {
      const res = await fetch(`${APOLLO_BASE}/people/match?${params.toString()}`, {
        method: "POST",
        headers: {
          "X-Api-Key": apolloKey,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!res.ok) {
        errors.push(apolloError(res.status));
        if (res.status === 401 || res.status === 403 || res.status === 429) break;
        continue;
      }
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (json.person && typeof json.person === "object") {
        people.push(mapPerson(json.person as Record<string, unknown>, true));
      } else {
        errors.push("Apollo vond geen extra gegevens voor een van de personen.");
      }
    } catch {
      errors.push("Apollo is niet bereikbaar. Probeer het opnieuw.");
      break;
    }
  }
  return NextResponse.json({ people, errors: [...new Set(errors)], demo: false });
}
