import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const feature = searchParams.get("feature") ?? "power_30_avg";
    const downsample = searchParams.get("downsample") ?? "500";
    const res = await fetch(
      `${FASTAPI_URL}/api/events/${params.eventId}/timeseries?feature=${feature}&downsample=${downsample}`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`FastAPI error: ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch timeseries", details: String(error) },
      { status: 500 }
    );
  }
}
