import { Sidebar } from "@/components/layout/Sidebar";
import { ChatPanel } from "@/components/layout/ChatPanel";
import { BackendGuard } from "@/components/layout/BackendGuard";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <BackendGuard>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
        <ChatPanel />
      </BackendGuard>
    </div>
  );
}
