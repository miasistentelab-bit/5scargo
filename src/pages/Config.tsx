import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Camera, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function Config() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sectores, setSectores] = useState<any[]>([]);
  const [subsBySec, setSubsBySec] = useState<Record<string, any[]>>({});
  const [nuevo, setNuevo] = useState<Record<string, string>>({});

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);

  const reload = async () => {
    const { data: secs } = await supabase.from("sectores").select("*").order("orden");
    setSectores(secs ?? []);
    const { data: subs } = await supabase.from("sub_items").select("*").order("orden");
    const map: Record<string, any[]> = {};
    (subs ?? []).forEach((s: any) => { (map[s.sector_id] = map[s.sector_id] ?? []).push(s); });
    setSubsBySec(map);
  };

  useEffect(() => { if (user) reload(); }, [user]);

  const addSub = async (sectorId: string) => {
    const nombre = (nuevo[sectorId] ?? "").trim();
    if (!nombre) return;
    const orden = (subsBySec[sectorId]?.length ?? 0) + 1;
    const { error } = await supabase.from("sub_items").insert({ sector_id: sectorId, nombre, orden });
    if (error) return toast.error(error.message);
    setNuevo({ ...nuevo, [sectorId]: "" });
    reload();
  };

  const delSub = async (id: string) => {
    const { error } = await supabase.from("sub_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  };

  const subirMaestra = async (subId: string, file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/maestras/${subId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data: signed } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (!signed) return;
    await supabase.from("sub_items").update({ foto_maestra_url: signed.signedUrl }).eq("id", subId);
    toast.success("Foto maestra actualizada");
    reload();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-semibold">Configuración</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Sectores y sub-ítems
        </h1>
        <p className="text-muted-foreground mt-2">Editá las áreas a auditar y subí fotos maestras (estado ideal) para usar la comparación con IA.</p>
      </header>

      <div className="space-y-4">
        {sectores.map((s) => (
          <Card key={s.id} className="p-5 bg-gradient-surface border-border/50 shadow-card">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <span className="text-2xl">{s.emoji}</span>{s.nombre}
            </h2>
            <div className="space-y-2 mb-4">
              {(subsBySec[s.id] ?? []).map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <span className="flex-1 text-sm font-medium truncate">{sub.nombre}</span>
                  {sub.foto_maestra_url ? (
                    <img src={sub.foto_maestra_url} className="h-9 w-9 rounded object-cover" alt="maestra" />
                  ) : (
                    <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) subirMaestra(sub.id, f); }} />
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted text-muted-foreground"><Camera className="h-4 w-4" /></span>
                  </label>
                  <button onClick={() => delSub(sub.id)} className="h-8 w-8 rounded hover:bg-destructive/10 text-destructive flex items-center justify-center">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="Nuevo sub-ítem (ej. Estantería C)"
                value={nuevo[s.id] ?? ""} onChange={(e) => setNuevo({ ...nuevo, [s.id]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addSub(s.id)} />
              <Button variant="hero" onClick={() => addSub(s.id)}><Plus className="h-4 w-4" />Agregar</Button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
