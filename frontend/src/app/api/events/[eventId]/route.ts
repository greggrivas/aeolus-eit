import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/events/${params.eventId}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`FastAPI error: ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch event", details: String(error) },
      { status: 500 }
    );
  }
}
