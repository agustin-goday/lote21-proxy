// api/granos.js — Precios de granos CBOT via BCR (Bolsa de Comercio de Rosario)
// BCR publica futuros CBOT diarios en USD/tonelada — referencia directa para Uruguay

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // BCR API pública — futuros CBOT en USD/tonelada
    const url = "https://www.bcr.com.ar/es/mercados/granos/futuros-y-opciones/pizarra-futuros-del-cbot";
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9",
        "Referer": "https://www.bcr.com.ar/"
      }
    });

    const html = await response.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Intentar parsear tabla BCR: Producto | Posición | Precio | Variación
    const internacional = { soja: [], maiz: [], trigo: [] };
    let fechaActualizacion = null;

    // Buscar fecha
    const fmatch = texto.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (fmatch) fechaActualizacion = fmatch[1];

    // Función extractora de precios por grano
    function extraer(grano, keywords) {
      const idx = texto.search(new RegExp(keywords, 'i'));
      if (idx < 0) return [];
      const bloque = texto.substring(idx, idx + 600);
      // Meses en español
      const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic',
                     'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                     'Septiembre','Octubre','Noviembre','Diciembre'];
      const posRe = new RegExp(`(${meses.join('|')})\\s+(\\d{3,4}[.,]\\d{0,2})`, 'gi');
      const matches = [...bloque.matchAll(posRe)];
      return matches.slice(0, 4).map(m => ({
        posicion: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(),
        precio: m[2].replace(",", ".")
      }));
    }

    internacional.soja  = extraer('soja',  'Soja');
    internacional.maiz  = extraer('maiz',  'Ma[íi]z');
    internacional.trigo = extraer('trigo', 'Trigo');

    // Si BCR no dio resultados, intentar Revista Verde como fallback
    if (!internacional.soja.length && !internacional.maiz.length) {
      const rv = await fetch("https://revistaverde.com.uy/precio-mercado-nacional/", {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
      });
      const rvHtml = await rv.text();
      const rvTexto = rvHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

      const fm2 = rvTexto.match(/Fecha:\s*([\d]+ \w+ \d{4})\s*\|\s*Hora:\s*([\d:]+hs)/i);
      if (fm2) fechaActualizacion = fm2[1] + " " + fm2[2];

      function extraerRV(seccion, grano) {
        const idx = seccion.indexOf(grano);
        if (idx < 0) return [];
        const bloque = seccion.substring(idx, idx + 400);
        const matches = [...bloque.matchAll(/([A-Za-záéíóúÁÉÍÓÚ]+)\s+([\d]+[,.][\d]+)/g)];
        return matches.slice(0, 3).map(m => ({
          posicion: m[1],
          precio: m[2].replace(",", ".")
        }));
      }

      const idxLocal = rvTexto.indexOf("Referencias Locales");
      const seccionIntl  = idxLocal > -1 ? rvTexto.substring(0, idxLocal) : rvTexto;
      internacional.soja  = extraerRV(seccionIntl, "Soja");
      internacional.maiz  = extraerRV(seccionIntl, "Ma");
      internacional.trigo = extraerRV(seccionIntl, "Trigo");
    }

    return res.status(200).json({
      ok: true,
      fechaActualizacion,
      internacional,
      local: {},
      fuente: "BCR / Revista Verde",
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
