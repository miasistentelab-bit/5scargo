export const NIVELES = [
  { valor: 0, label: "No cumple y desconoce", short: "0%" },
  { valor: 25, label: "No cumple", short: "25%" },
  { valor: 75, label: "Cumple pero falta mejorar", short: "75%" },
  { valor: 100, label: "Sí cumple", short: "100%" },
] as const;

export const CINCO_S = [
  { key: "s1_puntaje" as const, codigo: "1S", nombre: "SEIRI", traduccion: "Clasificar" },
  { key: "s2_puntaje" as const, codigo: "2S", nombre: "SEITON", traduccion: "Ordenar" },
  { key: "s3_puntaje" as const, codigo: "3S", nombre: "SEISO", traduccion: "Limpiar" },
  { key: "s4_puntaje" as const, codigo: "4S", nombre: "SEIKETSU", traduccion: "Estandarizar" },
  { key: "s5_puntaje" as const, codigo: "5S", nombre: "SHITSUKE", traduccion: "Disciplina" },
];

export function semaforo(p: number) {
  if (p < 50) return { color: "destructive", label: "Crítico", bg: "hsl(var(--destructive))" };
  if (p < 80) return { color: "warning", label: "Aceptable", bg: "hsl(var(--warning))" };
  return { color: "success", label: "Excelente", bg: "hsl(var(--success))" };
}

export function meses() {
  return [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];
}

export function promedio(detalles: Array<{ promedio: number | null }>) {
  if (!detalles.length) return 0;
  const sum = detalles.reduce((a, d) => a + (Number(d.promedio) || 0), 0);
  return Math.round((sum / detalles.length) * 100) / 100;
}
