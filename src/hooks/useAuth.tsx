import { useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export function useAuth() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState<string>("");
  const [rol, setRol] = useState<string>("usuario");

  const limpiarSesionYNavegar = async () => {
    try {
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith("sb-") && k.includes("auth-token")
      );
      keys.forEach((k) => localStorage.removeItem(k));
      await supabase.auth.signOut({ scope: "local" });
    } catch {
    } finally {
      setSession(null);
      setUser(null);
      setNombre("");
      setRol("usuario");
      navigate("/auth", { replace: true });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !s)) {
        await limpiarSesionYNavegar();
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          supabase.from("profiles").select("nombre, rol").eq("id", s.user.id).maybeSingle()
            .then(({ data }) => {
              setNombre(data?.nombre ?? "");
              setRol(data?.rol ?? "usuario");
            })
            .catch(async (err) => {
              const msg = String(err?.message ?? err);
              if (msg.includes("Refresh Token") || msg.includes("JWT") || msg.includes("Unauthorized")) {
                await limpiarSesionYNavegar();
              }
            });
        }, 0);
      } else {
        setNombre("");
        setRol("usuario");
      }
    });

    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          const msg = String(error?.message ?? error);
          if (msg.includes("Refresh Token") || msg.includes("JWT") || msg.includes("Unauthorized")) {
            await limpiarSesionYNavegar();
            return;
          }
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await supabase.from("profiles").select("nombre, rol").eq("id", session.user.id).maybeSingle()
            .then(({ data }) => {
              setNombre(data?.nombre ?? "");
              setRol(data?.rol ?? "usuario");
            })
            .catch(async (err) => {
              const msg = String(err?.message ?? err);
              if (msg.includes("Refresh Token") || msg.includes("JWT") || msg.includes("Unauthorized")) {
                await limpiarSesionYNavegar();
              }
            });
        }
        setLoading(false);
      })
      .catch(async (err) => {
        const msg = String(err?.message ?? err);
        if (msg.includes("Refresh Token") || msg.includes("JWT") || msg.includes("Unauthorized")) {
          await limpiarSesionYNavegar();
        }
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return { session, user, loading, nombre, setNombre, rol, signOut: limpiarSesionYNavegar };
}
