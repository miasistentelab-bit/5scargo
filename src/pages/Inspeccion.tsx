import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Lock, ShieldCheck, AlertTriangle } from "lucide-react";
import { meses, promedio as calcPromedio } from "@/lib/scoring";
import { ProgressBar } from "@/components/inspeccion/ProgressBar";
import { SubItemCard, type DetalleData, type MaestraFoto, type EvidenciaFoto } from "@/components/inspeccion/SubItemCard";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type InspeccionEstado = "borrador" | "finalizada";
type InspeccionRow = {
  id: string;
  user_id: string;
  responsable: string;
  sector_id: string;
  mes: number;
  anio: number;
  estado: InspeccionEstado;
  puntaje_total: number | null;
  finalizada_at: string | null;
  created_at: string;
  updated_at: string;
};

type Sector = { id: string; nombre: string; emoji: string; orden: number };
type SubItem = { id: string; sector_id: string; nombre: string; foto_maestra_url: string | null; orden: number; created_at: string };
type MaestraRow = { id: string; sub_item_id: string; url: string; storage_path: string | null; created_at: string };
type EvidenciaRow = { id: string; sub_item_id: string; url: string; storage_path: string; created_at: string };

export default function Inspeccion() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [insp, setInsp] = useState<InspeccionRow | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [subItems, setSubItems] = useState<SubItem[]>([]);
  const [detalles, setDetalles] = useState<DetalleData[]>([]);
  const [maestrasBySub, setMaestrasBySub] = useState<Record<string, MaestraFoto[]>>({});
  const [evidenciasBySub, setEvidenciasBySub] = useState<Record<string, EvidenciaFoto[]>>({});
  const [finalizando, setFinalizando] = useState(false);

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

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: i } = await supabase.from("inspecciones").select("*").eq("id", id).maybeSingle();
      if (!i) { toast.error("Inspección no encontrada"); navigate("/"); return; }
      const inspRow = i as unknown as InspeccionRow;
      setInsp(inspRow);
      const { data: s } = await supabase.from("sectores").select("*").eq("id", inspRow.sector_id).maybeSingle();
      setSector((s ?? null) as unknown as Sector | null);
      const { data: subs } = await supabase.from("sub_items").select("*").eq("sector_id", inspRow.sector_id).order("orden");
      const subsTyped = (subs ?? []) as unknown as SubItem[];
      setSubItems(subsTyped);
      const subIds = subsTyped.map((x) => x.id);
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

      const { data: evs } = await supabase
        .from("evidencias_inspeccion")
        .select("id, sub_item_id, url, storage_path, created_at")
        .eq("inspeccion_id", id)
        .order("created_at", { ascending: true });
      const evBy: Record<string, EvidenciaFoto[]> = {};
      ((evs ?? []) as unknown as EvidenciaRow[]).forEach((e) => {
        (evBy[e.sub_item_id] = evBy[e.sub_item_id] ?? []).push({
          id: e.id,
          url: e.url,
          storage_path: e.storage_path,
        });
      });
      setEvidenciasBySub(evBy);

      const { data: ds } = await supabase.from("detalles_inspeccion").select("*").eq("inspeccion_id", id);
      const map = new Map<string, DetalleData>(((ds ?? []) as unknown as DetalleData[]).map((d) => [d.sub_item_id, d]));
      const merged: DetalleData[] = subsTyped.map((sub) => {
        const ex = map.get(sub.id);
        return ex ? ex : {
          sub_item_id: sub.id, sub_item_nombre: sub.nombre,
          s1_puntaje: null, s2_puntaje: null, s3_puntaje: null, s4_puntaje: null, s5_puntaje: null,
          promedio: 0, foto_evidencia_url: null, observaciones: null, ia_sugerido_puntaje: null, ia_comentario: null,
        };
      });
      setDetalles(merged);
    })();
  }, [id, user, navigate]);

  const maestrasFor = useMemo(() => {
    return (subItemId: string) => maestrasBySub[subItemId] ?? [];
  }, [maestrasBySub]);

  const evidenciasFor = useMemo(() => {
    return (subItemId: string) => evidenciasBySub[subItemId] ?? [];
  }, [evidenciasBySub]);

  const total = calcPromedio(detalles);
  const completos = detalles.filter((d) =>
    d.s1_puntaje != null && d.s2_puntaje != null && d.s3_puntaje != null && d.s4_puntaje != null && d.s5_puntaje != null
  ).length;
  const esPropia = insp?.user_id === user?.id;
  const bloqueada = insp?.estado === "finalizada";

  const updateDetalle = (next: DetalleData) => {
    setDetalles((prev) => prev.map((d) => d.sub_item_id === next.sub_item_id ? next : d));
  };

  const updateMaestras = (subItemId: string, fotos: MaestraFoto[]) => {
    setMaestrasBySub((prev) => ({ ...prev, [subItemId]: fotos }));
  };

  const updateEvidencias = (subItemId: string, fotos: EvidenciaFoto[]) => {
    setEvidenciasBySub((prev) => ({ ...prev, [subItemId]: fotos }));
  };

  const finalizar = async () => {
    if (!insp) return;
    setFinalizando(true);
    const { error } = await supabase.from("inspecciones").update({
      puntaje_total: total, estado: "finalizada", finalizada_at: new Date().toISOString(),
    }).eq("id", insp.id);
    setFinalizando(false);
    if (error) return toast.error(error.message);
    toast.success("Inspección finalizada y bloqueada para auditoría");
    navigate("/resultados");
  };

  if (loading || !insp) return (
    <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  );

  return (
    <AppShell>
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" />Volver
      </Link>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 font-semibold">
          {meses()[insp.mes - 1]} {insp.anio} · {insp.responsable}
        </p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {sector?.emoji} {sector?.nombre}
        </h1>
      </header>

      <Card className="p-5 mb-6 bg-gradient-surface border-border/50 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Puntaje general · {completos}/{detalles.length} ítems completos</p>
            <p className="text-3xl font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{total.toFixed(1)}%</p>
          </div>
          {bloqueada && (
            <div className="flex items-center gap-1.5 text-xs bg-muted px-3 py-1.5 rounded-full">
              <Lock className="h-3 w-3" />
              {insp?.estado === "finalizada" ? "Bloqueada" : `Iniciada por ${insp?.responsable}`}
            </div>
          )}
        </div>
        <ProgressBar value={total} />
      </Card>

      <div className="space-y-3 mb-8">
        {detalles.map((d) => (
          <SubItemCard key={d.sub_item_id}
            detalle={d}
            fotosMaestras={maestrasFor(d.sub_item_id)}
            fotosEvidencia={evidenciasFor(d.sub_item_id)}
            inspeccionId={insp.id}
            userId={user!.id}
            bloqueada={bloqueada}
            onMaestrasChange={updateMaestras}
            onEvidenciasChange={updateEvidencias}
            onChange={updateDetalle} />
        ))}
        {!detalles.length && (
          <Card className="p-8 text-center text-muted-foreground bg-muted/20">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-warning" />
            Este sector no tiene sub-ítems. Agregalos desde <Link to="/config" className="text-primary underline">Configuración</Link>.
          </Card>
        )}
      </div>

      {!bloqueada && detalles.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="hero" size="xl" className="w-full" disabled={completos !== detalles.length}>
              <ShieldCheck className="h-5 w-5" />
              {completos === detalles.length ? "Finalizar y bloquear" : `Completá ${detalles.length - completos} ítem(s) restantes`}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Finalizar inspección?</AlertDialogTitle>
              <AlertDialogDescription>
                Una vez finalizada, esta inspección queda bloqueada para edición y no podrás modificarla. Esto garantiza la integridad ante auditores.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={finalizar} disabled={finalizando}>
                {finalizando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Sí, finalizar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AppShell>
  );
}
