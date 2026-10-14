// api/granos.js — Precios de granos via allorigins proxy
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(200).end();

  async function fetchViaProxy(targetUrl) {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const r = await fetch(proxyUrl, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    });
    const data = await r.json();
    return data.contents || "";
  }

  function extraerPrecios(texto, grano) {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                   'Septiembre','Setiembre','Octubre','Noviembre','Diciembre',
                   'Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Set','Oct','Nov','Dic'];
    const idx = texto.search(new RegExp(grano, 'i'));
    if (idx < 0) return [];
    const bloque = texto.substring(idx, idx + 500);
    const posRe = new RegExp(`(${meses.join('|')})\\s*[\\d]{0,2}\\s+(\\d{2,4}[.,]\\d{1,2})`, 'gi');
    const matches = [...bloque.matchAll(posRe)];
    return matches.slice(0, 4).map(m => ({
      posicion: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(),
      precio: parseFloat(m[2].replace(",", ".")).toFixed(2)
    }));
  }

  const internacional = { soja: [], maiz: [], trigo: [] };
  let fechaActualizacion = null;
  let fuente = "";

  // Intentar Revista Verde
  try {
    const html = await fetchViaProxy("https://revistaverde.com.uy/precio-mercado-nacional/");
    if (html && html.length > 500) {
      const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      
      const fm = texto.match(/Fecha:\s*([\d]+\s+\w+\s+\d{4})\s*\|\s*Hora:\s*([\d:]+\s*hs)/i)
              || texto.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
      if (fm) fechaActualizacion = fm[1] + (fm[2] ? " " + fm[2] : "");

      const idxLocal = texto.indexOf("Referencias Locales");
      const seccionIntl = idxLocal > -1 ? texto.substring(0, idxLocal) : texto;
      const seccionLocal = idxLocal > -1 ? texto.substring(idxLocal) : "";

      function extraerRV(seccion, keyword) {
        const idx = seccion.indexOf(keyword);
        if (idx < 0) return [];
        const bloque = seccion.substring(idx, idx + 400);
        const matches = [...bloque.matchAll(/([A-Za-záéíóúÁÉÍÓÚ]+)\s+([\d]+[,.][\d]+)/g)];
        return matches.slice(0, 4).map(m => ({
          posicion: m[1],
          precio: m[2].replace(",", ".")
        }));
      }

      internacional.soja  = extraerRV(seccionIntl, "Soja");
      internacional.maiz  = extraerRV(seccionIntl, "Ma");
      internacional.trigo = extraerRV(seccionIntl, "Trigo");

      if (internacional.soja.length || internacional.maiz.length) {
        fuente = "Revista Verde";
      }

      // Precios locales
      if (seccionLocal) {
        const local = {};
        const ls = extraerRV(seccionLocal, "Soja");
        const lm = extraerRV(seccionLocal, "Ma");
        const lt = extraerRV(seccionLocal, "Trigo");
        if (ls.length) local.soja = ls;
        if (lm.length) local.maiz = lm;
        if (lt.length) local.trigo = lt;
        if (Object.keys(local).length) {
          return res.status(200).json({
            ok: true, fechaActualizacion, internacional, local, fuente, timestamp: new Date().toISOString()
          });
        }
      }
    }
  } catch(e) {}

  // Fallback: BCR
  if (!internacional.soja.length) {
    try {
      const html = await fetchViaProxy("https://www.bcr.com.ar/es/mercados/granos/futuros-y-opciones/pizarra-futuros-del-cbot");
      if (html && html.length > 500) {
        const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        internacional.soja  = extraerPrecios(texto, "Soja");
        internacional.maiz  = extraerPrecios(texto, "Ma[íi]z");
        internacional.trigo = extraerPrecios(texto, "Trigo");
        if (internacional.soja.length) fuente = "BCR";
      }
    } catch(e) {}
  }

  return res.status(200).json({
    ok: true, fechaActualizacion, internacional, local: {}, fuente: fuente || "sin datos",
    timestamp: new Date().toISOString()
  });
}
