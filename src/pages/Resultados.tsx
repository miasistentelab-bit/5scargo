import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, FileCheck2, TrendingUp } from "lucide-react";
import { meses, semaforo } from "@/lib/scoring";
import { ProgressBar } from "@/components/inspeccion/ProgressBar";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

export default function Resultados() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sectores, setSectores] = useState<any[]>([]);
  const [inspecciones, setInspecciones] = useState<any[]>([]);
  const now = new Date();
  const [desde, setDesde] = useState({ mes: 1, anio: now.getFullYear() });
  const [hasta, setHasta] = useState({ mes: now.getMonth() + 1, anio: now.getFullYear() });

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("sectores").select("*").order("orden").then(({ data }) => setSectores(data ?? []));
    supabase.from("inspecciones").select("*").eq("user_id", user.id).order("anio", { ascending: false }).order("mes", { ascending: false })
      .then(({ data }) => setInspecciones(data ?? []));
  }, [user]);

  const periodKey = (a: number, m: number) => a * 100 + m;
  const inRange = (i: any) => {
    const k = periodKey(i.anio, i.mes);
    return k >= periodKey(desde.anio, desde.mes) && k <= periodKey(hasta.anio, hasta.mes);
  };

  const filtradas = inspecciones.filter(inRange);

  const evolucion = useMemo(() => {
    const map = new Map<number, { periodo: string; total: number; count: number }>();
    filtradas.forEach((i) => {
      const k = periodKey(i.anio, i.mes);
      const ex = map.get(k) ?? { periodo: `${meses()[i.mes - 1].slice(0, 3)} ${String(i.anio).slice(2)}`, total: 0, count: 0 };
      ex.total += Number(i.puntaje_total) || 0;
      ex.count += 1;
      map.set(k, ex);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b).map(([, v]) => ({ periodo: v.periodo, promedio: v.count ? Math.round((v.total / v.count) * 10) / 10 : 0 }));
  }, [filtradas]);

  const porSector = useMemo(() => {
    return sectores.map((s) => {
      const inSec = filtradas.filter((i) => i.sector_id === s.id);
      const prom = inSec.length ? inSec.reduce((a, i) => a + (Number(i.puntaje_total) || 0), 0) / inSec.length : 0;
      return { nombre: s.nombre.split(" ")[0], promedio: Math.round(prom * 10) / 10 };
    });
  }, [filtradas, sectores]);

  const promedioGeneral = evolucion.length ? evolucion.reduce((a, e) => a + e.promedio, 0) / evolucion.length : 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-semibold">Auditoría · Comparativa</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Resultados
        </h1>
        <p className="text-muted-foreground mt-2">Evolución del cumplimiento 5S período tras período.</p>
      </header>

      <Card className="p-4 mb-6 bg-gradient-surface border-border/50 shadow-card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Desde mes</Label>
            <Select value={String(desde.mes)} onValueChange={(v) => setDesde({ ...desde, mes: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{meses().map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Desde año</Label>
            <Select value={String(desde.anio)} onValueChange={(v) => setDesde({ ...desde, anio: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Hasta mes</Label>
            <Select value={String(hasta.mes)} onValueChange={(v) => setHasta({ ...hasta, mes: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{meses().map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Hasta año</Label>
            <Select value={String(hasta.anio)} onValueChange={(v) => setHasta({ ...hasta, anio: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 bg-gradient-surface border-border/50 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Promedio general</p>
          <p className="text-4xl font-bold tabular-nums" style={{ color: semaforo(promedioGeneral).bg, fontFamily: "'Space Grotesk', sans-serif" }}>
            {promedioGeneral.toFixed(1)}%
          </p>
          <ProgressBar value={promedioGeneral} showLabel={false} />
        </Card>
        <Card className="p-5 bg-gradient-surface border-border/50 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Inspecciones en período</p>
          <p className="text-4xl font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{filtradas.length}</p>
        </Card>
        <Card className="p-5 bg-gradient-surface border-border/50 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Finalizadas (bloqueadas)</p>
          <p className="text-4xl font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {filtradas.filter((i) => i.estado === "finalizada").length}
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 bg-gradient-surface border-border/50 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Evolución mensual</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={evolucion}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="periodo" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="promedio" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill: "hsl(var(--primary))", r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-surface border-border/50 shadow-card">
          <h2 className="font-semibold mb-4">Promedio por sector</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={porSector}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="nombre" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="promedio" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="bg-gradient-surface border-border/50 shadow-card overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h2 className="font-semibold flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" />Detalle de inspecciones</h2>
        </div>
        <div className="divide-y divide-border/50">
          {filtradas.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">Sin inspecciones en este período.</p>}
          {filtradas.map((i) => {
            const sector = sectores.find((s) => s.id === i.sector_id);
            const p = Number(i.puntaje_total) || 0;
            return (
              <button key={i.id} onClick={() => navigate(`/inspeccion/${i.id}`)}
                className="w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition text-left">
                <div className="text-2xl">{sector?.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{sector?.nombre}</span>
                    {i.estado === "finalizada" && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground">{meses()[i.mes - 1]} {i.anio} · {i.responsable}</div>
                  <div className="mt-2"><ProgressBar value={p} showLabel={false} height="h-1.5" /></div>
                </div>
                <span className="text-xl font-bold tabular-nums shrink-0" style={{ color: semaforo(p).bg, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {p.toFixed(0)}%
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
