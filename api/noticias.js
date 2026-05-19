// api/noticias.js — RSS Blasina con og:image y timeout

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  function decodeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&aacute;/gi,"a").replace(/&eacute;/gi,"e")
      .replace(/&iacute;/gi,"i").replace(/&oacute;/gi,"o")
      .replace(/&uacute;/gi,"u").replace(/&ntilde;/gi,"n")
      .replace(/&Aacute;/gi,"A").replace(/&Eacute;/gi,"E")
      .replace(/&Iacute;/gi,"I").replace(/&Oacute;/gi,"O")
      .replace(/&Uacute;/gi,"U").replace(/&Ntilde;/gi,"N")
      .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
      .replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
      .replace(/&nbsp;/gi," ").replace(/&mdash;/gi,"\u2014")
      .replace(/&ndash;/gi,"\u2013").replace(/&ldquo;/gi,"\u201C")
      .replace(/&rdquo;/gi,"\u201D").replace(/&lsquo;/gi,"\u2018")
      .replace(/&rsquo;/gi,"\u2019").replace(/&hellip;/gi,"\u2026")
      .replace(/&#(\d+);/g, function(_,n){ return String.fromCharCode(parseInt(n,10)); })
      .replace(/&#x([0-9a-f]+);/gi, function(_,h){ return String.fromCharCode(parseInt(h,16)); });
  }

  async function fetchWithTimeout(url, opts, ms) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const r = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      return r;
    } catch(e) {
      clearTimeout(id);
      throw e;
    }
  }

  async function getOgImage(url) {
    try {
      const r = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" } }, 4000);
      const html = await r.text();
      return html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ||
             html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1] || null;
    } catch(_) { return null; }
  }

  try {
    const response = await fetchWithTimeout("https://blasinayasociados.com/ganaderia/feed/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    }, 8000);

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

      // Filtrar por título Y contenido
      const resumenRaw = decodeHtml(
        (x.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
         x.match(/<description>([\s\S]*?)<\/description>/))?.[1]
          ?.replace(/<[^>]+>/g," ")?.replace(/\s+/g," ")?.trim() || ""
      );
      const contenidoRaw = x.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] || "";
      const textoCompleto = (titulo + " " + resumenRaw + " " + contenidoRaw).toLowerCase();
      if (EXCLUIR.some(p => textoCompleto.includes(p))) continue;

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

      // Imagen del feed o del contenido HTML
      let imagen = x.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] || null;
      if (!imagen && contenido) {
        const imgs = [...contenido.matchAll(/<img[^>]+src="([^"]+)"/gi)];
        for (const im of imgs) {
          if (!im[1].includes(".gif") && im[1].includes("wp-content/uploads")) {
            imagen = im[1]; break;
          }
        }
      }

      const resumen = decodeHtml(
        (x.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
         x.match(/<description>([\s\S]*?)<\/description>/))?.[1]
          ?.replace(/<[^>]+>/g," ")?.replace(/\s+/g," ")?.trim() || ""
      ).substring(0, 250);

      rawItems.push({ titulo, link, fecha, autor, imagen, resumen, contenido });
      if (rawItems.length >= 8) break;
    }

    // Buscar og:image solo para los que no tienen imagen, con timeout individual
    const items = await Promise.all(rawItems.map(async (item) => {
      if (item.imagen) return item;
      const imagen = await getOgImage(item.link);
      return { ...item, imagen };
    }));

    return res.status(200).json({ ok: true, noticias: items, timestamp: new Date().toISOString() });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
