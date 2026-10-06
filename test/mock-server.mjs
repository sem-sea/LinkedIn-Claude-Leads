// Nep-API voor Apollo en Claude, zodat de hele keten getest kan worden zonder sleutels.
import { createServer } from "node:http";

export function startMock() {
  const calls = { apollo: [], claude: [] };
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const send = (status, json) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };

    if (req.url.startsWith("/apollo/mixed_people/api_search")) {
      calls.apollo.push(req.url);
      return send(200, {
        pagination: { page: 1, total_pages: 1 },
        people: [
          { id: "ap-1", first_name: "Joost", last_name_obfuscated: "Vi***r", title: "VP Marketing", organization: { name: "Demo Security BV" }, city: "Amersfoort", country: "Netherlands" },
          { id: "ap-2", first_name: "Lisa", last_name: "Smit", title: "Chief People Officer", organization: { name: "Voorbeeld Zorggroep" }, city: "Den Haag", country: "Netherlands" },
        ],
      });
    }

    if (req.url === "/claude/v1/messages") {
      const json = JSON.parse(body);
      calls.claude.push(json);
      if (req.headers["x-api-key"] !== "test-key") return send(401, { error: { message: "invalid x-api-key" } });
      const userText = String(json.messages[0].content);
      const first = (userText.match(/Voornaam: (\S+)/) || [])[1] || "";

      // Zoekopdracht naar het LinkedIn-profiel.
      if (json.tools?.some((t) => t.name === "web_search")) {
        const slug = first.toLowerCase();
        if (first === "Mark") {
          // Claude "verzint" een URL die niet in de resultaten staat: moet worden geweigerd.
          return send(200, {
            stop_reason: "end_turn",
            usage: { input_tokens: 500, output_tokens: 40, server_tool_use: { web_search_requests: 1 } },
            content: [
              { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "Mark CIO" } },
              { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: "https://nl.linkedin.com/in/iemand-anders", title: "Iemand anders" }] },
              { type: "text", text: '{"url": "https://www.linkedin.com/in/mark-verzonnen", "naam": "Mark Jansen", "zekerheid": "hoog"}' },
            ],
          });
        }
        if (first === "Joost") {
          // Eerst pause_turn, daarna het antwoord.
          const paused = json.messages.length === 1;
          if (paused) {
            return send(200, {
              stop_reason: "pause_turn",
              usage: { input_tokens: 300, output_tokens: 10, server_tool_use: { web_search_requests: 1 } },
              content: [
                { type: "server_tool_use", id: "s2", name: "web_search", input: { query: "Joost VP Marketing Demo Security" } },
                { type: "web_search_tool_result", tool_use_id: "s2", content: [{ type: "web_search_result", url: "https://nl.linkedin.com/in/joostvisser-demo/", title: "Joost Visser - VP Marketing - Demo Security BV" }] },
              ],
            });
          }
          return send(200, {
            stop_reason: "end_turn",
            usage: { input_tokens: 400, output_tokens: 30, server_tool_use: { web_search_requests: 0 } },
            content: [{ type: "text", text: 'Gevonden.\n```json\n{"url": "https://www.linkedin.com/in/joostvisser-demo", "naam": "Joost Visser", "zekerheid": "hoog"}\n```' }],
          });
        }
        return send(200, {
          stop_reason: "end_turn",
          usage: { input_tokens: 450, output_tokens: 35, server_tool_use: { web_search_requests: 1 } },
          content: [
            { type: "server_tool_use", id: "s3", name: "web_search", input: { query: `${first} LinkedIn` } },
            { type: "web_search_tool_result", tool_use_id: "s3", content: [{ type: "web_search_result", url: `https://nl.linkedin.com/in/${slug}-voorbeeld`, title: `${first} - LinkedIn` }] },
            { type: "text", text: `{"url": "https://nl.linkedin.com/in/${slug}-voorbeeld", "naam": "${first} Voorbeeld", "zekerheid": "middel"}` },
          ],
        });
      }

      // Bericht schrijven.
      const isRetry = json.messages.length > 1;
      const longMsg = `Goedendag ${first},\n\nHopelijk is alles goed? ${"Dit is een veel te lange zin die blijft doorgaan. ".repeat(8)}Zou je openstaan voor een kort gesprek?\n\nMet vriendelijke groet,\nJouw`;
      const okMsg = `Goedendag ${first},\n\nHopelijk is alles goed? Ik help teams met AI \u2014 praktisch en veilig. Zou je openstaan voor een kort gesprek?\n\nMet vriendelijke groet,\nJouw`;
      const groep = first === "Mark" ? "overheid" : first === "Sanne" ? "marketing" : "bestaat-niet";
      const msg = first === "Sanne" && !isRetry ? longMsg : okMsg;
      return send(200, {
        stop_reason: "end_turn",
        usage: { input_tokens: 800, output_tokens: 120 },
        content: [{ type: "text", text: JSON.stringify({ groep, prioriteit: first === "Mark" ? "A" : "B", icp: first !== "Lisa", bericht: msg }) }],
      });
    }

    send(404, { error: { message: "not found" } });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ url: `http://127.0.0.1:${port}`, calls, close: () => new Promise((r) => server.close(r)) });
    });
  });
}
