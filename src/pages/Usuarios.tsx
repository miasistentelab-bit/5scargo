import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus, Shield } from "lucide-react";
import { toast } from "sonner";

type Profile = { id: string; nombre: string; rol: string };

export default function Usuarios() {
  const { user, loading, signOut, rol } = useAuth();
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({ email: "", nombre: "", rol: "usuario" });
  const [showUsuarioForm, setShowUsuarioForm] = useState(false);
  const isAdmin = rol === "admin";

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);

  const reload = async () => {
    if (isAdmin) {
      const { data: profiles } = await supabase.from("profiles").select("id, nombre, rol");
      if (profiles) {
        setUsuarios(profiles as unknown as Profile[]);
      }
    }
  };

  useEffect(() => { if (user) reload(); }, [user]);

  const crearUsuario = async () => {
    if (!isAdmin) return;
    const { email, nombre, rol } = nuevoUsuario;
    if (!email || !nombre) {
      return toast.error("Email y nombre son requeridos");
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: "Temp123!",
        options: {
          data: { nombre, rol },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario");

      toast.success("Usuario creado exitosamente. La contraseña temporal es: Temp123!");
      setNuevoUsuario({ email: "", nombre: "", rol: "usuario" });
      setShowUsuarioForm(false);
      reload();
    } catch (error: any) {
      toast.error(error.message || "Error al crear usuario");
    }
  };

  const actualizarRolUsuario = async (userId: string, nuevoRol: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from("profiles").update({ rol: nuevoRol }).eq("id", userId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Rol actualizado");
      reload();
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Acceso restringido</h2>
          <p className="text-muted-foreground">Solo los administradores pueden acceder a esta sección.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-semibold">Administración</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Gestión de Usuarios
        </h1>
        <p className="text-muted-foreground mt-2">Crea y administra los usuarios del sistema.</p>
      </header>

      <Card className="p-5 bg-gradient-surface border-border/50 shadow-card">
        {!showUsuarioForm ? (
          <Button onClick={() => setShowUsuarioForm(true)} variant="outline" className="mb-4">
            <UserPlus className="h-4 w-4 mr-2" />
            Crear nuevo usuario
          </Button>
        ) : (
          <div className="mb-4 p-4 bg-muted/30 rounded-lg space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input
                type="email"
                placeholder="usuario@ejemplo.com"
                value={nuevoUsuario.email}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre</label>
              <Input
                placeholder="Nombre del usuario"
                value={nuevoUsuario.nombre}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Rol</label>
              <select
                value={nuevoUsuario.rol}
                onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
                className="w-full p-2 rounded-md border border-border bg-background"
              >
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={crearUsuario} variant="hero">
                <UserPlus className="h-4 w-4 mr-2" />
                Crear usuario
              </Button>
              <Button onClick={() => setShowUsuarioForm(false)} variant="outline">
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{u.nombre}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {u.rol}
                  </span>
                </div>
              </div>
              {u.id !== user?.id && (
                <select
                  value={u.rol}
                  onChange={(e) => actualizarRolUsuario(u.id, e.target.value)}
                  className="p-1.5 text-sm rounded-md border border-border bg-background"
                >
                  <option value="usuario">Usuario</option>
                  <option value="admin">Admin</option>
                </select>
              )}
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  );
}
