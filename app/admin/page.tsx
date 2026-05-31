import { AuthProvider } from "@/components/AuthProvider";
import { AdminPanel } from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <AuthProvider>
        <AdminPanel />
      </AuthProvider>
    </section>
  );
}
