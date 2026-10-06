import { NextResponse, type NextRequest } from "next/server";

/**
 * Als APP_PASSWORD is ingesteld, vraagt de browser om een wachtwoord (Basic Auth).
 * De gebruikersnaam is vrij te kiezen. Zo kan niemand anders je API-sleutels gebruiken.
 */
export function middleware(req: NextRequest) {
  const password = (process.env.APP_PASSWORD ?? "").trim();
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(given, password)) return NextResponse.next();
    } catch {
      // ongeldige header, val door naar 401
    }
  }
  return new NextResponse("Wachtwoord vereist", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LinkedIn Claude Leads", charset="UTF-8"' },
  });
}

function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
