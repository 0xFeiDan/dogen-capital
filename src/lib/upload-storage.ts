import path from "path";

const CHECKIN_UPLOAD_DIR = path.join("uploads", "checkins");

export function getCheckinUploadRoot() {
  const configured = process.env.DOGEN_UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? path.join(configured, "checkins")
      : path.join(process.cwd(), configured, "checkins");
  }

  return path.join(process.cwd(), CHECKIN_UPLOAD_DIR);
}

export function getLegacyCheckinPublicUploadRoot() {
  return path.join(process.cwd(), "public", CHECKIN_UPLOAD_DIR);
}

export function getSafeUploadPath(root: string, segments: string[]) {
  const target = path.join(root, ...segments);
  const relative = path.relative(root, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return target;
}

export function isAllowedCheckinImagePath(segments: string[]) {
  if (segments.length !== 2) return false;
  if (!/^\d{4}-\d{2}$/.test(segments[0])) return false;
  return /^[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(segments[1]);
}

export function getImageContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}
