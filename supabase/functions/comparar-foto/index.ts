import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { fotoActualUrl, fotoMaestraUrl, subItemNombre } = await req.json();
    if (!fotoActualUrl) {
      return new Response(JSON.stringify({ error: "Falta fotoActualUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no configurada");

    const userContent: any[] = [
      {
        type: "text",
        text: `Sos un auditor experto en metodología 5S (Seiri, Seiton, Seiso, Seiketsu, Shitsuke).
Analizá la foto del área "${subItemNombre ?? "área de trabajo"}".
${fotoMaestraUrl ? "Te paso también una FOTO MAESTRA (estado ideal de referencia). Comparala con la FOTO ACTUAL." : "No hay foto maestra de referencia, evaluá el estado en absoluto."}

Devolvé un JSON estricto con esta forma:
{
  "puntaje": <entero 0-100>,
  "comentario": "<máx 240 caracteres explicando hallazgos clave 5S>",
  "s1_seiri": <0|25|75|100>,
  "s2_seiton": <0|25|75|100>,
  "s3_seiso": <0|25|75|100>,
  "s4_seiketsu": <0|25|75|100>,
  "s5_shitsuke": <0|25|75|100>
}
Donde 0=No cumple y desconoce, 25=No cumple, 75=Cumple pero falta mejorar, 100=Sí cumple.
Respondé SOLO el JSON sin explicaciones extra ni markdown.`,
      },
      { type: "image_url", image_url: { url: fotoActualUrl } },
    ];
    if (fotoMaestraUrl) {
      userContent.push({ type: "image_url", image_url: { url: fotoMaestraUrl } });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Sos un auditor 5S experto. Respondés siempre JSON válido." },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes a la IA. Probá en un minuto." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Sin créditos de IA. Recargá en Configuración > Workspace > Uso." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Error en la IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const raw: string = aiJson.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\s*|```/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { puntaje: 0, comentario: cleaned.slice(0, 240) }; }

    const clampScale = (n: any) => {
      const v = Number(n);
      if ([0, 25, 75, 100].includes(v)) return v;
      if (v < 13) return 0;
      if (v < 50) return 25;
      if (v < 88) return 75;
      return 100;
    };
    const result = {
      puntaje: Math.max(0, Math.min(100, Math.round(Number(parsed.puntaje ?? 0)))),
      comentario: String(parsed.comentario ?? "").slice(0, 240),
      s1_seiri: clampScale(parsed.s1_seiri),
      s2_seiton: clampScale(parsed.s2_seiton),
      s3_seiso: clampScale(parsed.s3_seiso),
      s4_seiketsu: clampScale(parsed.s4_seiketsu),
      s5_shitsuke: clampScale(parsed.s5_shitsuke),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("comparar-foto error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
