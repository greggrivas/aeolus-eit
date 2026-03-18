import { NextResponse } from "next/server";

export async function GET() {
  const url = `${process.env.FASTAPI_URL ?? "http://localhost:8000"}/health`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ status: "unreachable", artifacts_loaded: false, events_loaded: 0 }, { status: 503 });
  }
}
