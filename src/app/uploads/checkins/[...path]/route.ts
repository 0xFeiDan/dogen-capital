import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import {
  getCheckinUploadRoot,
  getImageContentType,
  getLegacyCheckinPublicUploadRoot,
  getSafeUploadPath,
  isAllowedCheckinImagePath,
} from "@/lib/upload-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;

  if (!isAllowedCheckinImagePath(segments)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const candidates = [
    getSafeUploadPath(getCheckinUploadRoot(), segments),
    getSafeUploadPath(getLegacyCheckinPublicUploadRoot(), segments),
  ].filter((item): item is string => Boolean(item));

  for (const filePath of candidates) {
    try {
      const file = await readFile(filePath);
      return new NextResponse(file, {
        headers: {
          "Content-Type": getImageContentType(filePath),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Try the next known upload location.
    }
  }

  return new NextResponse("Not found", { status: 404 });
}
