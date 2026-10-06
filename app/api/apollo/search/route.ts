import { NextResponse } from "next/server";
import { APOLLO_BASE, buildSearchParams, clampInt, demoSearch, parseSearchResponse } from "@/lib/apollo";
import { sanitizeConfig } from "@/lib/config";
import { apolloError, env, fail, readJson } from "@/lib/server";
import type { SearchResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch (e) {
    return fail((e as Error).message);
  }

  // Hergebruik de config-validatie om de filters schoon te maken.
  const filters = sanitizeConfig({ icps: [{ name: "zoek", filters: body.filters }] }).icps[0].filters;
  const page = clampInt(Number(body.page ?? 1), 1, 500);
  const perPage = clampInt(Number(body.perPage ?? 25), 1, 100);

  const hasFilter =
    filters.titles.length || filters.seniorities.length || filters.personLocations.length ||
    filters.organizationLocations.length || filters.employeeRanges.length || filters.keywords;
  if (!hasFilter) return fail("Vul minstens één filter in, bijvoorbeeld een functietitel.");

  const { apolloKey } = env();
  if (!apolloKey) {
    const people = demoSearch(filters);
    const result: SearchResult = { people, page: 1, totalPages: 1, totalEntries: people.length, demo: true };
    return NextResponse.json(result);
  }

  const params = buildSearchParams(filters, page, perPage);
  let res: Response;
  try {
    res = await fetch(`${APOLLO_BASE}/mixed_people/api_search?${params.toString()}`, {
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
  } catch {
    return fail("Apollo is niet bereikbaar. Probeer het opnieuw.", 502);
  }
  if (!res.ok) return fail(apolloError(res.status), res.status === 429 ? 429 : 502);

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseSearchResponse(json);
  const result: SearchResult = { ...parsed, demo: false };
  return NextResponse.json(result);
}
