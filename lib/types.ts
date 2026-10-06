export const SENIORITIES = [
  "owner",
  "founder",
  "c_suite",
  "partner",
  "vp",
  "head",
  "director",
  "manager",
  "senior",
  "entry",
  "intern",
] as const;

export type Seniority = (typeof SENIORITIES)[number];

export const SENIORITY_LABELS: Record<Seniority, string> = {
  owner: "Eigenaar",
  founder: "Oprichter",
  c_suite: "C-level",
  partner: "Partner",
  vp: "VP",
  head: "Head of",
  director: "Directeur",
  manager: "Manager",
  senior: "Senior",
  entry: "Starter",
  intern: "Stagiair",
};

/** Filters die direct naar de Apollo People API Search gaan. */
export interface ApolloFilters {
  titles: string[];
  seniorities: Seniority[];
  personLocations: string[];
  organizationLocations: string[];
  employeeRanges: string[];
  keywords: string;
}

export interface Icp {
  id: string;
  name: string;
  /** Wat je deze groep te bieden hebt en waarom nu. */
  goal: string;
  /** Extra instructie voor het bericht, bijvoorbeeld de call to action. */
  messageGuidance: string;
  /** Sjabloon voor de sjabloonmodus. {voornaam}, {bedrijf} en {functie} worden ingevuld. */
  template: string;
  filters: ApolloFilters;
}

export interface Profile {
  name: string;
  headline: string;
  pitch: string;
  proof: string;
  greeting: string;
  opener: string;
  closing: string;
  writingRules: string;
  language: "nl" | "en";
}

export type MessageKind = "connect" | "message";

export type NoteLimit = 200 | 300;

export interface AppConfig {
  version: 1;
  profile: Profile;
  icps: Icp[];
  dailyLimit: number;
  messageKind: MessageKind;
  /** Maximale lengte van een notitie bij een connectieverzoek: 200 (gratis account) of 300 (Premium). */
  noteLimit: NoteLimit;
}

/** Een persoon zoals die uit Apollo komt (search of enrichment). */
export interface Person {
  apolloId: string;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  company: string;
  location: string;
  linkedinUrl: string;
  email: string;
  emailStatus: string;
  enriched: boolean;
}

export const STATUSES = ["todo", "sent", "replied", "meeting", "skip"] as const;
export type LeadStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  todo: "Te doen",
  sent: "Verstuurd",
  replied: "Gereageerd",
  meeting: "Gesprek gepland",
  skip: "Overslaan",
};

export interface Lead extends Person {
  icpId: string;
  status: LeadStatus;
  message: string;
  notes: string;
  addedAt: string;
  sentAt: string;
}

export interface SearchResult {
  people: Person[];
  page: number;
  totalPages: number;
  totalEntries: number;
  demo: boolean;
}

export interface StatusResponse {
  apollo: boolean;
  claude: boolean;
  model: string;
  protected: boolean;
}
