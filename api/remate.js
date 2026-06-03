// api/remate.js — Próximo remate + próximos del calendario via panel.lote21.uy
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const html = await fetch("https://www.lote21.uy/vivo/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", "Accept": "text/html" }
    }).then(r => r.text());

    // ── Número de remate actual ──
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
          dias.push({ dia: m[1], descripcion: desc.charAt(0).toUpperCase() + desc.slice(1) });
        }
      });
    }

    if (dias.length === 0) {
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

    // ── Próximos remates desde panel.lote21.uy ──
    let proximos = [];
    try {
      const rematesData = await fetch("https://panel.lote21.uy/json/remates_get.asp", {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", "Accept": "application/json" }
      }).then(r => r.json());

      const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const DIAS_S = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const hoy = new Date();

      // Filtrar: solo portada=1, fecha futura, excluir el actual
      const futuros = rematesData
        .filter(r => String(r.portada) === "1" && String(r.numero) !== numero)
        .map(r => {
          // Parsear fecha1
          const f = r.fecha1 ? String(r.fecha1).trim() : '';
          let fecha = null;
          const mISO = f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          const mDMY = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (mISO) fecha = new Date(+mISO[1], +mISO[2]-1, +mISO[3]);
          else if (mDMY) fecha = new Date(+mDMY[3], +mDMY[2]-1, +mDMY[1]);
          return { ...r, fechaObj: fecha };
        })
        .filter(r => r.fechaObj && r.fechaObj > hoy)
        .sort((a, b) => a.fechaObj - b.fechaObj)
        .slice(0, 3);

      proximos = futuros.map(r => {
        const f = r.fechaObj;
        const diaSem = DIAS_S[f.getDay()];
        const descripcion = diaSem.charAt(0).toUpperCase() + diaSem.slice(1)
          + ' ' + f.getDate() + ' de ' + MESES[f.getMonth()];
        return {
          numero: String(r.numero),
          descripcion,
          nombre: r.nombre || '',
          lugar: r.descripcion || '',
          fecha: r.fecha1
        };
      });
    } catch(e) {
      console.log("Error proximos:", e.message);
    }

    return res.status(200).json({
      ok: true,
      numero,
      dias,
      proximoRemate: dias[0].descripcion,
      proximos,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, timestamp: new Date().toISOString() });
  }
}
