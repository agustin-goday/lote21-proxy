// api/noticias.js — RSS Blasina con fix de encoding y og:image

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Decodifica entidades HTML comunes
  function decodeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&aacute;/gi, "á").replace(/&eacute;/gi, "é")
      .replace(/&iacute;/gi, "í").replace(/&oacute;/gi, "ó")
      .replace(/&uacute;/gi, "ú").replace(/&ntilde;/gi, "ñ")
      .replace(/&Aacute;/gi, "Á").replace(/&Eacute;/gi, "É")
      .replace(/&Iacute;/gi, "Í").replace(/&Oacute;/gi, "Ó")
      .replace(/&Uacute;/gi, "Ú").replace(/&Ntilde;/gi, "Ñ")
      .replace(/&uuml;/gi,  "ü").replace(/&Uuml;/gi,  "Ü")
      .replace(/&auml;/gi,  "ä").replace(/&ouml;/gi,  "ö")
      .replace(/&amp;/gi,   "&").replace(/&quot;/gi,  '"')
      .replace(/&lt;/gi,    "<").replace(/&gt;/gi,    ">")
      .replace(/&nbsp;/gi,  " ").replace(/&mdash;/gi, "—")
      .replace(/&ndash;/gi, "–").replace(/&laquo;/gi, "«")
      .replace(/&raquo;/gi, "»").replace(/&ldquo;/gi, """)
      .replace(/&rdquo;/gi, """).replace(/&lsquo;/gi, "'")
      .replace(/&rsquo;/gi, "'").replace(/&hellip;/gi,"…")
      // Entidades numéricas decimales &#NNN;
      .replace(/&#(\d+);/g, function(_, n) {
        return String.fromCharCode(parseInt(n, 10));
      })
      // Entidades numéricas hexadecimales &#xHH;
      .replace(/&#x([0-9a-f]+);/gi, function(_, h) {
        return String.fromCharCode(parseInt(h, 16));
      });
  }

  try {
    const response = await fetch("https://blasinayasociados.com/ganaderia/feed/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    const xml = await response.text();
    const EXCLUIR = ["plaza rural", "pantalla uruguay"];

    const rawItems = [];
    const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];

    for (const match of itemMatches) {
      const x = match[1];

      const titulo = decodeHtml(
        (x.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
         x.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() || ""
      );

      if (EXCLUIR.some(p => titulo.toLowerCase().includes(p))) continue;

      const link = x.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ||
                   x.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() || "";

      const fechaRaw = x.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";
      const fechaObj = new Date(fechaRaw);
      const fecha = isNaN(fechaObj) ? fechaRaw
        : `${fechaObj.getDate()}-${String(fechaObj.getMonth()+1).padStart(2,"0")}-${fechaObj.getFullYear()}`;

      const autor = decodeHtml(
        (x.match(/<dc:creator><!\[CDATA\[([\s\S]*?)\]\]><\/dc:creator>/) ||
         x.match(/<author>([\s\S]*?)<\/author>/))?.[1]?.trim() || "Blasina y Asociados"
      );

      const contenido = x.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] || "";

      let imagen = x.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ||
                   x.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1] || null;

      if (!imagen && contenido) {
        const imgMatches = [...contenido.matchAll(/<img[^>]+src="([^"]+)"/gi)];
        for (const im of imgMatches) {
          const src = im[1];
          if (!src.includes(".gif") && src.includes("wp-content/uploads")) {
            imagen = src;
            break;
          }
        }
      }

      const resumenRaw = (x.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                          x.match(/<description>([\s\S]*?)<\/description>/))?.[1]
                           ?.replace(/<[^>]+>/g, " ")?.replace(/\s+/g, " ")?.trim() || "";
      const resumen = decodeHtml(resumenRaw).substring(0, 250);

      rawItems.push({ titulo, link, fecha, autor, imagen, resumen, contenido });
      if (rawItems.length >= 8) break;
    }

    // Buscar og:image para los que no tienen imagen
    const items = await Promise.all(rawItems.map(async (item) => {
      if (item.imagen) return item;
      try {
        const pageRes = await fetch(item.link, {
          headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
        });
        const pageHtml = await pageRes.text();
        const ogImg = pageHtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
                      pageHtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1] || null;
        return { ...item, imagen: ogImg };
      } catch (_) {
        return item;
      }
    }));

    return res.status(200).json({ ok: true, noticias: items, timestamp: new Date().toISOString() });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
