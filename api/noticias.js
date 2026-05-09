// api/noticias.js — RSS Blasina con imagen extraída del contenido si no está en el feed

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch("https://blasinayasociados.com/ganaderia/feed/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    const xml = await response.text();
    const EXCLUIR = ["plaza rural", "pantalla uruguay"];
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio",
                   "agosto","septiembre","octubre","noviembre","diciembre"];

    const items = [];
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

    for (const match of itemMatches) {
      const x = match[1];

      const titulo = (x.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                      x.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() || "";

      if (EXCLUIR.some(p => titulo.toLowerCase().includes(p))) continue;

      const link = x.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ||
                   x.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() || "";

      const fechaRaw = x.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";
      const fechaObj = new Date(fechaRaw);
      const fecha = isNaN(fechaObj) ? fechaRaw
        : `${fechaObj.getDate()}-${String(fechaObj.getMonth()+1).padStart(2,"0")}-${fechaObj.getFullYear()}`;

      const autor = (x.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/) ||
                     x.match(/<author>([\s\S]*?)<\/author>/))?.[1]?.trim() || "Blasina y Asociados";

      // Contenido completo
      const contenido = x.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] || "";

      // Imagen: buscar en media:content, enclosure, o primera img del contenido
      let imagen = x.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ||
                   x.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1] || null;

      if (!imagen && contenido) {
        // Buscar primera img que no sea un gif o tracking pixel
        const imgMatches = [...contenido.matchAll(/<img[^>]+src="([^"]+)"/gi)];
        for (const im of imgMatches) {
          const src = im[1];
          if (!src.includes(".gif") && !src.includes("pixel") && src.includes("wp-content")) {
            // Preferir la versión -768x o la original, no thumbnails pequeños
            imagen = src;
            break;
          }
        }
      }

      const resumen = (x.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                       x.match(/<description>([\s\S]*?)<\/description>/))?.[1]
                        ?.replace(/<[^>]+>/g, " ")?.replace(/\s+/g, " ")?.trim()?.substring(0, 250) || "";

      items.push({ titulo, link, fecha, autor, imagen, resumen, contenido });
      if (items.length >= 8) break;
    }

    return res.status(200).json({ ok: true, noticias: items, timestamp: new Date().toISOString() });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
