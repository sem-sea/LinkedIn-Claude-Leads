import type { Icp, MessageKind, Person, Profile } from "./types.ts";

export const CONNECT_LIMIT = 300;

/** Vult {voornaam}, {bedrijf}, {functie} en {mijnnaam} in. */
export function fillTemplate(template: string, person: Pick<Person, "firstName" | "company" | "title">, profile: Pick<Profile, "name">): string {
  return template
    .replaceAll("{voornaam}", person.firstName || "")
    .replaceAll("{bedrijf}", person.company || "jullie organisatie")
    .replaceAll("{functie}", person.title || "")
    .replaceAll("{mijnnaam}", profile.name || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Verwijdert gedachtestreepjes en dubbele spaties die modellen soms toch gebruiken. */
export function cleanMessage(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/ ,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
}

export function systemPrompt(profile: Profile, kind: MessageKind, noteLimit: number = CONNECT_LIMIT): string {
  const lang = profile.language === "en" ? "English" : "Nederlands";
  const lengthRule =
    kind === "connect"
      ? `Dit is een notitie bij een LinkedIn-connectieverzoek: maximaal ${noteLimit} tekens inclusief aanhef en groet. Gebruik daarom een korte groet zonder lege regels.`
      : "Dit is een LinkedIn-bericht aan een bestaande connectie: maximaal 700 tekens, met witregels tussen aanhef, kern en afsluiting.";
  return [
    `Je schrijft één LinkedIn-bericht namens ${profile.name || "de afzender"} (${profile.headline}).`,
    `Taal: ${lang}.`,
    lengthRule,
    `Aanhef: ${profile.greeting}`,
    profile.opener ? `Eerste zin na de aanhef: ${profile.opener}` : "",
    `Afsluiting: ${profile.closing.replaceAll("{mijnnaam}", profile.name)}`,
    `Over de afzender: ${profile.pitch}`,
    profile.proof ? `Bewijs dat je mag gebruiken als het past: ${profile.proof}` : "",
    `Schrijfregels: ${profile.writingRules}`,
    "Verzin geen feiten over de ontvanger of de afzender. Gebruik alleen de gegevens die je krijgt.",
    "Geef alleen de tekst van het bericht terug, zonder uitleg, aanhalingstekens of opmaak.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function userPrompt(person: Person, icp: Icp): string {
  return [
    "Ontvanger:",
    `- Voornaam: ${person.firstName}`,
    `- Volledige naam: ${person.name}`,
    `- Functie: ${person.title || "onbekend"}`,
    `- Organisatie: ${person.company || "onbekend"}`,
    person.location ? `- Locatie: ${person.location}` : "",
    "",
    `Doelgroep: ${icp.name}`,
    `Wat ik deze groep te bieden heb: ${icp.goal}`,
    icp.messageGuidance ? `Instructie voor dit bericht: ${icp.messageGuidance}` : "",
    "",
    "Schrijf het bericht.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function lengthWarning(text: string, kind: MessageKind, noteLimit: number = CONNECT_LIMIT): string {
  if (kind === "connect" && text.length > noteLimit) {
    return `Te lang voor een connectieverzoek: ${text.length} van ${noteLimit} tekens.`;
  }
  return "";
}
