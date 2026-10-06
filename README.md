# LinkedIn Claude Leads

Vind beslissers via Apollo.io, laat Claude per persoon een LinkedIn-bericht schrijven in jouw stijl en houd bij wie je hebt benaderd. Je verstuurt zelf. De app automatiseert niets op LinkedIn.

[![Deploy met Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsem-sea%2FLinkedIn-Claude-Leads&project-name=linkedin-claude-leads&repository-name=linkedin-claude-leads&env=APOLLO_API_KEY,ANTHROPIC_API_KEY,APP_PASSWORD&envDescription=Apollo-sleutel%20voor%20zoeken%2C%20Claude-sleutel%20voor%20berichten%2C%20wachtwoord%20om%20de%20app%20af%20te%20schermen.&envLink=https%3A%2F%2Fgithub.com%2Fsem-sea%2FLinkedIn-Claude-Leads%23sleutels)

## Wat het doet

1. **Zoeken.** Je kiest een doelgroep (functietitels, senioriteit, regio, bedrijfsgrootte, trefwoorden) en zoekt in de database van Apollo. Zoeken kost geen Apollo-credits.
2. **Verrijken.** Voor de mensen die je kiest haalt de app het LinkedIn-profiel op. Dat kost ongeveer 1 Apollo-credit per persoon.
3. **Schrijven.** Claude schrijft per persoon een notitie bij een connectieverzoek of een bericht, met jouw aanhef, toon en bewijs. Zonder Claude-sleutel vult de app je eigen sjabloon in.
4. **Versturen en bijhouden.** Je kopieert het bericht, opent het profiel en verstuurt zelf. Daarna zet je de status op Verstuurd, Gereageerd of Gesprek gepland. Een daglimiet houdt je account veilig.
5. **Exporteren.** Leads gaan naar CSV (opent direct goed in Nederlandse Excel) of naar een JSON-back-up.

## Online zetten in 5 minuten

1. Klik op **Deploy met Vercel** hierboven. Vercel maakt een kopie van deze repository in je eigen GitHub-account.
2. Vul de drie sleutels in (zie hieronder) en klik op Deploy.
3. Open de URL die Vercel geeft. Je browser vraagt om een wachtwoord: de gebruikersnaam maakt niet uit, het wachtwoord is je `APP_PASSWORD`.
4. Ga naar **Instellingen** en vul je profiel en doelgroepen in.

Elke gebruiker draait zo zijn eigen kopie met eigen sleutels. Er gaan geen gegevens naar de maker van deze app.

## Sleutels

| Variabele | Waarvoor | Waar haal je hem |
| --- | --- | --- |
| `APOLLO_API_KEY` | Zoeken en verrijken | Apollo: Settings > Integrations > API Keys > Create new key. Kies de endpoints `mixed_people/api_search` en `people/match`, of zet hem als master key. |
| `ANTHROPIC_API_KEY` | Berichten laten schrijven door Claude | Claude Console, zie [API-sleutel aanmaken](https://platform.claude.com/docs/en/get-api-key). |
| `APP_PASSWORD` | Schermt de app af, zodat niet iedereen met de URL jouw credits gebruikt | Kies zelf een sterk wachtwoord. |
| `CLAUDE_MODEL` | Optioneel. Standaard `claude-sonnet-5-5`. | Elk model-ID dat je account mag gebruiken. |

Zonder Apollo-sleutel draait de app in demo-modus met voorbeelddata. Zonder Claude-sleutel werkt alles met sjablonen. Zo kun je het eerst uitproberen.

De sleutels blijven op de server. De browser ziet ze nooit.

## Lokaal draaien

```bash
git clone https://github.com/sem-sea/LinkedIn-Claude-Leads.git
cd LinkedIn-Claude-Leads
cp .env.example .env.local   # vul je sleutels in
npm install
npm run dev
```

Open daarna http://localhost:3000. Node 20 of nieuwer is nodig.

## Zelf instellen

Alles staat onder **Instellingen**:

- **Jouw profiel:** naam, wat je doet, waarmee je helpt, bewijs (klanten, resultaten), aanhef, eerste zin, afsluiting en schrijfregels. Claude gebruikt alleen wat hier staat en verzint geen feiten.
- **Outreach:** notitie bij connectieverzoek of bericht aan een bestaande connectie, je type LinkedIn-account (gratis 200 tekens, Premium 300 tekens) en je daglimiet.
- **Doelgroepen:** per doelgroep wat je biedt, een instructie voor Claude, een sjabloon en de Apollo-filters. Invulvelden in sjablonen: `{voornaam}`, `{bedrijf}`, `{functie}`, `{mijnnaam}`.
- **Delen:** exporteer je instellingen als JSON en geef ze aan een collega. Die importeert het bestand en past alleen naam en bewijs aan.

Instellingen en leads staan in de browser (localStorage). Maak regelmatig een back-up via **Mijn leads > Back-up (JSON)**, zeker als je wisselt van computer of browser.

## Kosten

- **Apollo:** zoeken is gratis. Verrijken kost 1 credit per persoon, en 0 als er niets gevonden wordt. Telefoonnummers en persoonlijke e-mail vraagt de app niet op. Zie [Apollo API-prijzen](https://docs.apollo.io/docs/api-pricing).
- **Claude:** je betaalt per gebruik via je Claude Console-account. De app vraagt maximaal 700 tokens per bericht.
- **Vercel:** het gratis Hobby-plan is genoeg voor persoonlijk gebruik.

## LinkedIn veilig gebruiken

- Verstuur zelf en met de hand. Tools die LinkedIn automatiseren zijn in strijd met de gebruiksvoorwaarden van LinkedIn en kunnen je account laten blokkeren.
- LinkedIn staat ongeveer 100 connectieverzoeken per week toe. Houd 10 tot 25 per dag aan.
- Met een gratis account kun je ongeveer 5 verzoeken per maand met notitie sturen, van maximaal 200 tekens. Met Premium is een notitie maximaal 300 tekens. Stel je accounttype in onder Instellingen, dan bewaakt de app de lengte.

## Privacy (AVG)

Je verwerkt zakelijke persoonsgegevens. Doe dit op basis van gerechtvaardigd belang, benader alleen mensen voor wie je aanbod echt relevant is, en verwijder leads die niet geïnteresseerd zijn. Een lead verwijderen kan per persoon in **Mijn leads**. De app slaat leads alleen op in je eigen browser.

## Techniek

- Next.js 15 (App Router), React 19, TypeScript. Geen database.
- `app/api/apollo/search`: People API Search (`POST /api/v1/mixed_people/api_search`).
- `app/api/apollo/enrich`: People Enrichment (`POST /api/v1/people/match`), maximaal 10 per verzoek.
- `app/api/message`: Claude Messages API. Te lange notities worden één keer automatisch ingekort.
- `middleware.ts`: wachtwoord via Basic Auth als `APP_PASSWORD` is ingesteld.
- Tests: `npm test`. Typecheck: `npm run typecheck`.

## Licentie

MIT, zie [LICENSE](LICENSE).
