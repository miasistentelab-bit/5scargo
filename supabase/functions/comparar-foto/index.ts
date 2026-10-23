const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DenoServeHandler = (req: Request) => Response | Promise<Response>;
declare const Deno: {
  serve: (handler: DenoServeHandler) => void;
  env: { get: (key: string) => string | undefined };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    if (!rawBody.trim()) {
      return new Response(JSON.stringify({ error: "Body vacío (se esperaba JSON)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let bodyUnknown: unknown;
    try {
      bodyUnknown = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido en body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = typeof bodyUnknown === "object" && bodyUnknown ? (bodyUnknown as Record<string, unknown>) : {};
    const fotoActualUrl = typeof body.fotoActualUrl === "string" ? body.fotoActualUrl : "";
    const fotoActualUrls = Array.isArray(body.fotoActualUrls) ? body.fotoActualUrls : [];
    const fotoMaestraUrl = typeof body.fotoMaestraUrl === "string" ? body.fotoMaestraUrl : "";
    const fotoMaestraUrls = Array.isArray(body.fotoMaestraUrls) ? body.fotoMaestraUrls : [];
    const subItemNombre = typeof body.subItemNombre === "string" ? body.subItemNombre : "";

    const evidencias: string[] = fotoActualUrls
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .concat(fotoActualUrl ? [fotoActualUrl] : [])
      .slice(0, 4);

    if (!evidencias.length) {
      return new Response(JSON.stringify({ error: "Falta fotoActualUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maestras: string[] = fotoMaestraUrls
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .concat(fotoMaestraUrl ? [fotoMaestraUrl] : [])
      .slice(0, 4);

    if (!maestras.length) {
      return new Response(JSON.stringify({ error: "No hay fotos originales para comparar" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HF_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY") ?? Deno.env.get("HF_API_KEY") ?? Deno.env.get("HF_TOKEN");
    if (!HF_API_KEY) throw new Error("HUGGINGFACE_API_KEY no configurada");

    const fetchImage = async (url: string) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`No se pudo descargar imagen (${r.status})`);
      const contentType = r.headers.get("content-type") ?? "application/octet-stream";
      const bytes = new Uint8Array(await r.arrayBuffer());
      return { bytes, contentType };
    };

    const parseEmbedding = (data: unknown): number[] | null => {
      if (!Array.isArray(data)) return null;
      const first = data[0];
      if (Array.isArray(first)) {
        const vec = first.filter((x): x is number => typeof x === "number");
        return vec.length ? vec : null;
      }
      const vec = data.filter((x): x is number => typeof x === "number");
      return vec.length ? vec : null;
    };

    type EmbeddingResult = { vec: number[] } | { error: string; status: number };
    const getEmbedding = async (img: { bytes: Uint8Array; contentType: string }): Promise<EmbeddingResult> => {
      const endpoints = [
        "https://router.huggingface.co/hf-inference/models/openai/clip-vit-base-patch32",
        "https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32",
      ];

      for (const url of endpoints) {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            "Content-Type": img.contentType || "application/octet-stream",
            Accept: "application/json",
          },
          body: img.bytes as unknown as BodyInit,
        });

        if (resp.ok) {
          const json: unknown = await resp.json();
          const vec = parseEmbedding(json);
          if (!vec) return { error: "Respuesta inválida de embeddings (Hugging Face)", status: 200 };
          return { vec };
        }

        if (resp.status === 404) {
          const t = await resp.text().catch(() => "");
          console.error("HF error", resp.status, url, t);
          continue;
        }

        if (resp.status === 503) return { error: "Modelo cargando (Hugging Face). Reintentá en unos segundos.", status: 503 };
        if (resp.status === 429) return { error: "Límite de uso alcanzado (Hugging Face). Probá en un minuto.", status: 429 };
        if (resp.status === 401 || resp.status === 403) return { error: "Token de Hugging Face inválido o sin permisos (401/403).", status: resp.status };

        const t = await resp.text();
        console.error("HF error", resp.status, url, t);
        const details = t.replace(/\s+/g, " ").slice(0, 220);
        return { error: `Error en Hugging Face (${resp.status}): ${details || "sin detalle"}`, status: resp.status };
      }

      return { error: "Error en Hugging Face (404): endpoint no disponible", status: 404 };
    };

    const dot = (a: number[], b: number[]) => {
      const n = Math.min(a.length, b.length);
      let s = 0;
      for (let i = 0; i < n; i++) s += a[i] * b[i];
      return s;
    };
    const norm = (a: number[]) => Math.sqrt(dot(a, a));
    const cosine = (a: number[], b: number[]) => {
      const na = norm(a);
      const nb = norm(b);
      if (!na || !nb) return 0;
      return dot(a, b) / (na * nb);
    };

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const scoreFromSim = (sim: number) => {
      const scaled = ((sim - 0.15) / (0.35 - 0.15)) * 100;
      return Math.round(clamp(scaled, 0, 100));
    };
    const levelFromScore = (score: number) => {
      if (score < 13) return 0;
      if (score < 50) return 25;
      if (score < 88) return 75;
      return 100;
    };

    const maestrasEmb: number[][] = [];
    const maestrasErrors: Array<{ error: string; status?: number }> = [];
    for (const u of maestras) {
      const img = await fetchImage(u);
      const emb = await getEmbedding(img);
      if ("error" in emb) {
        maestrasErrors.push({ error: emb.error, status: emb.status });
        continue;
      }
      maestrasEmb.push(emb.vec);
    }
    if (!maestrasEmb.length) {
      const most = maestrasErrors.find((e) => e.status === 503)
        ?? maestrasErrors.find((e) => e.status === 429)
        ?? maestrasErrors.find((e) => e.status === 401 || e.status === 403)
        ?? maestrasErrors[0];
      const msg = most?.error ? `No se pudieron procesar las fotos originales. ${most.error}` : "No se pudieron procesar las fotos originales.";
      const status = most?.status === 503 ? 503 : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evidenciasErrors: Array<{ error: string; status?: number }> = [];
    const bestSims: number[] = [];
    for (const u of evidencias) {
      const img = await fetchImage(u);
      const emb = await getEmbedding(img);
      if ("error" in emb) {
        evidenciasErrors.push({ error: emb.error, status: emb.status });
        continue;
      }
      let best = -1;
      for (const m of maestrasEmb) {
        const sim = cosine(emb.vec, m);
        if (sim > best) best = sim;
      }
      if (best >= 0) bestSims.push(best);
    }
    if (!bestSims.length) {
      const most = evidenciasErrors.find((e) => e.status === 503)
        ?? evidenciasErrors.find((e) => e.status === 429)
        ?? evidenciasErrors.find((e) => e.status === 401 || e.status === 403)
        ?? evidenciasErrors[0];
      const msg = most?.error ? `No se pudieron procesar las fotos de evidencia. ${most.error}` : "No se pudieron procesar las fotos de evidencia.";
      const status = most?.status === 503 ? 503 : 500;
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const avgSim = bestSims.reduce((a, b) => a + b, 0) / bestSims.length;
    const puntaje = scoreFromSim(avgSim);
    const nivel = levelFromScore(puntaje);
    const comentarioBase = `Comparación automática: ${bestSims.length} evidencia(s) vs ${maestrasEmb.length} original(es). Similitud: ${puntaje}%`;
    const result = {
      puntaje,
      comentario: (subItemNombre ? `${subItemNombre}: ` : "") + comentarioBase,
      s1_seiri: nivel,
      s2_seiton: nivel,
      s3_seiso: nivel,
      s4_seiketsu: nivel,
      s5_shitsuke: nivel,
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
