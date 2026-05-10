// api/precios.js — Precios ACG con login para obtener semana anterior

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");

  if (req.method === "OPTIONS") return res.status(200).end();

  function extraer(texto, patron) {
    const m = texto.match(patron);
    return m ? m[1].replace(",", ".") : null;
  }

  function extraerTodos(texto, patron) {
    return [...texto.matchAll(patron)].map(m => m[1].replace(",", "."));
  }

  try {
    // ── 1. Obtener valores actuales desde el home (público) ──
    const homeRes = await fetch("https://acg.com.uy/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    const homeHtml = await homeRes.text();
    const homeTexto = homeHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const semanaMatch = homeTexto.match(/semana\s+N[°º]\s*(\d+)/i);
    const semana = semanaMatch ? semanaMatch[1] : null;

    const novillo    = extraer(homeTexto, /Novillo[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaca       = extraer(homeTexto, /Vaca[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaquillona = extraer(homeTexto, /Vaquillona[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const ternero       = extraer(homeTexto, /Ternero[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const ternera       = extraer(homeTexto, /Ternera[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const vacaInvernada = extraer(homeTexto, /Vaca de Invernada[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);

    // Faena
    const bovinos    = extraer(homeTexto, /Faena semanal\s*([\d.,]+)\s*vacunos/i);
    const bovinosAnt = extraer(homeTexto, /vacunos\s*([\d.,]+)\s*semana anterior/i);
    const ovinos     = extraer(homeTexto, /Faena semanal[\s\S]{0,300}?([\d.,]+)\s*ovinos/i);
    const ovinosAnt  = extraer(homeTexto, /ovinos\s*([\d.,]+)\s*semana anterior/i);

    // ── 2. Login en ACG para obtener semana anterior ──
    let novilloAnt = null, vacaAnt = null, vaquillonaAnt = null;

    const ACG_USER = process.env.ACG_USER;
    const ACG_PASS = process.env.ACG_PASS;

    if (ACG_USER && ACG_PASS) {
      try {
        // Obtener nonce/token del formulario de login
        const loginPageRes = await fetch("https://acg.com.uy/iniciar-sesion/", {
          headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
        });
        const loginPageHtml = await loginPageRes.text();
        const cookies = loginPageRes.headers.get("set-cookie") || "";

        // Extraer nonce de WordPress
        const nonceMatch = loginPageHtml.match(/name="woocommerce-login-nonce"\s+value="([^"]+)"/);
        const nonce = nonceMatch ? nonceMatch[1] : "";
        const refMatch = loginPageHtml.match(/name="_wp_http_referer"\s+value="([^"]+)"/);
        const wpRef = refMatch ? refMatch[1] : "/iniciar-sesion/";

        // Hacer login
        const loginBody = new URLSearchParams({
          username: ACG_USER,
          password: ACG_PASS,
          "woocommerce-login-nonce": nonce,
          "_wp_http_referer": wpRef,
          login: "Acceder",
        });

        const loginRes = await fetch("https://acg.com.uy/iniciar-sesion/", {
          method: "POST",
          headers: {
            "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": cookies,
            "Referer": "https://acg.com.uy/iniciar-sesion/",
          },
          body: loginBody.toString(),
          redirect: "manual",
        });

        // Recoger cookies de sesión
        const sessionCookies = [cookies, loginRes.headers.get("set-cookie") || ""]
          .filter(Boolean).join("; ");

        // Acceder a la página de ganado gordo con sesión
        const gordoRes = await fetch("https://acg.com.uy/ganado-gordo/", {
          headers: {
            "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
            "Cookie": sessionCookies,
          },
        });
        const gordoHtml = await gordoRes.text();
        const gordoTexto = gordoHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

        // En la página de ganado gordo logueado aparecen semana actual y anterior
        // Extraer todos los valores de novillo, vaca, vaquillona (actual + anterior)
        const novillos    = extraerTodos(gordoTexto, /Novillo[\s\S]{0,100}?([\d]+[.,][\d]+)\s*D[oó]lares por kilo en cuarta balanza/gi);
        const vacas       = extraerTodos(gordoTexto, /Vaca[^V][\s\S]{0,100}?([\d]+[.,][\d]+)\s*D[oó]lares por kilo en cuarta balanza/gi);
        const vaquillonas = extraerTodos(gordoTexto, /Vaquillona[\s\S]{0,100}?([\d]+[.,][\d]+)\s*D[oó]lares por kilo en cuarta balanza/gi);

        // El segundo valor es la semana anterior
        novilloAnt    = novillos[1]    || null;
        vacaAnt       = vacas[1]       || null;
        vaquillonaAnt = vaquillonas[1] || null;

      } catch (loginErr) {
        // Si falla el login, continuar sin valores anteriores
        console.error("Login ACG failed:", loginErr.message);
      }
    }

    return res.status(200).json({
      ok: true,
      semana,
      gordos: {
        novillo,    novilloAnt,
        vaca,       vacaAnt,
        vaquillona, vaquillonaAnt,
      },
      reposicion: { ternero, ternera, vacaInvernada },
      faena: {
        bovinos:    bovinos    ? bovinos.replace(/\./g,"")    : null,
        bovinosAnt: bovinosAnt ? bovinosAnt.replace(/\./g,"") : null,
        ovinos:     ovinos     ? ovinos.replace(/\./g,"")     : null,
        ovinosAnt:  ovinosAnt  ? ovinosAnt.replace(/\./g,"")  : null,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
