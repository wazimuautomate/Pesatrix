import { redirect } from "next/navigation";

export default function DashboardTasksRedirect() {
  redirect("/tasks");
}