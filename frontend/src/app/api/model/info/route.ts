import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI_URL}/api/model/info`, { cache: "no-store" });
    if (!res.ok) throw new Error(`FastAPI error: ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch model info", details: String(error) },
      { status: 500 }
    );
  }
}
