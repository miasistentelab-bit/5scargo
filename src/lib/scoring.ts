export const NIVELES = [
  { valor: 0, label: "Desconoce", short: "0%" },
  { valor: 25, label: "Cumple Parcialmente", short: "25%" },
  { valor: 50, label: "Cumple", short: "50%" },
  { valor: 75, label: "Cumple con mejoras", short: "75%" },
  { valor: 100, label: "Cumple todas las S", short: "100%" },
] as const;

export const CINCO_S = [
  { key: "s1_puntaje" as const, codigo: "1S", nombre: "SEIRI", traduccion: "Organización" },
  { key: "s2_puntaje" as const, codigo: "2S", nombre: "SEITON", traduccion: "Ordenar" },
  { key: "s3_puntaje" as const, codigo: "3S", nombre: "SEISO", traduccion: "Limpiar" },
  { key: "s4_puntaje" as const, codigo: "4S", nombre: "SEIKETSU", traduccion: "Estandarizar" },
  { key: "s5_puntaje" as const, codigo: "5S", nombre: "SHITSUKE", traduccion: "Disciplina" },
];

export const PREGUNTAS_GUIA: Record<string, string[]> = {
  s1_puntaje: [
    "¿Hay en el sector elementos que interfieran la normal circulación? Ej.: Cajones",
    "¿Hay en el lugar materiales o insumos innecesarios?",
    "¿Hay en el sector algún equipo o herramienta que se encuentre roto, deteriorado o fuera de uso?",
    "¿Hay piezas de repuestos innecesarias para llevar a cabo las actividades normales del sector?",
    "En el caso de haber equipos innecesarios o fuera de uso, ¿están identificados y correctamente bloqueados?",
    "¿Hay en el lugar elementos personales fuera del lugar definido para los mismos?",
    "¿Se encuentran en el área registros, estándares, opls, carpetas, comunicaciones en Gral., desactualizadas, obsoletas o en mal estado?",
  ],
  s2_puntaje: [
    "¿Existe un layout del sector donde queden claramente identificadas las ubicaciones de equipos y componentes necesarios?",
    "¿Las sendas peatonales, demarcación de equipos y componentes están claramente marcadas? ¿Están en buen estado?",
    "¿Se encuentran las carteleras, carpetas y/o cualquier otro material de trabajo/comunicación en el lugar definido?",
    "¿Los contenedores o recipientes para residuos/subproductos son adecuados para el almacenamiento de los deshechos del área y están identificados mediante etiquetas y tienen una ubicación definida?",
    "Se encuentran todos los productos químicos correctamente identificados y en el lugar correspondiente? Las hojas de datos y la matriz de compatibilidad esta presente en el lugar y se respeta?",
    "¿Los equipos, herramientas, piezas de formatos, insumos, equipos y elementos de limpieza tienen un lugar asignado y se encuentran en el mismo? El interior de armarios/gabinetes/escritorios están ordenados e identificado su contenido?",
  ],
  s3_puntaje: [
"¿Los pisos se encuentran limpios, sin residuos sólidos ni líquidos?",	
"¿Las paredes y techos están limpios? ¿Sin tierra ni telas de arañas?",
"¿Las ventanas se encuentran limpias, sin marcos ni vidrios rotos?",	
"¿El sector de trabajo y las herramientas se encuentra limpias sin restos de aceites o grasas?"	,
"¿La limpieza es monitoreada mediante un check con horarios y responsables ?",
"¿Se evidencia en el sector el concepto \"se ensucia - se limpia\" por parte de los miembros del equipo?",
  ],
  s4_puntaje: [

    "¿Se presentan ideas en el sector para mejorar 5S?",
"¿Las ideas son analizadas y se da feedback	",
"¿Se cuenta con un estándar de orden y limpieza del sector? ¿Se evidencia cumplimiento del mismo?	",
"¿Se evidencia un layout del sector donde estén definidos dueños por área?	",
"¿Hay un plan de acción enfocado para el alcance de las 5S y su mejora?	",  
"¿Es parte del trabajo cotidiano la organización, el orden y la limpieza? ¿Tienen definidos una RACI que defina quien hace cada tarea? ¿Tiene definido cada persona un sector del que es dueño?",
  ],
  s5_puntaje: [
    "¿Se realizan las autoauditorias de 5S?	",
"¿Se cuenta con un cronograma de auditorias cruzadas? ¿Su cumplimiento es mayor al 80%?	",
"¿Los estándares son revisados periódicamente? ¿Existen evidencias de las revisiones?	",	
"¿Los estándares son revisados periódicamente? ¿Existen evidencias de las revisiones?	",	
"Las carteleras, ¿son actualizadas de manera regular?	",	
"¿Los hallazgos levantados en auditorias anteriores están resueltos o con un plan concreto para resolverlos?	",	
"Se puede mostrar evidencia de mejora en el sector?	",
  ],
};

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
