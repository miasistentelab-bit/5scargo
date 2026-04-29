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

type MaestraFoto = {
  id: string;
  sub_item_id: string;
  url: string;
  storage_path: string | null;
  source: "table" | "legacy";
};

type Sector = { id: string; nombre: string; emoji: string; orden: number };
type SubItem = { id: string; sector_id: string; nombre: string; foto_maestra_url: string | null; orden: number; created_at: string };
type MaestraRow = { id: string; sub_item_id: string; url: string; storage_path: string | null; created_at: string };

export default function Config() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [subsBySec, setSubsBySec] = useState<Record<string, SubItem[]>>({});
  const [maestrasBySub, setMaestrasBySub] = useState<Record<string, MaestraFoto[]>>({});
  const [nuevo, setNuevo] = useState<Record<string, string>>({});

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);

  const extractStoragePath = (url: string) => {
    try {
      const u = new URL(url);
      const prefixes = ["/storage/v1/object/sign/evidencias/", "/storage/v1/object/public/evidencias/"];
      const match = prefixes.map((p) => ({ p, idx: u.pathname.indexOf(p) })).find((x) => x.idx !== -1);
      if (!match) return null;
      return decodeURIComponent(u.pathname.slice(match.idx + match.p.length));
    } catch {
      return null;
    }
  };

  const reload = async () => {
    const { data: secs } = await supabase.from("sectores").select("*").order("orden");
    setSectores((secs ?? []) as unknown as Sector[]);
    const { data: subs } = await supabase.from("sub_items").select("*").order("orden");
    const subsTyped = (subs ?? []) as unknown as SubItem[];
    const map: Record<string, SubItem[]> = {};
    for (const s of subsTyped) (map[s.sector_id] = map[s.sector_id] ?? []).push(s);
    setSubsBySec(map);
    const subIds = subsTyped.map((s) => s.id);
    if (subIds.length) {
      const { data: maestras } = await supabase
        .from("sub_item_maestras")
        .select("id, sub_item_id, url, storage_path, created_at")
        .in("sub_item_id", subIds)
        .order("created_at", { ascending: true });
      const by: Record<string, MaestraFoto[]> = {};
      ((maestras ?? []) as unknown as MaestraRow[]).forEach((m) => {
        (by[m.sub_item_id] = by[m.sub_item_id] ?? []).push({
          id: m.id,
          sub_item_id: m.sub_item_id,
          url: m.url,
          storage_path: m.storage_path,
          source: "table",
        });
      });
      subsTyped.forEach((sub) => {
        const current = by[sub.id] ?? [];
        if (sub.foto_maestra_url) {
          const legacy: MaestraFoto = {
            id: `legacy:${sub.id}`,
            sub_item_id: sub.id,
            url: sub.foto_maestra_url,
            storage_path: extractStoragePath(sub.foto_maestra_url),
            source: "legacy",
          };
          by[sub.id] = [legacy, ...current].slice(0, 4);
        } else {
          by[sub.id] = current.slice(0, 4);
        }
      });
      setMaestrasBySub(by);
    } else {
      setMaestrasBySub({});
    }
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
    const current = maestrasBySub[subId] ?? [];
    if (current.length >= 4) return toast.error("Máximo 4 fotos originales por ítem");
    const ext = file.name.split(".").pop();
    const path = `${user.id}/maestras/${subId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data: signed } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (!signed) return;
    const { data: saved, error: insErr } = await supabase
      .from("sub_item_maestras")
      .insert({ sub_item_id: subId, storage_path: path, url: signed.signedUrl })
      .select("id, sub_item_id, url, storage_path")
      .single();
    if (insErr) {
      await supabase.storage.from("evidencias").remove([path]);
      return toast.error(insErr.message);
    }
    const savedFoto: MaestraFoto = {
      id: saved!.id,
      sub_item_id: saved!.sub_item_id,
      url: saved!.url,
      storage_path: saved!.storage_path,
      source: "table",
    };
    setMaestrasBySub((prev) => ({
      ...prev,
      [subId]: [...(prev[subId] ?? []), savedFoto],
    }));
    toast.success("Foto original agregada");
  };

  const eliminarMaestra = async (foto: MaestraFoto) => {
    if (!user) return;
    if (foto.source === "legacy") {
      const { error } = await supabase.from("sub_items").update({ foto_maestra_url: null }).eq("id", foto.sub_item_id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("sub_item_maestras").delete().eq("id", foto.id);
      if (error) return toast.error(error.message);
    }
    if (foto.storage_path) {
      await supabase.storage.from("evidencias").remove([foto.storage_path]);
    }
    setMaestrasBySub((prev) => ({
      ...prev,
      [foto.sub_item_id]: (prev[foto.sub_item_id] ?? []).filter((m) => m.id !== foto.id),
    }));
    toast.success("Foto original eliminada");
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
                  <div className="flex items-center gap-1">
                    {(maestrasBySub[sub.id] ?? []).slice(0, 4).map((m) => (
                      <div key={m.id} className="relative h-9 w-9 rounded overflow-hidden border border-border/50">
                        <img src={m.url} className="h-9 w-9 object-cover" alt="maestra" />
                        <button
                          type="button"
                          onClick={() => eliminarMaestra(m)}
                          className="absolute inset-0 bg-background/40 opacity-0 hover:opacity-100 transition flex items-center justify-center"
                          aria-label="Eliminar foto original"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    ))}
                    {!((maestrasBySub[sub.id] ?? []).length) && (
                      <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <label className={`cursor-pointer ${((maestrasBySub[sub.id] ?? []).length >= 4) ? "opacity-50 pointer-events-none" : ""}`}>
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
