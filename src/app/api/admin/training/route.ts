import { NextResponse } from "next/server";
import { requireAdmin } from "../_lib";
import { fetchAdminTrainingList } from "@/lib/admin-training";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const statusFilter = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";

  const result = await fetchAdminTrainingList({
    page,
    limit,
    search,
    status: statusFilter,
  });

  return NextResponse.json(result);
}
