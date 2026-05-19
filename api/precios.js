// api/precios.js — Scraper de precios de ganado desde acg.com.uy
// con KV Storage para semana anterior

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  function extraer(texto, patron) {
    const m = texto.match(patron);
    return m ? m[1].replace(",", ".") : null;
  }

  try {
    const response = await fetch("https://acg.com.uy/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-UY,es;q=0.9",
      },
    });

    const html = await response.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Semana y período de fechas
    // Ejemplo en página: "Precios de la semana N°20 (del 12/05/2026 - 18/05/2026)"
    const semanaMatch = texto.match(/semana\s*N[°º]\s*(\d+)\s*\(del\s*([^)]+)\)/i);
    const semana  = semanaMatch ? semanaMatch[1] : null;
    const periodo = semanaMatch ? semanaMatch[2].trim() : null;

    // Ganado gordo
    const novillo    = extraer(texto, /Novillo[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaca       = extraer(texto, /Vaca[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaquillona = extraer(texto, /Vaquillona[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);

    // Reposición
    const ternero       = extraer(texto, /Ternero[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const ternera       = extraer(texto, /Ternera[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const vacaInvernada = extraer(texto, /Vaca de Invernada[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);

    // Faena semanal
    const bovinos    = extraer(texto, /Faena semanal\s*([\d.,]+)\s*vacunos/i);
    const bovinosAnt = extraer(texto, /vacunos\s*([\d.,]+)\s*semana anterior/i);
    const ovinos     = extraer(texto, /Faena semanal[\s\S]{0,200}?([\d.,]+)\s*ovinos/i);
    const ovinosAnt  = extraer(texto, /ovinos\s*([\d.,]+)\s*semana anterior/i);

    // KV: leer semana anterior guardada
    let novilloAnt = null, vacaAnt = null, vaquillonaAnt = null;
    let semanaAnteriorGuardada = null;
    let kvConectado = false;
    let kvUrl = null;

    try {
      kvUrl = process.env.KV_REST_API_URL;
      const kvToken = process.env.KV_REST_API_TOKEN;
      if (kvUrl && kvToken) {
        kvConectado = true;
        const kvRes = await fetch(`${kvUrl}/get/precios_semana_anterior`, {
          headers: { Authorization: `Bearer ${kvToken}` }
        });
        const kvData = await kvRes.json();
        if (kvData.result) {
          const ant = JSON.parse(kvData.result);
          novilloAnt    = ant.novillo    || null;
          vacaAnt       = ant.vaca       || null;
          vaquillonaAnt = ant.vaquillona || null;
          semanaAnteriorGuardada = ant.semana || null;
        }

        // Guardar semana actual solo si es una semana nueva
        const semNum = parseInt(semana || "0");
        const semGuardadaNum = parseInt(semanaAnteriorGuardada || "0");
        if (semNum > semGuardadaNum && novillo && vaca && vaquillona) {
          await fetch(`${kvUrl}/set/precios_semana_anterior`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${kvToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(JSON.stringify({
              semana, novillo, vaca, vaquillona
            }))
          });
        }
      }
    } catch (_) {}

    return res.status(200).json({
      ok: true,
      semana,
      periodo,
      gordos: {
        novillo,    novilloAnt,
        vaca,       vacaAnt,
        vaquillona, vaquillonaAnt,
      },
      reposicion: { ternero, ternera, vacaInvernada },
      faena: {
        bovinos:    bovinos    ? bovinos.replace(".", "")    : null,
        bovinosAnt: bovinosAnt ? bovinosAnt.replace(".", "") : null,
        ovinos:     ovinos     ? ovinos.replace(".", "")     : null,
        ovinosAnt:  ovinosAnt  ? ovinosAnt.replace(".", "")  : null,
      },
      semanaAnteriorGuardada,
      kvConectado,
      kvUrl: kvUrl ? kvUrl.substring(0, 35) + "..." : null,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
