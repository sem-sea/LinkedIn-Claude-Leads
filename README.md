# Apollo naar LinkedIn-outreach

Je geeft leads uit Apollo. Claude zoekt per persoon het LinkedIn-profiel, deelt de persoon in bij jouw doelgroepen en schrijft een persoonlijke notitie in jouw stijl. Je krijgt één lijst in je browser met status, "Kopieer bericht" en "Open op LinkedIn". Versturen doe je zelf.

## Wat er gebeurt

1. **Leads inlezen** uit een Apollo CSV-export, of direct uit Apollo met `--zoek`. Zoeken via de Apollo-API kost geen credits.
2. **LinkedIn-profiel zoeken** met de zoekfunctie van Claude, alleen op linkedin.com. Een profiel telt alleen als de URL echt in de zoekresultaten stond. Twijfelt Claude, dan krijg je een zoeklink op naam in plaats van een verkeerd profiel. Staat de URL al in de Apollo-export, dan wordt er niet gezocht.
3. **Indelen en schrijven.** Claude kiest de groep uit `config.json`, geeft prioriteit A of B en schrijft de notitie (maximaal 300 tekens, aanhef "Goedendag {voornaam},").
4. **Lijst** in `output/outreach.html`, plus `outreach.csv` voor Excel en `outreach.json`.

## Installeren (eenmalig)

Je hebt [Node.js](https://nodejs.org) 20 of nieuwer nodig.

```bash
git clone https://github.com/sem-sea/LinkedIn-Claude-Leads.git
cd LinkedIn-Claude-Leads
cp .env.example .env
cp config.voorbeeld.json config.json
```

- Zet je Claude-sleutel in `.env` bij `ANTHROPIC_API_KEY`. Een sleutel maak je aan in de [Claude Console](https://platform.claude.com/docs/en/get-api-key).
- Web search moet aan staan voor je organisatie in de Claude Console. Staat hij uit, dan meldt het script dat direct.
- Pas `config.json` aan: je naam, wat je doet, je bewijs, je doelgroepen en je basisteksten.
- Alleen voor `--zoek`: zet je Apollo-sleutel bij `APOLLO_API_KEY`. In Apollo: Settings > Integrations > API Keys, met toegang tot `mixed_people/api_search`.

## Gebruik

**Met een Apollo-export**

1. Filter in Apollo je mensen, selecteer ze en kies Export > CSV.
2. Zet het bestand in de map `input`.
3. Draai:

```bash
npm start -- input/apollo-export.csv
```

**Direct uit Apollo**, met de filters onder `apollo` in `config.json`:

```bash
npm start -- --zoek --max 25
```

Open daarna `output/outreach.html` in je browser.

Draai je het later opnieuw, dan worden alleen nieuwe leads toegevoegd. Wat je in de lijst op Verstuurd of Gereageerd hebt gezet, blijft bewaard in je browser. Met "Exporteer CSV met status" maak je een back-up.

Opties: `--max 25` (aantal nieuwe leads per keer), `--zonder-zoeken` (geen LinkedIn-profielen zoeken), `--config ander.json`, `--uit andere-map`.

## Instellingen (config.json)

| Onderdeel | Wat |
| --- | --- |
| `afzender` | Je naam, wat je doet, bewijs dat Claude mag noemen, schrijfregels. Claude verzint niets daarbuiten. |
| `bericht` | `connectieverzoek` (notitie, 300 tekens) of `bericht` (bestaande connectie, 700 tekens). Zet `maxTekens` op 200 bij een gratis LinkedIn-account. Aanhef, opening en afsluiting. |
| `sporen` | De tabbladen bovenin de lijst, bijvoorbeeld per bedrijf. |
| `groepen` | Je doelgroepen: label, spoor, wie erin hoort, wat je ze biedt en een basistekst. |
| `standaardGroep` | Waar iemand terechtkomt als geen groep past. |
| `apollo` | Filters voor `--zoek`: functies, senioriteit, locaties, bedrijfsgrootte (`51,200`), trefwoorden. |
| `dagLimiet`, `maxPerKeer` | Teller in de lijst en het aantal leads per run. |

## Kosten

- **Claude:** web search kost $10 per 1000 zoekopdrachten plus tokens. Het script doet maximaal 3 zoekopdrachten per persoon en toont na afloop wat er is verbruikt.
- **Apollo:** zoeken met `--zoek` is gratis. Een CSV-export kan exportcredits kosten, afhankelijk van je abonnement.

## LinkedIn en privacy

- Verstuur zelf en met de hand. Dit script doet niets op LinkedIn zelf.
- Houd 10 tot 25 verzoeken per dag aan; LinkedIn staat ongeveer 100 per week toe.
- Leads blijven op je eigen computer. `input/`, `output/`, `.env` en `config.json` staan in `.gitignore`. Zet nooit leadbestanden in een publieke repository.

## Testen

```bash
npm test
```

De tests draaien de hele keten tegen een nep-API van Apollo en Claude, zonder sleutels.

## Licentie

MIT
