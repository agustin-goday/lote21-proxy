// api/remate.js — Próximo remate Lote21
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const html = await fetch("https://www.lote21.uy/vivo/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", "Accept": "text/html" }
    }).then(r => r.text());

    // Número de remate
    const numeroMatch = html.match(/Remate\s+(\d+)/i) || html.match(/Rte_(\d+)/i);
    if (!numeroMatch) throw new Error("No se encontró número de remate");
    const numero = numeroMatch[1];

    const dias = [];

    // Estrategia: buscar cada span con "DIA N:" y tomar el span inmediatamente siguiente
    // Estructura: <span>DIA 1: </span><span>martes, 9 de junio – 09:00</span>
    
    // Buscar bloques "DIA N:" + contenido del span siguiente
    const reDiaSpan = /DIA\s+(\d+)\s*:\s*<\/span>\s*<span[^>]*>([^<]+)/gi;
    const spanMatches = [...html.matchAll(reDiaSpan)];

    if (spanMatches.length > 0) {
      spanMatches.forEach(m => {
        // Decodificar entidades HTML simples
        const desc = m[2]
          .replace(/&#233;/g, 'é').replace(/&#201;/g, 'É')
          .replace(/&#237;/g, 'í').replace(/&#243;/g, 'ó')
          .replace(/&#225;/g, 'á').replace(/&#250;/g, 'ú')
          .replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
          .replace(/&oacute;/g, 'ó').replace(/&aacute;/g, 'á')
          .replace(/[–—]/g, '-')  // normalizar guión largo
          .replace(/\s+/g, ' ')
          .trim();
        if (desc.length > 4) {
          dias.push({
            dia: m[1],
            descripcion: desc.charAt(0).toUpperCase() + desc.slice(1)
          });
        }
      });
    }

    // Fallback: texto limpio con límite estricto por día
    if (dias.length === 0) {
      const textoLimpio = html.replace(/<[^>]+>/g, '\n').replace(/[ \t]+/g, ' ');
      // Buscar líneas que empiecen con "DIA N:" 
      const lineas = textoLimpio.split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lineas.length; i++) {
        const diaMatch = lineas[i].match(/^DIA\s+(\d+)\s*:\s*(.+)?$/i);
        if (diaMatch) {
          let desc = diaMatch[2] || '';
          // Si la descripción está en la línea siguiente
          if (!desc && lineas[i+1] && !/^DIA\s+\d/i.test(lineas[i+1])) {
            desc = lineas[i+1];
          }
          desc = desc
            .replace(/&#233;/g, 'é').replace(/&#237;/g, 'í')
            .replace(/&#243;/g, 'ó').replace(/&#225;/g, 'á')
            .replace(/[–—]/g, '-')
            .replace(/\s+/g, ' ').trim();
          if (desc.length > 4) {
            dias.push({ dia: diaMatch[1], descripcion: desc.charAt(0).toUpperCase() + desc.slice(1) });
          }
        }
      }
    }

    if (dias.length === 0) throw new Error("No se encontraron días");

    return res.status(200).json({
      ok: true, numero, dias,
      proximoRemate: dias[0].descripcion,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, timestamp: new Date().toISOString() });
  }
}
