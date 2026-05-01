import { Outlet } from "react-router-dom";
import { TopBar } from "./TopBar";

export function AppLayout() {
  return (
    <div className="min-h-full app-shell-bg">
      <TopBar />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <Outlet />
      </main>
    </div>
  );
}
