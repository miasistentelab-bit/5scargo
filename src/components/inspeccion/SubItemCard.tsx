import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Camera, Sparkles, ChevronDown, ChevronUp, Check, Trash2, HelpCircle, ZoomIn, X } from "lucide-react";
import { CINCO_S, NIVELES, PREGUNTAS_GUIA, semaforo } from "@/lib/scoring";
import { ProgressBar } from "./ProgressBar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

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

export type MaestraFoto = {
  id: string;
  url: string;
  storage_path: string | null;
  source: "table" | "legacy";
};

export type EvidenciaFoto = {
  id: string;
  url: string;
  storage_path: string;
};

type Props = {
  detalle: DetalleData;
  fotosMaestras: MaestraFoto[];
  fotosEvidencia: EvidenciaFoto[];
  inspeccionId: string;
  userId: string;
  bloqueada: boolean;
  onChange: (d: DetalleData) => void;
  onMaestrasChange?: (subItemId: string, fotos: MaestraFoto[]) => void;
  onEvidenciasChange?: (subItemId: string, fotos: EvidenciaFoto[]) => void;
};

export function SubItemCard({ detalle, fotosMaestras, fotosEvidencia, inspeccionId, userId, bloqueada, onChange, onMaestrasChange, onEvidenciasChange }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingEvidenciaId, setDeletingEvidenciaId] = useState<string | null>(null);
  const [preguntasAbiertas, setPreguntasAbiertas] = useState<Record<string, boolean>>({});
  const [fotoAbierta, setFotoAbierta] = useState<{ url: string; alt: string } | null>(null);

  const promedio = (() => {
    const vals = CINCO_S.map((s) => detalle[s.key]).filter((v) => v != null) as number[];
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / 5;
  })();

  const todoCompleto = CINCO_S.every((s) => detalle[s.key] != null);

  const fotosEvidenciaIA = fotosEvidencia.filter((f) => !f.storage_path.includes("/obs-"));
  const fotosObservacion = fotosEvidencia.filter((f) => f.storage_path.includes("/obs-"));

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

  const subirFoto = async (file: File, prefijo: string = "") => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const prefixPart = prefijo ? `${prefijo}-` : "";
    const path = `${userId}/${inspeccionId}/${prefixPart}${detalle.sub_item_id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file, { upsert: true });
    if (error) { setUploading(false); toast.error(error.message); return null; }
    const { data: signed } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 60 * 24 * 365);
    setUploading(false);
    const url = signed?.signedUrl ?? null;
    if (!url) return null;
    return { url, storage_path: path };
  };

  const handleFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (fotosEvidenciaIA.length >= 4) return toast.error("Máximo 4 fotos antes de pedir sugerencia");
    const remaining = 4 - fotosEvidenciaIA.length;
    const slice = files.slice(0, remaining);
    let nextFotos = [...fotosEvidencia];
    for (const f of slice) {
      const up = await subirFoto(f);
      if (!up) continue;
      const { data: saved, error } = await supabase.from("evidencias_inspeccion")
        .insert({ inspeccion_id: inspeccionId, sub_item_id: detalle.sub_item_id, storage_path: up.storage_path, url: up.url })
        .select("id, url, storage_path")
        .single();
      if (error) {
        await supabase.storage.from("evidencias").remove([up.storage_path]);
        toast.error(error.message);
        continue;
      }
      const savedFoto: EvidenciaFoto = { id: saved!.id, url: saved!.url, storage_path: saved!.storage_path };
      nextFotos = [...nextFotos, savedFoto];
      onEvidenciasChange?.(detalle.sub_item_id, nextFotos);
    }
    const firstUrl = nextFotos.filter((f) => !f.storage_path.includes("/obs-"))[0]?.url ?? fotosObservacion[0]?.url ?? null;
    const nextDetalle: DetalleData = {
      ...detalle,
      foto_evidencia_url: firstUrl,
      ia_sugerido_puntaje: null,
      ia_comentario: null,
    };
    onChange(nextDetalle);
    await persistir(nextDetalle);
  };

  const handleFotosObservacion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (fotosObservacion.length >= 2) return toast.error("Máximo 2 fotos en observaciones");
    const remaining = 2 - fotosObservacion.length;
    const slice = files.slice(0, remaining);
    let nextFotos = [...fotosEvidencia];
    for (const f of slice) {
      const up = await subirFoto(f, "obs");
      if (!up) continue;
      const { data: saved, error } = await supabase.from("evidencias_inspeccion")
        .insert({ inspeccion_id: inspeccionId, sub_item_id: detalle.sub_item_id, storage_path: up.storage_path, url: up.url })
        .select("id, url, storage_path")
        .single();
      if (error) {
        await supabase.storage.from("evidencias").remove([up.storage_path]);
        toast.error(error.message);
        continue;
      }
      const savedFoto: EvidenciaFoto = { id: saved!.id, url: saved!.url, storage_path: saved!.storage_path };
      nextFotos = [...nextFotos, savedFoto];
      onEvidenciasChange?.(detalle.sub_item_id, nextFotos);
    }
  };

  const eliminarEvidencia = async (foto: EvidenciaFoto) => {
    setDeletingEvidenciaId(foto.id);
    const { error } = await supabase.from("evidencias_inspeccion").delete().eq("id", foto.id);
    if (error) { setDeletingEvidenciaId(null); return toast.error(error.message); }
    await supabase.storage.from("evidencias").remove([foto.storage_path]);
    const nextFotos = fotosEvidencia.filter((f) => f.id !== foto.id);
    onEvidenciasChange?.(detalle.sub_item_id, nextFotos);
    const nextIAs = nextFotos.filter((f) => !f.storage_path.includes("/obs-"));
    const firstUrl = nextIAs[0]?.url ?? nextFotos[0]?.url ?? null;
    const nextDetalle: DetalleData = {
      ...detalle,
      foto_evidencia_url: firstUrl,
      ia_sugerido_puntaje: null,
      ia_comentario: null,
    };
    onChange(nextDetalle);
    await persistir(nextDetalle);
    setDeletingEvidenciaId(null);
  };

  const analizarConIA = async () => {
    if (!fotosEvidenciaIA.length) return toast.error("Subí hasta 4 fotos de evidencia antes de pedir sugerencia");
    const maestras = fotosMaestras.map((m) => m.url).filter(Boolean).slice(0, 4);
    if (!maestras.length) return toast.error("No hay fotos originales en Config para comparar");
    setAnalizando(true);
    const evidencias = fotosEvidenciaIA.map((f) => f.url).filter(Boolean).slice(0, 4);

    const toFeatures = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`No se pudo descargar imagen (${r.status})`);
      const blob = await r.blob();
      const bmp = await createImageBitmap(blob);
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas no disponible");
      ctx.drawImage(bmp, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const gray = new Float32Array(size * size);
      for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
        gray[p] = (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      let mean = 0;
      for (let i = 0; i < gray.length; i++) mean += gray[i];
      mean /= gray.length;
      let variance = 0;
      for (let i = 0; i < gray.length; i++) {
        const d = gray[i] - mean;
        variance += d * d;
      }
      variance /= gray.length;
      let edgeCount = 0;
      let gradSum = 0;
      const bins = new Float32Array(4);
      const w = size;
      const h = size;
      const edgeThresh = 18;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const dx = gray[idx + 1] - gray[idx - 1];
          const dy = gray[idx + w] - gray[idx - w];
          const mag = Math.hypot(dx, dy);
          gradSum += mag;
          if (mag >= edgeThresh) edgeCount += 1;
          const ax = Math.abs(dx);
          const ay = Math.abs(dy);
          let bin = 3;
          if (ay < ax * 0.5) bin = 0;
          else if (ax < ay * 0.5) bin = 2;
          else bin = 1;
          bins[bin] += mag;
        }
      }
      let binSum = 0;
      for (let i = 0; i < bins.length; i++) binSum += bins[i];
      if (binSum > 0) for (let i = 0; i < bins.length; i++) bins[i] /= binSum;
      const edgeDensity = edgeCount / (w * h);
      const noise = gradSum / (w * h);
      return { gray, mean, variance, edgeDensity, bins, noise };
    };

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const cosine = (a: Float32Array, b: Float32Array) => {
      const n = Math.min(a.length, b.length);
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (let i = 0; i < n; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
      }
      if (!na || !nb) return 0;
      return dot / Math.sqrt(na * nb);
    };

    const ssimApprox = (a: { gray: Float32Array; mean: number; variance: number }, b: { gray: Float32Array; mean: number; variance: number }) => {
      const n = Math.min(a.gray.length, b.gray.length);
      const muX = a.mean;
      const muY = b.mean;
      const varX = a.variance;
      const varY = b.variance;
      let cov = 0;
      for (let i = 0; i < n; i++) cov += (a.gray[i] - muX) * (b.gray[i] - muY);
      cov /= n;
      const c1 = (0.01 * 255) * (0.01 * 255);
      const c2 = (0.03 * 255) * (0.03 * 255);
      const num = (2 * muX * muY + c1) * (2 * cov + c2);
      const den = (muX * muX + muY * muY + c1) * (varX + varY + c2);
      if (!den) return 0;
      return clamp01(num / den);
    };

    const levelFromScore = (score: number) => {
      if (score < 13) return 0;
      if (score < 38) return 25;
      if (score < 63) return 50;
      if (score < 88) return 75;
      return 100;
    };

    try {
      const maestrasFeat = await Promise.all(maestras.map(toFeatures));
      const dims = { seiri: 0, seiton: 0, seiso: 0, seiketsu: 0, count: 0, overall: 0 };
      for (const u of evidencias) {
        const ev = await toFeatures(u);
        let best = { sim: 0, ssim: 0, edgeSim: 0, orientSim: 0, brightSim: 0, noiseSim: 0 };
        for (const m of maestrasFeat) {
          const ssim = ssimApprox(ev, m);
          const orientSim = clamp01(cosine(ev.bins, m.bins));
          const edgeSim = clamp01(1 - Math.abs(ev.edgeDensity - m.edgeDensity) / Math.max(0.12, m.edgeDensity));
          const brightSim = clamp01(1 - Math.abs(ev.mean - m.mean) / 128);
          const noiseSim = clamp01(1 - Math.max(0, ev.noise - m.noise) / 30);
          const sim = clamp01(0.55 * ssim + 0.15 * edgeSim + 0.15 * orientSim + 0.10 * brightSim + 0.05 * noiseSim);
          if (sim > best.sim) best = { sim, ssim, edgeSim, orientSim, brightSim, noiseSim };
        }
        dims.overall += best.sim;
        dims.seiketsu += best.ssim;
        dims.seiton += best.orientSim;
        dims.seiri += best.edgeSim;
        dims.seiso += best.noiseSim;
        dims.count += 1;
      }

      const count = Math.max(1, dims.count);
      const overallScore = Math.round((dims.overall / count) * 100);
      const s1 = Math.round((dims.seiri / count) * 100);
      const s2 = Math.round((dims.seiton / count) * 100);
      const s3 = Math.round((dims.seiso / count) * 100);
      const s4 = Math.round((dims.seiketsu / count) * 100);
      const s5 = Math.round((s1 + s2 + s3 + s4) / 4);

      const nivel1 = levelFromScore(s1);
      const nivel2 = levelFromScore(s2);
      const nivel3 = levelFromScore(s3);
      const nivel4 = levelFromScore(s4);
      const nivel5 = levelFromScore(s5);

      setAnalizando(false);

      const next: DetalleData = {
        ...detalle,
        s1_puntaje: nivel1,
        s2_puntaje: nivel2,
        s3_puntaje: nivel3,
        s4_puntaje: nivel4,
        s5_puntaje: nivel5,
        ia_sugerido_puntaje: overallScore,
        ia_comentario: `Auto vs ${maestras.length} original(es): ${overallScore}%. Seiri ${s1}%, Seiton ${s2}%, Seiso ${s3}%, Seiketsu ${s4}%`,
      };
      onChange(next);
      toast.success("Sugerencia automática lista — revisala y guardá");
    } catch (e) {
      setAnalizando(false);
      toast.error(e instanceof Error ? e.message : "Error comparando fotos");
    }
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
              <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                disabled={bloqueada || uploading || fotosEvidenciaIA.length >= 4} onChange={handleFotos} />
              <span className={`flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed border-border bg-muted/30 text-sm cursor-pointer hover:bg-muted/50 transition ${bloqueada ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {fotosEvidenciaIA.length ? `Agregar foto (${fotosEvidenciaIA.length}/4)` : "Tomar / subir fotos (hasta 4)"}
              </span>
            </label>
            <Button variant="hero" disabled={bloqueada || analizando || !fotosEvidenciaIA.length} onClick={analizarConIA} className="h-11">
              {analizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Sugerir automático
            </Button>
          </div>

          {!!fotosEvidenciaIA.length && (
            <div className="grid grid-cols-2 gap-2">
              {fotosEvidenciaIA.map((f) => (
                <div key={f.id} className="relative overflow-hidden rounded-lg border border-border/50 bg-muted/10 group">
                  <img
                    src={f.url}
                    alt="evidencia"
                    className="w-full h-28 object-cover cursor-zoom-in transition group-hover:scale-[1.02]"
                    onClick={() => setFotoAbierta({ url: f.url, alt: "Evidencia" })}
                  />
                  <button
                    type="button"
                    onClick={() => setFotoAbierta({ url: f.url, alt: "Evidencia" })}
                    className="absolute top-2 left-2 h-8 w-8 rounded-md bg-background/80 hover:bg-background border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    aria-label="Ver foto completa"
                  >
                    <ZoomIn className="h-4 w-4 text-primary" />
                  </button>
                  {!bloqueada && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); eliminarEvidencia(f); }}
                      disabled={deletingEvidenciaId === f.id}
                      className="absolute top-2 right-2 h-8 w-8 rounded-md bg-background/80 hover:bg-background border border-border/50 flex items-center justify-center"
                      aria-label="Eliminar foto de evidencia"
                    >
                      {deletingEvidenciaId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
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
              const preguntas = PREGUNTAS_GUIA[s.key] || [];
              const tienePreguntas = preguntas.length > 0;
              const abierto = preguntasAbiertas[s.key] ?? false;
              return (
                <div key={s.key} className="rounded-lg border border-border/40 bg-muted/15 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <span className="text-xs font-bold text-primary">{s.codigo}</span>
                        <span className="ml-2 font-semibold">{s.nombre}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{s.traduccion}</span>
                      </div>
                      {tienePreguntas && (
                        <button
                          type="button"
                          onClick={() => setPreguntasAbiertas((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                          className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition"
                          title="Ver preguntas guía"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {val != null && <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: semaforo(val).bg }}>{val}%</span>}
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {NIVELES.map((n) => (
                      <button key={n.valor} type="button" disabled={bloqueada}
                        onClick={() => setNivel(s.key, n.valor)}
                        className={`p-2 rounded-lg text-xs font-medium transition border ${val === n.valor ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}>
                        <div className="font-bold tabular-nums">{n.short}</div>
                        <div className="text-[10px] mt-0.5 leading-tight">{n.label}</div>
                      </button>
                    ))}
                  </div>
                  {tienePreguntas && abierto && (
                    <div className="mt-2 pt-3 border-t border-border/40 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-1">Preguntas guía</p>
                      <ul className="space-y-1.5">
                        {preguntas.map((p, idx) => (
                          <li key={idx} className="flex gap-2 text-xs text-foreground/85 leading-relaxed">
                            <span className="shrink-0 h-4 w-4 inline-flex items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold mt-0.5">{idx + 1}</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-border/40 bg-muted/15 p-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Observaciones</label>
              <Textarea value={detalle.observaciones ?? ""} disabled={bloqueada}
                onChange={(e) => onChange({ ...detalle, observaciones: e.target.value })}
                placeholder="Hallazgos, acciones correctivas, comentarios, etc." rows={3} />
            </div>
            <div>
              <label className="flex-1 block">
                <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                  disabled={bloqueada || uploading || fotosObservacion.length >= 2} onChange={handleFotosObservacion} />
                <span className={`flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-border bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition ${bloqueada ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {fotosObservacion.length ? `Agregar foto a observaciones (${fotosObservacion.length}/2)` : "📸 Agregar 1 o 2 fotos a observaciones"}
                </span>
              </label>
            </div>
            {!!fotosObservacion.length && (
              <div className="grid grid-cols-2 gap-2">
                {fotosObservacion.map((f) => (
                  <div key={f.id} className="relative overflow-hidden rounded-lg border border-border/50 bg-muted/10 group">
                    <img
                      src={f.url}
                      alt="observación"
                      className="w-full h-28 object-cover cursor-zoom-in transition group-hover:scale-[1.02]"
                      onClick={() => setFotoAbierta({ url: f.url, alt: "Observación" })}
                    />
                    <button
                      type="button"
                      onClick={() => setFotoAbierta({ url: f.url, alt: "Observación" })}
                      className="absolute top-2 left-2 h-8 w-8 rounded-md bg-background/80 hover:bg-background border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      aria-label="Ver foto completa"
                    >
                      <ZoomIn className="h-4 w-4 text-primary" />
                    </button>
                    {!bloqueada && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); eliminarEvidencia(f); }}
                        disabled={deletingEvidenciaId === f.id}
                        className="absolute top-2 right-2 h-8 w-8 rounded-md bg-background/80 hover:bg-background border border-border/50 flex items-center justify-center"
                        aria-label="Eliminar foto de observación"
                      >
                        {deletingEvidenciaId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button variant="hero" disabled={bloqueada || saving} onClick={() => persistir(detalle)} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Guardar ítem
          </Button>
        </div>
      )}
      <Dialog open={fotoAbierta !== null} onOpenChange={(open) => !open && setFotoAbierta(null)}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none bg-transparent shadow-none">
          <DialogHeader>
            <DialogTitle>
              <VisuallyHidden>{fotoAbierta?.alt ?? "Foto"}</VisuallyHidden>
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFotoAbierta(null)}
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-background/90 hover:bg-background border border-border/50 flex items-center justify-center z-10 shadow-lg"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
            {fotoAbierta && (
              <img
                src={fotoAbierta.url}
                alt={fotoAbierta.alt}
                className="w-full h-auto max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
