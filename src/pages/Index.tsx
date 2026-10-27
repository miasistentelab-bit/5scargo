import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, ChevronRight, Calendar, User as UserIcon, Lock } from "lucide-react";
import { meses } from "@/lib/scoring";
import { ProgressBar } from "@/components/inspeccion/ProgressBar";
import { toast } from "sonner";

type Sector = { id: string; nombre: string; emoji: string | null; orden: number };
type Insp = { id: string; sector_id: string; mes: number; anio: number; estado: string; puntaje_total: number | null };

export default function Index() {
  const { user, loading, nombre, setNombre } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [inspecciones, setInspecciones] = useState<Insp[]>([]);
  const [responsable, setResponsable] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { setResponsable(nombre || "Oficinas y SSGG"); }, [nombre]);

  useEffect(() => {
    if (!user) return;
    supabase.from("sectores").select("*").order("orden").then(({ data }) => setSectores(data ?? []));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("inspecciones").select("id,sector_id,mes,anio,estado,puntaje_total")
      .eq("mes", mes).eq("anio", anio)
      .then(({ data }) => setInspecciones(data ?? []));
  }, [user, mes, anio]);

  const inspBySector = useMemo(() => {
    const m = new Map<string, Insp>();
    inspecciones.forEach((i) => m.set(i.sector_id, i));
    return m;
  }, [inspecciones]);

  const iniciar = async (sector: Sector) => {
    if (!user) return;
    const maxKey = now.getFullYear() * 100 + (now.getMonth() + 1);
    const selKey = anio * 100 + mes;
    if (selKey > maxKey) return toast.error("No se puede iniciar una inspección en un mes futuro");
    const nombreFinal = responsable.trim() || "Oficinas y SSGG";
    setBusy(sector.id);
    // Re-confirm the active session right before insert to avoid RLS race conditions
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setBusy(null);
      toast.error("Sesión expirada. Volvé a iniciar sesión.");
      navigate("/auth");
      return;
    }
    if (nombreFinal !== nombre) {
      await supabase.from("profiles").update({ nombre: nombreFinal }).eq("id", authUser.id);
      setNombre(nombreFinal);
    }
    const existente = inspBySector.get(sector.id);
    if (existente) {
      setBusy(null);
      navigate(`/inspeccion/${existente.id}`);
      return;
    }
    const { data, error } = await supabase.from("inspecciones").insert({
      user_id: authUser.id, responsable: nombreFinal, sector_id: sector.id, mes, anio,
    }).select("id").single();
    setBusy(null);
    if (error) return toast.error(error.message);
    navigate(`/inspeccion/${data.id}`);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  if (!user) {
    return (
      <AppShell>
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-semibold">Auditoría 5S</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Resultados y auditorías
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Podés ver los resultados sin iniciar sesión. Para realizar inspecciones, iniciá sesión.
          </p>
        </header>
        <div className="grid sm:grid-cols-2 gap-3">
          <Button variant="hero" size="xl" onClick={() => navigate("/resultados")} className="w-full">
            Ver resultados
          </Button>
          <Button variant="outline" size="xl" onClick={() => navigate("/auth")} className="w-full">
            Iniciar sesión
          </Button>
        </div>
      </AppShell>
    );
  }

  const sectorColor = (nombre: string) => {
    if (nombre.includes("OFICINA")) return "var(--sector-oficinas)";
    if (nombre.includes("DEPOSITO")) return "var(--sector-deposito)";
    return "var(--sector-predio)";
  };

  return (
    <AppShell>
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-semibold">Auditoría 5S · {meses()[mes - 1]} {anio}</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance" style={{ fontFamily: "'Space Grotesk', sans-serif" }}">
          Auditoría Mensual
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Seleccioná el sector que vas a auditar. Cada inspección se bloquea al finalizar para garantizar la integridad ante auditores.
        </p>
      </header>

      <Card className="p-5 mb-8 bg-gradient-surface border-border/50 shadow-card">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs flex items-center gap-1.5 mb-1.5"><UserIcon className="h-3 w-3" />Auditor</Label>
            <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Oficinas y SSGG" />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1.5 mb-1.5"><Calendar className="h-3 w-3" />Mes</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {meses()
                  .slice(0, anio === now.getFullYear() ? now.getMonth() + 1 : 12)
                  .map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1.5 mb-1.5"><Calendar className="h-3 w-3" />Año</Label>
            <Select value={String(anio)} onValueChange={(v) => {
              const nextYear = Number(v);
              if (nextYear > now.getFullYear()) return toast.error("No se puede seleccionar un año futuro");
              setAnio(nextYear);
              if (nextYear === now.getFullYear() && mes > now.getMonth() + 1) setMes(now.getMonth() + 1);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear()].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        {sectores.map((s) => {
          const insp = inspBySector.get(s.id);
          const finalizada = insp?.estado === "finalizada";
          const color = sectorColor(s.nombre);
          return (
            <Card key={s.id}
              className="group relative overflow-hidden p-6 bg-gradient-surface border-border/50 shadow-card hover:shadow-elevated transition-all cursor-pointer active:scale-[0.99]"
              onClick={() => iniciar(s)}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity"
                style={{ background: `hsl(${color})` }} />
              <div className="relative">
                <div className="text-4xl mb-4">{s.emoji}</div>
                <h3 className="text-xl font-bold tracking-tight mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {s.nombre}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {finalizada ? "Auditoría finalizada" : insp ? "En curso · borrador" : "Sin iniciar"}
                </p>
                {insp && (
                  <div className="mb-4">
                    <ProgressBar value={Number(insp.puntaje_total) || 0} />
                  </div>
                )}
                <Button variant={finalizada ? "secondary" : "hero"} size="sm" className="w-full" disabled={busy === s.id}>
                  {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    finalizada ? <><Lock className="h-4 w-4" />Ver (bloqueada)</> :
                    insp ? <>Continuar <ChevronRight className="h-4 w-4" /></> :
                    <>Iniciar inspección <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
