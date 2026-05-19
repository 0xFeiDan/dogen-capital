import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function getSafeExtension(file: File) {
  const mimeExtension = ALLOWED_TYPES.get(file.type);
  if (!mimeExtension) return null;

  const originalExtension = path.extname(file.name).toLowerCase();
  if (originalExtension === ".jpeg") return ".jpg";
  if ([".jpg", ".png", ".webp"].includes(originalExtension)) return originalExtension;

  return mimeExtension;
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return badRequest("Missing image file");
    }

    const extension = getSafeExtension(file);
    if (!extension) {
      return badRequest("Only jpg, jpeg, png and webp images are allowed");
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return badRequest("Image must be smaller than 10MB");
    }

    const now = new Date();
    const folder = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "checkins", folder);
    const fileName = `${randomUUID()}${extension}`;
    const diskPath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({
      url: `/uploads/checkins/${folder}/${fileName}`,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    return serverError(error, "Failed to upload image");
  }
}
