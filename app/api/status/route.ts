import { NextResponse } from "next/server";
import { env } from "@/lib/server";
import type { StatusResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const e = env();
  const body: StatusResponse = {
    apollo: Boolean(e.apolloKey),
    claude: Boolean(e.claudeKey),
    model: e.model,
    protected: Boolean(e.password),
  };
  return NextResponse.json(body);
}
