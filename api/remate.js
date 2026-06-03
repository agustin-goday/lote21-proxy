// api/remate.js — Próximo remate + próximos del calendario Lote21
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const html = await fetch("https://www.lote21.uy/vivo/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", "Accept": "text/html" }
    }).then(r => r.text());

    // ── Número de remate ──
    const numeroMatch = html.match(/Remate\s+(\d+)/i) || html.match(/Rte_(\d+)/i);
    if (!numeroMatch) throw new Error("No se encontró número de remate");
    const numero = numeroMatch[1];

    // ── Días del próximo remate ──
    const dias = [];
    const reDiaSpan = /DIA\s+(\d+)\s*:\s*<\/span>\s*<span[^>]*>([^<]+)/gi;
    const spanMatches = [...html.matchAll(reDiaSpan)];

    if (spanMatches.length > 0) {
      spanMatches.forEach(m => {
        const desc = m[2]
          .replace(/&#233;/g, 'é').replace(/&#237;/g, 'í')
          .replace(/&#243;/g, 'ó').replace(/&#225;/g, 'á')
          .replace(/&#250;/g, 'ú').replace(/&eacute;/g, 'é')
          .replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
        if (desc.length > 4) {
          dias.push({
            dia: m[1],
            descripcion: desc.charAt(0).toUpperCase() + desc.slice(1)
          });
        }
      });
    }

    if (dias.length === 0) {
      // Fallback texto limpio
      const textoLimpio = html.replace(/<[^>]+>/g, '\n').replace(/[ \t]+/g, ' ');
      const lineas = textoLimpio.split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lineas.length; i++) {
        const diaMatch = lineas[i].match(/^DIA\s+(\d+)\s*:\s*(.+)?$/i);
        if (diaMatch) {
          let desc = diaMatch[2] || (lineas[i+1] && !/^DIA\s+\d/i.test(lineas[i+1]) ? lineas[i+1] : '');
          desc = desc.replace(/&#233;/g, 'é').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
          if (desc.length > 4) dias.push({ dia: diaMatch[1], descripcion: desc.charAt(0).toUpperCase() + desc.slice(1) });
        }
      }
    }

    if (dias.length === 0) throw new Error("No se encontraron días");

    // ── Próximos remates del calendario ──
    const proximos = [];
    const mesesNombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const diasSemana = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const anio = new Date().getFullYear();

    // Extraer bloques por mes del calendario
    const calRe = /<h3>([A-Za-záéíóúüñ]+)<\/h3>([\s\S]*?)(?=<h3>|<div class="fecha-proximo|$)/gi;
    const calBlocks = [...html.matchAll(calRe)];

    calBlocks.forEach(block => {
      const mesNombre = block[1].toLowerCase();
      const mesIdx = mesesNombres.indexOf(mesNombre);
      if (mesIdx < 0) return;

      // Buscar highlights con tooltip-calendar
      const highlightRe = /<span>(\d+)<\/span>[\s\S]*?tooltip-calendar"[^>]*title="([^"]*)"[\s\S]*?href="([^"]*)"/gi;
      const highlights = [...block[2].matchAll(highlightRe)];

      highlights.forEach(h => {
        const dia = parseInt(h[1]);
        const titulo = h[2].trim();
        const href = h[3];
        const numMatch = href.match(/r=(\d+)/);
        if (!numMatch) return;
        const numR = numMatch[1];

        const fecha = new Date(anio, mesIdx, dia);
        const diaSem = diasSemana[fecha.getDay()];
        const descripcion = diaSem.charAt(0).toUpperCase() + diaSem.slice(1) + ' ' + dia + ' de ' + mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);

        proximos.push({
          numero: numR,
          titulo,
          fecha: `${anio}-${String(mesIdx+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`,
          descripcion
        });
      });
    });

    // Ordenar, deduplicar, excluir el actual
    proximos.sort((a,b) => a.fecha.localeCompare(b.fecha));
    const vistos = new Set([numero]);
    const proximosUnicos = proximos.filter(r => {
      if (vistos.has(r.numero)) return false;
      vistos.add(r.numero);
      return true;
    }).slice(0, 5);

    return res.status(200).json({
      ok: true,
      numero,
      dias,
      proximoRemate: dias[0].descripcion,
      proximos: proximosUnicos,  // ← nuevos: próximos del calendario
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, timestamp: new Date().toISOString() });
  }
}
