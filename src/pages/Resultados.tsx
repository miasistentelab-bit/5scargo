import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, FileCheck2, TrendingUp, Download, MapIcon, ChevronUp, ChevronDown, BarChart3 } from "lucide-react";
import { CINCO_S, meses, semaforo } from "@/lib/scoring";
import { ProgressBar } from "@/components/inspeccion/ProgressBar";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Sector = { id: string; nombre: string; emoji: string | null; orden: number };
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

type DetalleRow = {
  inspeccion_id: string;
  sub_item_nombre: string;
  promedio: number | null;
  s1_puntaje: number | null;
  s2_puntaje: number | null;
  s3_puntaje: number | null;
  s4_puntaje: number | null;
  s5_puntaje: number | null;
};

type InspeccionPublicaRow = {
  inspeccion_id: string;
  sector_id: string;
  sector_nombre: string;
  sector_emoji: string | null;
  responsable: string;
  mes: number;
  anio: number;
  puntaje_total: number | null;
  finalizada_at: string | null;
  created_at: string;
};

export default function Resultados() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sectores, setSectores] = useState<Sector[]>([]);
  const [inspecciones, setInspecciones] = useState<InspeccionRow[]>([]);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [layoutUrl, setLayoutUrl] = useState<string | null>(null);
  const [detallesCargados, setDetallesCargados] = useState<DetalleRow[]>([]);
  const [cargandoDetalles, setCargandoDetalles] = useState(false);
  const [sectorAbierto, setSectorAbierto] = useState<Record<string, boolean>>({});
  const now = new Date();
  const [desde, setDesde] = useState({ mes: 1, anio: now.getFullYear() });
  const [hasta, setHasta] = useState({ mes: now.getMonth() + 1, anio: now.getFullYear() });

  useEffect(() => {
    supabase.from("configuracion").select("valor").eq("clave", "master_plan_url").maybeSingle()
      .then(({ data }) => setLayoutUrl(data?.valor ?? null));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user) {
      supabase.from("sectores").select("*").order("orden").then(({ data }) => setSectores((data ?? []) as Sector[]));
      supabase.from("inspecciones").select("*").order("anio", { ascending: false }).order("mes", { ascending: false })
        .then(({ data }) => setInspecciones((data ?? []) as InspeccionRow[]));
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("inspecciones_publicas")
        .select("inspeccion_id,sector_id,sector_nombre,sector_emoji,responsable,mes,anio,puntaje_total,finalizada_at,created_at")
        .order("anio", { ascending: false })
        .order("mes", { ascending: false });
      if (error) {
        setSectores([]);
        setInspecciones([]);
        return;
      }
      const insp = ((data ?? []) as unknown as InspeccionPublicaRow[]).map((r) => {
        const created = r.created_at || new Date().toISOString();
        return {
          id: r.inspeccion_id,
          user_id: "",
          responsable: r.responsable,
          sector_id: r.sector_id,
          mes: Number(r.mes),
          anio: Number(r.anio),
          estado: "finalizada" as const,
          puntaje_total: r.puntaje_total != null ? Number(r.puntaje_total) : 0,
          finalizada_at: r.finalizada_at ?? null,
          created_at: created,
          updated_at: created,
        } satisfies InspeccionRow;
      });
      const secMap = new Map<string, Sector>();
      ((data ?? []) as unknown as InspeccionPublicaRow[]).forEach((r) => {
        if (secMap.has(r.sector_id)) return;
        secMap.set(r.sector_id, { id: r.sector_id, nombre: r.sector_nombre ?? "", emoji: r.sector_emoji ?? null, orden: 0 });
      });
      setSectores(Array.from(secMap.values()));
      setInspecciones(insp);
    })();
  }, [user, loading]);

  const periodKey = (a: number, m: number) => a * 100 + m;
  const inRange = (i: InspeccionRow) => {
    const k = periodKey(i.anio, i.mes);
    return k >= periodKey(desde.anio, desde.mes) && k <= periodKey(hasta.anio, hasta.mes);
  };

  const filtradas = inspecciones.filter(inRange);
  const sectorById = useMemo(() => new Map(sectores.map((s) => [s.id, s])), [sectores]);

  useEffect(() => {
    let active = true;
    if (!filtradas.length) {
      setDetallesCargados([]);
      return;
    }
    setCargandoDetalles(true);
    (async () => {
      try {
        const rows = await fetchDetalles(filtradas.map((i) => i.id));
        if (active) setDetallesCargados(rows);
      } finally {
        if (active) setCargandoDetalles(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas.map((i) => i.id).join(","), user]);

  const monthLabel = (mes: number, anio: number) => `${meses()[mes - 1]} ${anio}`;
  const monthKey = (mes: number, anio: number) => `${anio}-${String(mes).padStart(2, "0")}`;
  const safeSheetName = (name: string) => name.replace(new RegExp("[\\[\\]\\*\\/\\\\\\?\\:]", "g"), " ").slice(0, 31);
  const CRITERIO_DEFAULT = "No dejar cambiar elementos";
  const check = "✓";
  type ScoreKey = (typeof CINCO_S)[number]["key"];
  const scoreOf = (d: DetalleRow, key: ScoreKey) => d[key];

  const fetchDetalles = async (inspectionIds: string[]) => {
    if (!inspectionIds.length) return [];
    const chunkSize = 200;
    const rows: DetalleRow[] = [];
    for (let i = 0; i < inspectionIds.length; i += chunkSize) {
      const chunk = inspectionIds.slice(i, i + chunkSize);
      const fromTable = (user ? "detalles_inspeccion" : "detalles_publicos") as any;
      console.log(`Fetching detalles from ${fromTable} for inspections:`, chunk);
      const { data, error } = await supabase
        .from(fromTable)
        .select("inspeccion_id,sub_item_nombre,promedio,s1_puntaje,s2_puntaje,s3_puntaje,s4_puntaje,s5_puntaje")
        .in("inspeccion_id", chunk)
        .order("sub_item_nombre");
      if (error) {
        console.error("Error fetching detalles:", error);
        throw error;
      }
      if (!data || data.length === 0) {
        console.warn(`No detalles found for inspection IDs: ${chunk.join(", ")}`);
      } else {
        console.log(`Fetched ${data.length} detalle rows for chunk`);
      }
      rows.push(...((data ?? []) as unknown as DetalleRow[]));
    }
    console.log(`Total fetched: ${rows.length} detalle rows for ${inspectionIds.length} inspections`);
    return rows;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async () => {
    if (!filtradas.length) return;
    setExporting("excel");
    try {
      const ids = filtradas.map((i) => i.id);
      const detalles = await fetchDetalles(ids);
      const detailsByInsp = new Map<string, DetalleRow[]>();
      for (const d of detalles) detailsByInsp.set(d.inspeccion_id, [...(detailsByInsp.get(d.inspeccion_id) ?? []), d]);
      const grouped = new Map<string, InspeccionRow[]>();
      for (const i of filtradas) {
        const k = monthKey(i.mes, i.anio);
        grouped.set(k, [...(grouped.get(k) ?? []), i]);
      }
      const monthsSorted = Array.from(grouped.keys()).sort();
      const { utils, write } = await import("xlsx");
      const wb = utils.book_new();
      for (const k of monthsSorted) {
        const list = grouped.get(k) ?? [];
        const [anioStr, mesStr] = k.split("-");
        const anio = Number(anioStr);
        const mes = Number(mesStr);
        const rows: Record<string, string | number>[] = [];
        for (const insp of list) {
          const dets = detailsByInsp.get(insp.id) ?? [];
          for (const d of dets) {
            for (const s of CINCO_S) {
              const val = scoreOf(d, s.key as ScoreKey);
              const v = val ?? "";
              rows.push({
                Categoria: `${s.nombre}-${s.traduccion}`,
                "Zona 5S": d.sub_item_nombre,
                Criterio: CRITERIO_DEFAULT,
                "Desconoce": v === 0 ? check : "",
                "Cumple Parcialmente": v === 25 ? check : "",
                "Cumple": v === 50 ? check : "",
                "Cumple con mejoras": v === 75 ? check : "",
                "Cumple todas las S": v === 100 ? check : "",
                Evaluacion: typeof v === "number" ? `${v}%` : "",
              });
            }
          }
        }
        const ws = utils.json_to_sheet(rows);
        ws["!cols"] = [
          { wch: 22 },
          { wch: 30 },
          { wch: 34 },
          { wch: 16 },
          { wch: 18 },
          { wch: 12 },
          { wch: 18 },
          { wch: 18 },
          { wch: 12 },
        ];
        utils.book_append_sheet(wb, ws, safeSheetName(`${k} ${meses()[mes - 1].slice(0, 3)}`));
      }
      const out = write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "reporte-inspecciones.xlsx");
    } catch (e: unknown) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Error exportando Excel");
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!filtradas.length) return;
    setExporting("pdf");
    try {
      const ids = filtradas.map((i) => i.id);
      const detalles = await fetchDetalles(ids);
      const detailsByInsp = new Map<string, DetalleRow[]>();
      for (const d of detalles) detailsByInsp.set(d.inspeccion_id, [...(detailsByInsp.get(d.inspeccion_id) ?? []), d]);

      const grouped = new Map<string, InspeccionRow[]>();
      for (const i of filtradas) {
        const k = monthKey(i.mes, i.anio);
        grouped.set(k, [...(grouped.get(k) ?? []), i]);
      }
      const monthsSorted = Array.from(grouped.keys()).sort();

      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" }) as any;
      const title = "Reporte de auditorías 5S";
      const range = `${monthLabel(desde.mes, desde.anio)} → ${monthLabel(hasta.mes, hasta.anio)}`;

      const drawLineChart = (x: number, y: number, w: number, h: number) => {
        doc.setDrawColor(180);
        doc.rect(x, y, w, h);
        const padL = 34;
        const padB = 22;
        const padT = 12;
        const padR = 10;
        const ix = x + padL;
        const iy = y + padT;
        const iw = w - padL - padR;
        const ih = h - padT - padB;
        doc.setDrawColor(140);
        doc.line(ix, iy + ih, ix + iw, iy + ih);
        doc.line(ix, iy, ix, iy + ih);
        if (!evolucion.length) return;
        const pts = evolucion.map((p, idx) => {
          const xx = ix + (evolucion.length === 1 ? 0 : (idx / (evolucion.length - 1)) * iw);
          const yy = iy + ih - (Math.max(0, Math.min(100, p.promedio)) / 100) * ih;
          return { x: xx, y: yy };
        });
        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(2);
        for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
        doc.setLineWidth(1);
        doc.setTextColor(100);
        doc.setFontSize(9);
        doc.text("0", ix - 18, iy + ih + 4);
        doc.text("100", ix - 26, iy + 8);
        doc.setTextColor(0);
      };

      const drawBarChart = (x: number, y: number, w: number, h: number) => {
        doc.setDrawColor(180);
        doc.rect(x, y, w, h);
        const padL = 34;
        const padB = 28;
        const padT = 12;
        const padR = 10;
        const ix = x + padL;
        const iy = y + padT;
        const iw = w - padL - padR;
        const ih = h - padT - padB;
        doc.setDrawColor(140);
        doc.line(ix, iy + ih, ix + iw, iy + ih);
        doc.line(ix, iy, ix, iy + ih);
        if (!porSector.length) return;
        const barW = iw / porSector.length;
        doc.setFillColor(22, 163, 74);
        doc.setFontSize(9);
        for (let i = 0; i < porSector.length; i++) {
          const v = Math.max(0, Math.min(100, porSector[i].promedio));
          const bh = (v / 100) * ih;
          doc.rect(ix + i * barW + 6, iy + ih - bh, Math.max(6, barW - 12), bh, "F");
          doc.setTextColor(80);
          doc.text(String(porSector[i].nombre), ix + i * barW + 6, iy + ih + 16, { maxWidth: Math.max(6, barW - 12) });
        }
        doc.setTextColor(0);
      };

      doc.setFontSize(16);
      doc.text(title, 40, 40);
      doc.setFontSize(11);
      doc.text(range, 40, 60);
      doc.setFontSize(12);
      doc.text(`Auditorías en período: ${filtradas.length}`, 40, 78);
      doc.text(`Promedio general: ${promedioGeneral.toFixed(1)}%`, 260, 78);

      doc.setFontSize(11);
      doc.text("Evolución mensual", 40, 106);
      drawLineChart(40, 116, 380, 210);
      doc.text("Promedio por sector", 440, 106);
      drawBarChart(440, 116, 380, 210);

      doc.setFontSize(10);
      doc.text("Puntaje por zona (promedio del período)", 40, 350);
      const zoneAgg = new Map<string, { sum: number; count: number }>();
      for (const d of detalles) {
        const p = Number(d.promedio);
        if (!Number.isFinite(p)) continue;
        const ex = zoneAgg.get(d.sub_item_nombre) ?? { sum: 0, count: 0 };
        ex.sum += p;
        ex.count += 1;
        zoneAgg.set(d.sub_item_nombre, ex);
      }
      const zoneRows = Array.from(zoneAgg.entries())
        .map(([zona, v]) => ({ zona, puntaje: v.count ? Math.round((v.sum / v.count) * 10) / 10 : 0, n: v.count }))
        .sort((a, b) => b.puntaje - a.puntaje);

      doc.autoTable({
        startY: 360,
        head: [["Zona 5S", "Puntaje (%)", "Muestras"]],
        body: zoneRows.map((r) => [r.zona, String(r.puntaje), String(r.n)]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [22, 163, 74] },
        theme: "grid",
      });

      doc.addPage();

      for (const k of monthsSorted) {
        const list = grouped.get(k) ?? [];
        const [anioStr, mesStr] = k.split("-");
        const anio = Number(anioStr);
        const mes = Number(mesStr);
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(11);
        doc.text(range, 40, 60);
        doc.setFontSize(13);
        doc.text(`${monthLabel(mes, anio)}`, 40, 86);

        const rows: Array<Array<string>> = [];
        for (const insp of list) {
          const dets = detailsByInsp.get(insp.id) ?? [];
          for (const d of dets) {
            for (const s of CINCO_S) {
              const val = scoreOf(d, s.key as ScoreKey);
              const v = val ?? null;
              rows.push([
                `${s.nombre}-${s.traduccion}`,
                d.sub_item_nombre,
                CRITERIO_DEFAULT,
                v === 0 ? check : "",
                v === 25 ? check : "",
                v === 50 ? check : "",
                v === 75 ? check : "",
                v === 100 ? check : "",
                v != null ? `${v}%` : "",
              ]);
            }
          }
        }

        doc.autoTable({
          startY: 102,
          head: [["Categoria", "Zona 5S", "Criterio", "Desconoce", "Cumple Parcialmente", "Cumple", "Cumple con mejoras", "Cumple todas las S", "Evaluacion"]],
          body: rows,
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [22, 163, 74] },
          theme: "grid",
        });
        if (k !== monthsSorted[monthsSorted.length - 1]) doc.addPage();
      }
      doc.save("reporte-inspecciones.pdf");
    } catch (e: unknown) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Error exportando PDF");
    } finally {
      setExporting(null);
    }
  };

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

  type Sector5S = {
    sector: Sector;
    n: number;
    promedio: number;
    s1: number;
    s2: number;
    s3: number;
    s4: number;
    s5: number;
  };

  const detallePorSector = useMemo<Sector5S[]>(() => {
    const inspIdsFiltradas = new Set(filtradas.map((i) => i.id));
    console.log("Filtradas inspecciones:", filtradas.length, "IDs:", Array.from(inspIdsFiltradas));
    console.log("Detalles cargados:", detallesCargados.length);
    const detallesDelPeriodo = detallesCargados.filter((d) => inspIdsFiltradas.has(d.inspeccion_id));
    console.log("Detalles del periodo (filtrados):", detallesDelPeriodo.length);
    const inspToSector = new Map<string, string>();
    filtradas.forEach((i) => inspToSector.set(i.id, i.sector_id));

    type Agg = { s: number; c: number };
    const agg = new Map<string, { s1: Agg; s2: Agg; s3: Agg; s4: Agg; s5: Agg; tot: Agg; n: Set<string> }>();

    const add = (a: Agg, v: number | null) => {
      if (v == null) return;
      a.s += v;
      a.c += 1;
    };
    const avg = (a: Agg) => {
      if (a.c === 0) return 0;
      // Calculate average based on completed criteria only (meaningful partial scores)
      return Math.round((a.s / a.c) * 10) / 10;
    };

    detallesDelPeriodo.forEach((d) => {
      const sectorId = inspToSector.get(d.inspeccion_id);
      if (!sectorId) return;
      if (!agg.has(sectorId)) {
        agg.set(sectorId, {
          s1: { s: 0, c: 0 }, s2: { s: 0, c: 0 }, s3: { s: 0, c: 0 }, s4: { s: 0, c: 0 }, s5: { s: 0, c: 0 },
          tot: { s: 0, c: 0 },
          n: new Set<string>(),
        });
      }
      const g = agg.get(sectorId)!;
      add(g.s1, d.s1_puntaje);
      add(g.s2, d.s2_puntaje);
      add(g.s3, d.s3_puntaje);
      add(g.s4, d.s4_puntaje);
      add(g.s5, d.s5_puntaje);
      add(g.tot, d.promedio);
      g.n.add(d.inspeccion_id);
    });

    return sectores
      .map((sec) => {
        const g = agg.get(sec.id);
        return {
          sector: sec,
          n: g ? g.n.size : 0,
          promedio: g ? avg(g.tot) : 0,
          s1: g ? avg(g.s1) : 0,
          s2: g ? avg(g.s2) : 0,
          s3: g ? avg(g.s3) : 0,
          s4: g ? avg(g.s4) : 0,
          s5: g ? avg(g.s5) : 0,
        };
      })
      .filter((x) => x.n > 0);
  }, [filtradas, detallesCargados, sectores]);

  const promedioGeneral = evolucion.length ? evolucion.reduce((a, e) => a + e.promedio, 0) / evolucion.length : 0;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <AppShell>
      <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-semibold">Reportes</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Resultados
          </h1>
          <p className="text-muted-foreground mt-2">Evolución del cumplimiento 5S período tras período.</p>
        </div>
        
        {layoutUrl && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary/20 hover:border-primary/50 transition-colors">
                <MapIcon className="h-4 w-4 text-primary" />
                Ver LAY OUT
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[90vw] p-0 overflow-hidden border-none bg-transparent shadow-none">
              <DialogHeader className="sr-only">
                <DialogTitle>Layout</DialogTitle>
              </DialogHeader>
              <img src={layoutUrl} alt="Layout" className="w-full h-auto rounded-lg shadow-2xl" />
            </DialogContent>
          </Dialog>
        )}
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
        <div className="flex flex-col sm:flex-row gap-2 justify-end mt-4">
          <Button variant="outline" disabled={!filtradas.length || exporting != null} onClick={exportExcel} className="gap-2">
            {exporting === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar Excel
          </Button>
          <Button variant="outline" disabled={!filtradas.length || exporting != null} onClick={exportPdf} className="gap-2">
            {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar PDF
          </Button>
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
          <p className="text-xs text-muted-foreground mb-1">Auditorías en período</p>
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

      <Card className="bg-gradient-surface border-border/50 shadow-card overflow-hidden mb-6">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Puntajes por sector (desglose 5S)</h2>
          {cargandoDetalles && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Analizando...</span>}
        </div>
        <div className="divide-y divide-border/50">
          {detallePorSector.length === 0 && (
            <p className="p-8 text-center text-muted-foreground text-sm">
              {cargandoDetalles ? "Cargando detalles..." : "Sin datos suficientes para el período."}
            </p>
          )}
          {detallePorSector.map((d) => {
            const abierto = sectorAbierto[d.sector.id] ?? false;
            const sem = semaforo(d.promedio);
            const valores = [
              { key: "s1_puntaje", s: CINCO_S[0], v: d.s1 },
              { key: "s2_puntaje", s: CINCO_S[1], v: d.s2 },
              { key: "s3_puntaje", s: CINCO_S[2], v: d.s3 },
              { key: "s4_puntaje", s: CINCO_S[3], v: d.s4 },
              { key: "s5_puntaje", s: CINCO_S[4], v: d.s5 },
            ];
            return (
              <div key={d.sector.id}>
                <button
                  type="button"
                  className="w-full p-4 flex items-center gap-4 hover:bg-muted/20 transition text-left"
                  onClick={() => setSectorAbierto((prev) => ({ ...prev, [d.sector.id]: !prev[d.sector.id] }))}
                >
                  <div className="text-2xl shrink-0">{d.sector.emoji ?? "📁"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{d.sector.nombre}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{d.n} inspección{d.n === 1 ? "" : "es"}</span>
                    </div>
                    <div className="mt-2"><ProgressBar value={d.promedio} showLabel={false} height="h-2" /></div>
                  </div>
                  <span className="text-xl font-bold tabular-nums shrink-0" style={{ color: sem.bg, fontFamily: "'Space Grotesk', sans-serif" }}>
                    {d.promedio.toFixed(0)}%
                  </span>
                  {abierto ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                {abierto && (
                  <div className="px-4 pb-5 space-y-2 bg-muted/10 border-t border-border/30">
                    <div className="grid grid-cols-5 gap-2 pt-4">
                      {valores.map(({ key, s, v }) => {
                        const ss = semaforo(v);
                        return (
                          <div key={key} className="text-center">
                            <div className="text-[10px] font-bold text-primary uppercase tracking-wide mb-1">{s.codigo}</div>
                            <div className="text-[10px] text-muted-foreground mb-1 truncate" title={s.nombre}>{s.nombre}</div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-1">
                              <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: ss.bg }} />
                            </div>
                            <div className="text-sm font-bold tabular-nums" style={{ color: ss.bg }}>{v.toFixed(0)}%</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 pt-2">
                      {valores.map(({ key, s, v }) => {
                        const ss = semaforo(v);
                        return (
                          <div key={`row-${key}`} className="flex items-center gap-3 px-3 py-2 rounded-md bg-background/40 border border-border/30">
                            <span className="text-xs font-bold text-primary w-8 shrink-0">{s.codigo}</span>
                            <span className="text-xs font-medium w-24 shrink-0">{s.nombre}</span>
                            <span className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">{s.traduccion}</span>
                            <div className="flex-1 min-w-[120px]"><ProgressBar value={v} showLabel={false} height="h-2" /></div>
                            <span className="text-xs font-bold tabular-nums w-12 text-right shrink-0" style={{ color: ss.bg }}>{v.toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="bg-gradient-surface border-border/50 shadow-card overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h2 className="font-semibold flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" />Detalle de auditorías</h2>
        </div>
        <div className="divide-y divide-border/50">
          {filtradas.length === 0 && <p className="p-8 text-center text-muted-foreground text-sm">Sin inspecciones en este período.</p>}
          {filtradas.map((i) => {
            const sector = sectores.find((s) => s.id === i.sector_id);
            const p = Number(i.puntaje_total) || 0;
            const content = (
              <>
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
              </>
            );
            return user ? (
              <button
                key={i.id}
                onClick={() => navigate(`/inspeccion/${i.id}`)}
                className="w-full p-4 flex items-center gap-4 hover:bg-muted/30 transition text-left"
              >
                {content}
              </button>
            ) : (
              <div key={i.id} className="w-full p-4 flex items-center gap-4 text-left">
                {content}
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
