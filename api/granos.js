// api/granos.js — Scraper de precios de granos desde revistaverde.com.uy

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch("https://revistaverde.com.uy/precio-mercado-nacional/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-UY,es;q=0.9",
      },
    });

    const html = await response.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Extraer fecha y hora de actualización
    const fechaMatch = texto.match(/Fecha:\s*([\d]+ \w+ \d{4})\s*\|\s*Hora:\s*([\d:]+hs)/i);
    const fechaActualizacion = fechaMatch ? fechaMatch[1] + " " + fechaMatch[2] : null;

    // Función para extraer precio de una posición
    function extraerPrecios(seccion, grano) {
      // Buscar el bloque del grano dentro de la sección
      const idx = seccion.indexOf(grano);
      if (idx === -1) return [];
      const bloque = seccion.substring(idx, idx + 300);
      // Extraer pares posicion/precio: "Mayo 382,42 Julio 387,11"
      const matches = [...bloque.matchAll(/([A-Za-záéíóúÁÉÍÓÚ]+)\s+([\d]+[,.][\d]+)/g)];
      return matches.slice(0, 2).map(m => ({
        posicion: m[1],
        precio: m[2].replace(",", ".")
      }));
    }

    // Separar sección internacional y local
    // Internacional viene primero, local después de "Referencias Locales"
    const idxLocal = texto.indexOf("Referencias Locales");
    const seccionIntl  = idxLocal > -1 ? texto.substring(0, idxLocal) : texto;
    const seccionLocal = idxLocal > -1 ? texto.substring(idxLocal) : "";

    const internacional = {
      soja:  extraerPrecios(seccionIntl, "Soja"),
      maiz:  extraerPrecios(seccionIntl, "Ma"),
      trigo: extraerPrecios(seccionIntl, "Trigo"),
    };

    const local = {
      soja:  extraerPrecios(seccionLocal, "Soja"),
      maiz:  extraerPrecios(seccionLocal, "Ma"),
      trigo: extraerPrecios(seccionLocal, "Trigo"),
    };

    return res.status(200).json({
      ok: true,
      fechaActualizacion,
      internacional,
      local,
      fuente: "https://revistaverde.com.uy/precio-mercado-nacional/",
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
