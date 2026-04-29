import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ClipboardCheck, BarChart3, Home, LogOut, Settings, Moon, Sun, MapIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { nombre, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const modoDiario = theme === "light";

  const items = [
    { to: "/", icon: Home, label: "Inicio" },
    { to: "/resultados", icon: BarChart3, label: "Resultados" },
    { to: "/layout", icon: MapIcon, label: "Layout" },
    { to: "/config", icon: Settings, label: "Config", restricted: true },
  ].filter(it => !it.restricted || user);

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-64">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-card/40 backdrop-blur-xl border-r border-border/50 flex-col p-6">
        <Link to="/" className="flex items-center gap-3 mb-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>5S Inspector</div>
            <div className="text-xs text-muted-foreground">Auditoría mensual</div>
          </div>
        </Link>
        <nav className="space-y-1 flex-1">
          {items.map((it) => {
            const active = it.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(it.to);
            return (
              <Link key={it.to} to={it.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
                <it.icon className="h-4 w-4" />{it.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/50 pt-4 space-y-2">
          {user && (
            <div className="px-3 text-xs">
              <div className="text-muted-foreground">Inspector</div>
              <div className="font-medium truncate">{nombre || "—"}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setTheme(modoDiario ? "dark" : "light")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground transition"
          >
            {modoDiario ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {modoDiario ? "Modo nocturno" : "Modo diario"}
          </button>
          {user ? (
            <button onClick={async () => { await supabase.auth.signOut(); nav("/auth"); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition">
              <LogOut className="h-4 w-4" />Salir
            </button>
          ) : (
            <button onClick={() => nav("/auth")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition">
              <LogOut className="h-4 w-4 rotate-180" />Ingresar
            </button>
          )}
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <ClipboardCheck className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>5S Inspector</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(modoDiario ? "dark" : "light")}
            className="h-9 w-9 rounded-lg hover:bg-muted/40 text-muted-foreground flex items-center justify-center"
            aria-label={modoDiario ? "Cambiar a modo nocturno" : "Cambiar a modo diario"}
          >
            {modoDiario ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          {user ? (
            <button onClick={async () => { await supabase.auth.signOut(); nav("/auth"); }}
              className="text-xs text-muted-foreground flex items-center gap-1">
              <LogOut className="h-3.5 w-3.5" />Salir
            </button>
          ) : (
            <button onClick={() => nav("/auth")}
              className="text-xs text-muted-foreground flex items-center gap-1">
              <LogOut className="h-3.5 w-3.5 rotate-180" />Ingresar
            </button>
          )}
        </div>
      </header>

      <main className="px-4 md:px-10 py-6 md:py-10 max-w-6xl">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className={`md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/90 backdrop-blur-xl border-t border-border/50 grid ${items.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {items.map((it) => {
          const active = it.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(it.to);
          return (
            <Link key={it.to} to={it.to}
              className={`flex flex-col items-center justify-center py-3 gap-1 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>
              <it.icon className="h-5 w-5" />{it.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
