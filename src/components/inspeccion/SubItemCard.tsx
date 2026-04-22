import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera, Sparkles, ChevronDown, ChevronUp, Lock, Check } from "lucide-react";
import { CINCO_S, NIVELES, semaforo } from "@/lib/scoring";
import { ProgressBar } from "./ProgressBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DetalleData = {
  id?: string;
  sub_item_id: string;
  sub_item_nombre: string;
  s1_puntaje: number | null;
  s2_puntaje: number | null;
  s3_puntaje: number | null;
  s4_puntaje: number | null;
  s5_puntaje: number | null;
  promedio: number | null;
  foto_evidencia_url: string | null;
  observaciones: string | null;
  ia_sugerido_puntaje: number | null;
  ia_comentario: string | null;
};

type Props = {
  detalle: DetalleData;
  fotoMaestraUrl: string | null;
  inspeccionId: string;
  userId: string;
  bloqueada: boolean;
  onChange: (d: DetalleData) => void;
};

export function SubItemCard({ detalle, fotoMaestraUrl, inspeccionId, userId, bloqueada, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [uploading, setUploading] = useState(false);

  const promedio = (() => {
    const vals = CINCO_S.map((s) => detalle[s.key]).filter((v) => v != null) as number[];
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / 5;
  })();

  const todoCompleto = CINCO_S.every((s) => detalle[s.key] != null);

  const setNivel = (key: keyof DetalleData, val: number) => {
    onChange({ ...detalle, [key]: val });
  };

  const persistir = async (data: DetalleData) => {
    setSaving(true);
    const payload = {
      inspeccion_id: inspeccionId,
      sub_item_id: data.sub_item_id,
      sub_item_nombre: data.sub_item_nombre,
      s1_puntaje: data.s1_puntaje,
      s2_puntaje: data.s2_puntaje,
      s3_puntaje: data.s3_puntaje,
      s4_puntaje: data.s4_puntaje,
      s5_puntaje: data.s5_puntaje,
      foto_evidencia_url: data.foto_evidencia_url,
      observaciones: data.observaciones,
      ia_sugerido_puntaje: data.ia_sugerido_puntaje,
      ia_comentario: data.ia_comentario,
    };
    const { data: saved, error } = await supabase.from("detalles_inspeccion")
      .upsert(payload, { onConflict: "inspeccion_id,sub_item_id" })
      .select("id, promedio").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onChange({ ...data, id: saved.id, promedio: Number(saved.promedio) });
    toast.success("Guardado");
  };

  const subirFoto = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${inspeccionId}/${detalle.sub_item_id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file, { upsert: true });
    if (error) { setUploading(false); toast.error(error.message); return null; }
    const { data: signed } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 60 * 24 * 365);
    setUploading(false);
    return signed?.signedUrl ?? null;
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await subirFoto(f);
    if (!url) return;
    const next = { ...detalle, foto_evidencia_url: url };
    onChange(next);
    await persistir(next);
  };

  const analizarConIA = async () => {
    if (!detalle.foto_evidencia_url) return toast.error("Subí primero una foto de evidencia");
    setAnalizando(true);
    const { data, error } = await supabase.functions.invoke("comparar-foto", {
      body: {
        fotoActualUrl: detalle.foto_evidencia_url,
        fotoMaestraUrl,
        subItemNombre: detalle.sub_item_nombre,
      },
    });
    setAnalizando(false);
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    const next: DetalleData = {
      ...detalle,
      s1_puntaje: (data as any).s1_seiri,
      s2_puntaje: (data as any).s2_seiton,
      s3_puntaje: (data as any).s3_seiso,
      s4_puntaje: (data as any).s4_seiketsu,
      s5_puntaje: (data as any).s5_shitsuke,
      ia_sugerido_puntaje: (data as any).puntaje,
      ia_comentario: (data as any).comentario,
    };
    onChange(next);
    toast.success("IA sugirió puntajes — revisalos y guardá");
  };

  const sem = semaforo(promedio);

  return (
    <Card className="overflow-hidden bg-gradient-surface border-border/50 shadow-card">
      <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/20 transition">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{detalle.sub_item_nombre}</h3>
            {todoCompleto && <Check className="h-4 w-4 text-success shrink-0" />}
          </div>
          <ProgressBar value={promedio} showLabel={false} height="h-1.5" />
        </div>
        <span className="text-lg font-bold tabular-nums" style={{ color: sem.bg }}>
          {promedio.toFixed(0)}%
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5 border-t border-border/50 pt-4">
          {/* IA */}
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1">
              <input type="file" accept="image/*" capture="environment" className="hidden"
                disabled={bloqueada || uploading} onChange={handleFoto} />
              <span className={`flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed border-border bg-muted/30 text-sm cursor-pointer hover:bg-muted/50 transition ${bloqueada ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {detalle.foto_evidencia_url ? "Cambiar foto" : "Tomar / subir foto"}
              </span>
            </label>
            <Button variant="hero" disabled={bloqueada || analizando || !detalle.foto_evidencia_url} onClick={analizarConIA} className="h-11">
              {analizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Sugerir con IA
            </Button>
          </div>

          {detalle.foto_evidencia_url && (
            <img src={detalle.foto_evidencia_url} alt="evidencia" className="w-full h-40 object-cover rounded-lg" />
          )}

          {detalle.ia_comentario && (
            <div className="text-xs p-3 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-1.5 mb-1 text-primary font-semibold">
                <Sparkles className="h-3 w-3" />IA · {detalle.ia_sugerido_puntaje}%
              </div>
              <p className="text-foreground/90">{detalle.ia_comentario}</p>
            </div>
          )}

          {/* 5S */}
          <div className="space-y-3">
            {CINCO_S.map((s) => {
              const val = detalle[s.key];
              return (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-primary">{s.codigo}</span>
                      <span className="ml-2 font-semibold">{s.nombre}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{s.traduccion}</span>
                    </div>
                    {val != null && <span className="text-xs font-semibold tabular-nums" style={{ color: semaforo(val).bg }}>{val}%</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {NIVELES.map((n) => (
                      <button key={n.valor} type="button" disabled={bloqueada}
                        onClick={() => setNivel(s.key, n.valor)}
                        className={`p-2 rounded-lg text-xs font-medium transition border ${val === n.valor ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}>
                        <div className="font-bold tabular-nums">{n.short}</div>
                        <div className="text-[10px] mt-0.5 leading-tight">{n.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Observaciones</label>
            <Textarea value={detalle.observaciones ?? ""} disabled={bloqueada}
              onChange={(e) => onChange({ ...detalle, observaciones: e.target.value })}
              placeholder="Hallazgos, acciones correctivas, etc." rows={2} />
          </div>

          <Button variant="hero" disabled={bloqueada || saving} onClick={() => persistir(detalle)} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Guardar ítem
          </Button>
        </div>
      )}
    </Card>
  );
}
