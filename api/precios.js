// api/precios.js — Precios ACG con faena y semana anterior

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
        Accept: "text/html",
      },
    });

    const html = await response.text();
    const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    // Número de semana
    const semanaMatch = texto.match(/semana\s+N[°º]\s*(\d+)/i);
    const semana = semanaMatch ? semanaMatch[1] : null;

    // Ganado gordo
    const novillo    = extraer(texto, /Novillo[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaca       = extraer(texto, /Vaca[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaquillona = extraer(texto, /Vaquillona[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);

    // Reposición
    const ternero       = extraer(texto, /Ternero[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const ternera       = extraer(texto, /Ternera[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const vacaInvernada = extraer(texto, /Vaca de Invernada[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);

    // Faena semanal
    const bovinos = extraer(texto, /Faena semanal\s*([\d.,]+)\s*vacunos/i);
    const bovinosAnt = extraer(texto, /vacunos\s*([\d.,]+)\s*semana anterior/i);
    const ovinos  = extraer(texto, /Faena semanal[\s\S]{0,200}?([\d.,]+)\s*ovinos/i);
    const ovinosAnt = extraer(texto, /ovinos\s*([\d.,]+)\s*semana anterior/i);

    return res.status(200).json({
      ok: true,
      semana,
      gordos: { novillo, vaca, vaquillona },
      reposicion: { ternero, ternera, vacaInvernada },
      faena: {
        bovinos: bovinos ? bovinos.replace(".", "") : null,
        bovinosAnt: bovinosAnt ? bovinosAnt.replace(".", "") : null,
        ovinos:  ovinos  ? ovinos.replace(".", "")  : null,
        ovinosAnt: ovinosAnt ? ovinosAnt.replace(".", "") : null,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
