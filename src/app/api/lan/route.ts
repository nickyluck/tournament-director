import { jsonOk } from "@/lib/api";
import { getLanInfo } from "@/lib/lan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonOk(getLanInfo());
}
