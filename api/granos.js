// api/granos.js — Precios de granos via Yahoo Finance (CBOT)
// Referencia: ZS=F (Soja), ZC=F (Maíz), ZW=F (Trigo) en USD/bushel → convertir a USD/ton

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Factores de conversión bushel → tonelada
  const CONV = { soja: 36.744, maiz: 39.368, trigo: 36.744 };

  // Símbolos CBOT con posiciones futuras
  // Soja: ZS=F (spot), ZSH25, ZSK25, ZSN25, ZSQ25, ZSX25
  // Maíz: ZC=F (spot), ZCH25, ZCK25, ZCN25
  // Trigo: ZW=F (spot), ZWH25, ZWK25, ZWN25
  const SYMBOLS = {
    soja:  ["ZS=F", "ZSK6.CBT", "ZSN6.CBT", "ZSQ6.CBT", "ZSX6.CBT"],
    maiz:  ["ZC=F", "ZCK6.CBT", "ZCN6.CBT", "ZCU6.CBT"],
    trigo: ["ZW=F", "ZWK6.CBT", "ZWN6.CBT", "ZWU6.CBT"],
  };

  const POSICIONES = {
    "ZS=F": "Spot", "ZSK6.CBT": "Mayo", "ZSN6.CBT": "Julio",
    "ZSQ6.CBT": "Agosto", "ZSX6.CBT": "Noviembre",
    "ZC=F": "Spot", "ZCK6.CBT": "Mayo", "ZCN6.CBT": "Julio", "ZCU6.CBT": "Setiembre",
    "ZW=F": "Spot", "ZWK6.CBT": "Mayo", "ZWN6.CBT": "Julio", "ZWU6.CBT": "Setiembre",
  };

  async function fetchQuote(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
      const r = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
      });
      const data = await r.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      return meta.regularMarketPrice || meta.previousClose || null;
    } catch { return null; }
  }

  function fmt(price, conv) {
    if (!price) return null;
    return (price * conv).toFixed(2);
  }

  try {
    const results = { soja: [], maiz: [], trigo: [] };

    // Fetch en paralelo
    for (const [grano, symbols] of Object.entries(SYMBOLS)) {
      const conv = CONV[grano];
      const prices = await Promise.all(symbols.slice(0, 3).map(s => fetchQuote(s)));
      results[grano] = symbols.slice(0, 3)
        .map((s, i) => ({ symbol: s, posicion: POSICIONES[s] || s, precio_usd_ton: fmt(prices[i], conv) }))
        .filter(x => x.precio_usd_ton);
    }

    // Intentar también Revista Verde como fuente secundaria
    let fechaActualizacion = null;
    let verdeOk = false;
    try {
      const rv = await fetch("https://revistaverde.com.uy/precio-mercado-nacional/", {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
      });
      const html = await rv.text();
      const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const fm = texto.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s*[|\-]\s*([\d:]+\s*hs?)/i)
                || texto.match(/(\d{1,2}\s+\w+\s+\d{4})\s*[|\-]\s*([\d:]+\s*hs?)/i);
      if (fm) {
        fechaActualizacion = fm[1] + " " + fm[2];
        verdeOk = true;
      }

      // Si Revista Verde devuelve precios locales, usarlos
      const idxLocal = texto.indexOf("Referencias Locales");
      if (idxLocal > -1) {
        const local = texto.substring(idxLocal, idxLocal + 500);
        const matches = [...local.matchAll(/(Soja|Ma[íi]z|Trigo)\s+([\d]+[,.]\d+)/g)];
        if (matches.length > 0) {
          const locales = {};
          matches.forEach(m => {
            const g = m[1].toLowerCase().replace("íz","iz").replace("aíz","aiz");
            if (!locales[g]) locales[g] = parseFloat(m[2].replace(",",".")).toFixed(2);
          });
          if (locales.soja)  results.soja.unshift({ posicion: "Local UY", precio_usd_ton: locales.soja, fuente: "RevistaVerde" });
          if (locales.maiz)  results.maiz.unshift({ posicion: "Local UY", precio_usd_ton: locales.maiz, fuente: "RevistaVerde" });
          if (locales.trigo) results.trigo.unshift({ posicion: "Local UY", precio_usd_ton: locales.trigo, fuente: "RevistaVerde" });
        }
      }
    } catch(_) {}

    return res.status(200).json({
      ok: true,
      fechaActualizacion,
      internacional: results,
      local: {},
      fuente: verdeOk ? "CBOT via Yahoo Finance + Revista Verde" : "CBOT via Yahoo Finance",
      nota: "Precios CBOT en USD/tonelada. Referencia para Uruguay.",
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
