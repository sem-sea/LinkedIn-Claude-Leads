import { NextResponse } from "next/server";
import { sanitizeConfig } from "@/lib/config";
import { cleanMessage, fillTemplate, lengthWarning, systemPrompt, userPrompt } from "@/lib/messages";
import { claudeError, env, fail, readJson } from "@/lib/server";
import type { MessageKind, Person } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function cleanPerson(v: unknown): Person {
  const p = (v ?? {}) as Record<string, unknown>;
  const s = (x: unknown, max = 200) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  return {
    apolloId: s(p.apolloId, 64),
    firstName: s(p.firstName, 80),
    lastName: s(p.lastName, 80),
    name: s(p.name, 160),
    title: s(p.title),
    company: s(p.company),
    location: s(p.location),
    linkedinUrl: s(p.linkedinUrl, 300),
    email: "",
    emailStatus: "",
    enriched: Boolean(p.enriched),
  };
}

type Msg = { role: "user" | "assistant"; content: string };

async function callClaude(key: string, model: string, system: string, messages: Msg[]): Promise<string> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 700, system, messages }),
    signal: AbortSignal.timeout(45_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(claudeError(res.status));
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
  return cleanMessage(text);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch (e) {
    return fail((e as Error).message);
  }

  const config = sanitizeConfig({ profile: body.profile, icps: [body.icp] });
  const profile = config.profile;
  const icp = config.icps[0];
  const person = cleanPerson(body.person);
  const kind: MessageKind = body.kind === "message" ? "message" : "connect";
  const useTemplate = body.mode === "template";
  const noteLimit = Number(body.noteLimit) === 200 ? 200 : 300;

  if (!person.firstName && !person.name) return fail("Deze lead heeft geen naam.");

  const { claudeKey, model } = env();

  if (useTemplate || !claudeKey) {
    const base = icp.template || `${profile.greeting}\n\n${profile.opener} ${icp.goal}\n\n${profile.closing}`;
    const message = fillTemplate(base, person, profile).replaceAll("{voornaam}", person.firstName);
    return NextResponse.json({ message, source: "template", warning: lengthWarning(message, kind, noteLimit) });
  }

  const system = systemPrompt({ ...profile, greeting: profile.greeting.replaceAll("{voornaam}", person.firstName) }, kind, noteLimit);
  const first: Msg = { role: "user", content: userPrompt(person, icp) };
  try {
    let message = await callClaude(claudeKey, model, system, [first]);
    if (kind === "connect" && message.length > noteLimit) {
      message = await callClaude(claudeKey, model, system, [
        first,
        { role: "assistant", content: message },
        {
          role: "user",
          content: `Dit is ${message.length} tekens. Maak het korter dan ${noteLimit} tekens, inclusief aanhef en groet, met behoud van de kern.`,
        },
      ]);
    }
    return NextResponse.json({ message, source: "claude", warning: lengthWarning(message, kind, noteLimit) });
  } catch (e) {
    return fail((e as Error).message || "Het bericht kon niet worden gemaakt.", 502);
  }
}
