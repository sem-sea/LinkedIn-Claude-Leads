import { NextResponse } from "next/server";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function env() {
  return {
    apolloKey: (process.env.APOLLO_API_KEY ?? "").trim(),
    claudeKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
    model: (process.env.CLAUDE_MODEL ?? "").trim() || DEFAULT_MODEL,
    password: (process.env.APP_PASSWORD ?? "").trim(),
  };
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Leest JSON uit een request met een maximale grootte, om misbruik te beperken. */
export async function readJson(req: Request, maxBytes = 100_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Verzoek is te groot.");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Ongeldige JSON in het verzoek.");
  }
}

export function apolloError(status: number): string {
  if (status === 401 || status === 403) {
    return "Apollo weigert het verzoek. Controleer je API-sleutel en of je Apollo-abonnement API-toegang heeft.";
  }
  if (status === 422) return "Apollo kon deze zoekopdracht niet verwerken. Controleer de filters.";
  if (status === 429) return "Je zit aan de limiet van Apollo. Wacht even en probeer het opnieuw.";
  return `Apollo gaf een fout (${status}). Probeer het later opnieuw.`;
}

export function claudeError(status: number): string {
  if (status === 401 || status === 403) return "Claude weigert het verzoek. Controleer je ANTHROPIC_API_KEY.";
  if (status === 404) return "Het ingestelde Claude-model bestaat niet. Controleer CLAUDE_MODEL.";
  if (status === 429) return "Je zit aan de limiet van de Claude API. Wacht even en probeer het opnieuw.";
  if (status === 529 || status >= 500) return "De Claude API is tijdelijk overbelast. Probeer het zo opnieuw.";
  return `De Claude API gaf een fout (${status}).`;
}
