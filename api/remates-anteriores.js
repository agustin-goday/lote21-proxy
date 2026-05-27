// api/remates-anteriores.js — Lista remates anteriores al remate actual de Aramburu

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Usar el mismo endpoint de plazarural para saber cuál es el remate actual
    // Así ambos widgets están perfectamente sincronizados
    const actualRes = await fetch("https://lote21-proxy.vercel.app/api/plazarural", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    });
    const actualData = await actualRes.json();

    if (!actualData.ok || !actualData.numero) {
      throw new Error("No se pudo obtener el remate actual");
    }

    const base = parseInt(actualData.numero);

    // Generar lista de los 10 remates anteriores al actual
    const remates = [];
    for (let i = 1; i <= 10; i++) {
      const num = base - i;
      if (num < 1) break;
      remates.push({
        numero: num,
        urlLotes:     `https://plazarural.com.uy/remates/${num}?_token=dxAkpnxQnWSIWopkJYMpHAiHkT58qV1uxQYFy9RV&categoria_id=&filtro_condicion=&escritorio_id=7&departamento_id=&inspector_id=&lote_especial_id=&nro_lote=&nro_inspeccion=`,
        urlPromedios: `https://plazarural.com.uy/promedios?nro_remate=${num}`,
      });
    }

    return res.status(200).json({
      ok: true,
      numeroActual: base,
      remates,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
