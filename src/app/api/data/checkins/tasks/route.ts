import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { isRecord, isValidCheckinTask, isValidIsoDate } from "@/lib/api/validation";
import { requireAuthenticatedApiRequest, validateSameOriginRequest } from "@/lib/auth/api";
import {
  checkTaskToday,
  deleteCheckinTaskNote,
  listCheckinTaskNotes,
  upsertCheckinTaskNote,
} from "@/lib/checkin-task-notes";
import { isAppUserId } from "@/lib/users";
import type { DailyCheckinTask } from "@/types";

export async function GET(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const date = searchParams.get("date") ?? undefined;

    if (!isAppUserId(profileId)) return badRequest("Invalid profile");
    if (date != null && !isValidIsoDate(date)) return badRequest("Invalid date");

    const tasks = await listCheckinTaskNotes(profileId, date);
    return NextResponse.json({ tasks });
  } catch (error) {
    return serverError(error, "Failed to load check-in tasks");
  }
}

export async function POST(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid request body");
    }

    if (!isRecord(body) || !isAppUserId(body.profileId)) {
      return badRequest("Invalid profile");
    }

    if (body.action === "check") {
      if (typeof body.taskId !== "string") return badRequest("Invalid task");
      const date = body.date == null ? undefined : body.date;
      if (date != null && !isValidIsoDate(date)) return badRequest("Invalid date");

      const task = await checkTaskToday(body.profileId, body.taskId, date);
      return NextResponse.json({ task });
    }

    if (!isValidCheckinTask(body.task)) {
      return badRequest("Invalid task payload");
    }

    const task = await upsertCheckinTaskNote(body.profileId, body.task as DailyCheckinTask);
    return NextResponse.json({ task });
  } catch (error) {
    return serverError(error, "Failed to save check-in task");
  }
}

export async function DELETE(request: Request) {
  try {
    const authError = await requireAuthenticatedApiRequest();
    if (authError) return authError;

    const originError = await validateSameOriginRequest(request);
    if (originError) return originError;

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const taskId = searchParams.get("taskId");

    if (!isAppUserId(profileId) || !taskId) {
      return badRequest("Invalid task");
    }

    await deleteCheckinTaskNote(profileId, taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverError(error, "Failed to delete check-in task");
  }
}
