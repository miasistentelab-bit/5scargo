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
import { SubItemCard, type DetalleData } from "@/components/inspeccion/SubItemCard";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function Inspeccion() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [insp, setInsp] = useState<any>(null);
  const [sector, setSector] = useState<any>(null);
  const [subItems, setSubItems] = useState<any[]>([]);
  const [detalles, setDetalles] = useState<DetalleData[]>([]);
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: i } = await supabase.from("inspecciones").select("*").eq("id", id).maybeSingle();
      if (!i) { toast.error("Inspección no encontrada"); navigate("/"); return; }
      setInsp(i);
      const { data: s } = await supabase.from("sectores").select("*").eq("id", i.sector_id).maybeSingle();
      setSector(s);
      const { data: subs } = await supabase.from("sub_items").select("*").eq("sector_id", i.sector_id).order("orden");
      setSubItems(subs ?? []);
      const { data: ds } = await supabase.from("detalles_inspeccion").select("*").eq("inspeccion_id", id);
      const map = new Map((ds ?? []).map((d: any) => [d.sub_item_id, d]));
      const merged: DetalleData[] = (subs ?? []).map((sub: any) => {
        const ex = map.get(sub.id);
        return ex ? (ex as any) : {
          sub_item_id: sub.id, sub_item_nombre: sub.nombre,
          s1_puntaje: null, s2_puntaje: null, s3_puntaje: null, s4_puntaje: null, s5_puntaje: null,
          promedio: 0, foto_evidencia_url: null, observaciones: null, ia_sugerido_puntaje: null, ia_comentario: null,
        };
      });
      setDetalles(merged);
    })();
  }, [id, user, navigate]);

  const fotoMaestraBySubItem = useMemo(() => {
    const m = new Map<string, string | null>();
    subItems.forEach((s) => m.set(s.id, s.foto_maestra_url ?? null));
    return m;
  }, [subItems]);

  const total = calcPromedio(detalles);
  const completos = detalles.filter((d) =>
    d.s1_puntaje != null && d.s2_puntaje != null && d.s3_puntaje != null && d.s4_puntaje != null && d.s5_puntaje != null
  ).length;
  const bloqueada = insp?.estado === "finalizada";

  const updateDetalle = (next: DetalleData) => {
    setDetalles((prev) => prev.map((d) => d.sub_item_id === next.sub_item_id ? next : d));
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
              <Lock className="h-3 w-3" />Bloqueada
            </div>
          )}
        </div>
        <ProgressBar value={total} />
      </Card>

      <div className="space-y-3 mb-8">
        {detalles.map((d) => (
          <SubItemCard key={d.sub_item_id}
            detalle={d}
            fotoMaestraUrl={fotoMaestraBySubItem.get(d.sub_item_id) ?? null}
            inspeccionId={insp.id}
            userId={user!.id}
            bloqueada={bloqueada}
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
