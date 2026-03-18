import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  const url = `${process.env.FASTAPI_URL ?? "http://localhost:8000"}/api/events/${params.eventId}/subsystems`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
