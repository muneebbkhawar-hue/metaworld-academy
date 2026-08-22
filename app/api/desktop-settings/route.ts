import { NextRequest, NextResponse } from "next/server";
import fs from "fs";

// Desktop-app-only settings endpoint: lets the in-app Settings page save the
// USER's OWN Gemini API key to a local config file on their machine
// (electron/main.js passes its path via DESKTOP_CONFIG_PATH and injects it
// as GEMINI_API_KEY when it spawns this server). Returns 404 on the live
// website (Vercel), where DESKTOP_CONFIG_PATH is never set, so this route
// has no effect there and adds no attack surface to the production
// deployment - it simply doesn't exist outside the desktop build.
//
// The key itself is never returned by GET, only whether one is present -
// this file is local-only, but there's no reason to ever echo the value
// back over HTTP even to localhost.

export const runtime = "nodejs";

function configPath(): string | null {
  return process.env.DESKTOP_CONFIG_PATH || null;
}

function readConfig(path: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

export async function GET() {
  const path = configPath();
  if (!path) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const config = readConfig(path);
  return NextResponse.json({
    hasGeminiKey: typeof config.geminiApiKey === "string" && config.geminiApiKey.length > 0,
    geminiModel: typeof config.geminiModel === "string" ? config.geminiModel : "",
  });
}

export async function POST(req: NextRequest) {
  const path = configPath();
  if (!path) return NextResponse.json({ error: "Not available" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { geminiApiKey, geminiModel } = body as { geminiApiKey?: string; geminiModel?: string };
  if (geminiApiKey !== undefined && typeof geminiApiKey !== "string") {
    return NextResponse.json({ error: "geminiApiKey must be a string" }, { status: 400 });
  }

  const existing = readConfig(path);
  const next = {
    ...existing,
    ...(geminiApiKey !== undefined ? { geminiApiKey } : {}),
    ...(geminiModel !== undefined ? { geminiModel } : {}),
  };

  try {
    fs.writeFileSync(path, JSON.stringify(next, null, 2), "utf8");
  } catch {
    return NextResponse.json({ error: "Could not save settings locally." }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
