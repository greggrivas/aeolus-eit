import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams.toString();
  const url = `${process.env.FASTAPI_URL ?? "http://localhost:8000"}/api/simulate${params ? "?" + params : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}
