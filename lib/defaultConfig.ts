import type { AppConfig } from "./types.ts";

/**
 * Standaardinstellingen voor een nieuwe gebruiker. Alles is in de app aan te passen
 * onder Instellingen, en te exporteren of importeren als JSON.
 */
export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  dailyLimit: 25,
  messageKind: "connect",
  noteLimit: 300,
  profile: {
    name: "Jouw naam",
    headline: "Wat je doet, in één regel",
    pitch: "Waarmee je organisaties helpt, in twee of drie zinnen.",
    proof: "Concrete klanten, resultaten of ervaring die je geloofwaardig maken.",
    greeting: "Goedendag {voornaam},",
    opener: "Hopelijk is alles goed?",
    closing: "Met vriendelijke groet,\n{mijnnaam}",
    writingRules:
      "Schrijf in correct Nederlands, beleefd en menselijk. Geen marketingtaal, geen emoji, geen gedachtestreepjes. Kort en concreet. Eén duidelijke vraag aan het eind.",
    language: "nl",
  },
  icps: [
    {
      id: "marketing-b2b",
      name: "Marketingleiders B2B",
      goal: "Ik help B2B-marketingteams aan meer pipeline. Ik wil weten tegen welke uitdagingen ze nu aanlopen.",
      messageGuidance: "Sluit af met de vraag of ze openstaan voor een kort, vrijblijvend gesprek over hun huidige uitdagingen.",
      template:
        "Goedendag {voornaam},\n\nHopelijk is alles goed? Ik help B2B-marketingteams aan meer pipeline. Ik ben benieuwd tegen welke uitdagingen jullie bij {bedrijf} op dit moment aanlopen. Zou je openstaan voor een kort, vrijblijvend gesprek?\n\nMet vriendelijke groet,\n{mijnnaam}",
      filters: {
        titles: ["CMO", "Head of Marketing", "Marketing Director", "VP Marketing"],
        seniorities: ["c_suite", "vp", "head", "director"],
        personLocations: ["Netherlands"],
        organizationLocations: [],
        employeeRanges: ["51,200", "201,500", "501,1000"],
        keywords: "SaaS",
      },
    },
    {
      id: "hr-directie",
      name: "HR-directeuren",
      goal: "AI in werving en selectie valt onder de AI Act in de categorie hoog risico. Ik help HR-teams dit praktisch in te richten.",
      messageGuidance: "Noem de AI Act kort en zakelijk. Vraag of ze openstaan voor een kort gesprek over hoe zij hiermee bezig zijn.",
      template:
        "Goedendag {voornaam},\n\nHopelijk is alles goed? AI in werving en selectie valt onder de AI Act in de categorie hoog risico. Ik help HR-teams om dat praktisch in te richten. Ik ben benieuwd hoe jullie bij {bedrijf} hiermee bezig zijn. Zou je openstaan voor een kort gesprek?\n\nMet vriendelijke groet,\n{mijnnaam}",
      filters: {
        titles: ["HR Director", "CHRO", "Head of HR", "Chief People Officer"],
        seniorities: ["c_suite", "head", "director"],
        personLocations: ["Netherlands"],
        organizationLocations: [],
        employeeRanges: ["201,500", "501,1000", "1001,5000"],
        keywords: "",
      },
    },
  ],
};
