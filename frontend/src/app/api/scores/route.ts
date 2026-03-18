import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint") ?? "summary";
    const res = await fetch(`${FASTAPI_URL}/api/scores/${endpoint}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`FastAPI error: ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch scores", details: String(error) },
      { status: 500 }
    );
  }
}
