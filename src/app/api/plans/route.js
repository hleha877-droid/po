import { serializePlans } from "@/server/config/plans";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(serializePlans());
}
