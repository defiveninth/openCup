import { currentUser } from "@/lib/auth";
import { workspace } from "@/lib/data";
import { Login, WorkspaceApp } from "./workspace";
export async function WorkspacePage() {
  const user = await currentUser();
  if (!user) return <Login local={process.env.NODE_ENV !== "production"} />;
  const kind =
    user.role === "CONTROLLER"
      ? "controller"
      : user.role === "STAFF"
        ? "staff"
        : "admin";
  return (
    <WorkspaceApp key={user.id} kind={kind} initial={await workspace(user)} />
  );
}
