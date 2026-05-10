// api/precios.js — con debug de login ACG

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();

  function extraer(texto, patron) {
    const m = texto.match(patron);
    return m ? m[1].replace(",", ".") : null;
  }

  try {
    // Valores actuales desde home (público)
    const homeRes = await fetch("https://acg.com.uy/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0", Accept: "text/html" },
    });
    const homeHtml = await homeRes.text();
    const homeTexto = homeHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    const semana     = homeTexto.match(/semana\s+N[°º]\s*(\d+)/i)?.[1] || null;
    const novillo    = extraer(homeTexto, /Novillo[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaca       = extraer(homeTexto, /Vaca[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const vaquillona = extraer(homeTexto, /Vaquillona[\s\S]{0,300}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
    const ternero       = extraer(homeTexto, /Ternero[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const ternera       = extraer(homeTexto, /Ternera[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const vacaInvernada = extraer(homeTexto, /Vaca de Invernada[\s\S]{0,200}?([\d,]+)\s*D[oó]lares por kilo en pie/i);
    const bovinos    = extraer(homeTexto, /Faena semanal\s*([\d.,]+)\s*vacunos/i);
    const bovinosAnt = extraer(homeTexto, /vacunos\s*([\d.,]+)\s*semana anterior/i);
    const ovinos     = extraer(homeTexto, /Faena semanal[\s\S]{0,300}?([\d.,]+)\s*ovinos/i);
    const ovinosAnt  = extraer(homeTexto, /ovinos\s*([\d.,]+)\s*semana anterior/i);

    // Debug login
    const ACG_USER = process.env.ACG_USER;
    const ACG_PASS = process.env.ACG_PASS;
    const debug = { hasUser: !!ACG_USER, hasPass: !!ACG_PASS };

    let novilloAnt = null, vacaAnt = null, vaquillonaAnt = null;

    if (ACG_USER && ACG_PASS) {
      try {
        // Paso 1: obtener página de login y cookies iniciales
        const loginPageRes = await fetch("https://acg.com.uy/iniciar-sesion/", {
          headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
          redirect: "follow",
        });
        const loginPageHtml = await loginPageRes.text();
        const initCookies = loginPageRes.headers.get("set-cookie") || "";
        debug.loginPageStatus = loginPageRes.status;

        // Extraer nonce
        const nonceMatch = loginPageHtml.match(/name="woocommerce-login-nonce"\s+value="([^"]+)"/);
        const nonce = nonceMatch ? nonceMatch[1] : "";
        debug.nonceFound = !!nonce;

        // Paso 2: POST login
        const loginBody = new URLSearchParams({
          username: ACG_USER,
          password: ACG_PASS,
          "woocommerce-login-nonce": nonce,
          "_wp_http_referer": "/iniciar-sesion/",
          login: "Acceder",
        });

        const loginRes = await fetch("https://acg.com.uy/iniciar-sesion/", {
          method: "POST",
          headers: {
            "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": initCookies,
            "Referer": "https://acg.com.uy/iniciar-sesion/",
          },
          body: loginBody.toString(),
          redirect: "manual",
        });

        debug.loginStatus = loginRes.status;
        debug.loginLocation = loginRes.headers.get("location") || "no redirect";

        // Recoger cookies de sesión
        const loginCookies = loginRes.headers.get("set-cookie") || "";
        const allCookies = [initCookies, loginCookies].filter(Boolean).join("; ");
        debug.hasCookies = allCookies.length > 50;

        // Paso 3: acceder a ganado gordo con sesión
        const gordoRes = await fetch("https://acg.com.uy/ganado-gordo/", {
          headers: {
            "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
            "Cookie": allCookies,
            "Referer": "https://acg.com.uy/",
          },
          redirect: "follow",
        });

        debug.gordoStatus = gordoRes.status;
        const gordoHtml = await gordoRes.text();
        const gordoTexto = gordoHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

        // Ver si hay contenido premium (buscar palabra clave)
        debug.hasPremiumContent = gordoTexto.includes("cuarta balanza");
        debug.hasLoginRequired = gordoTexto.includes("suscripción premium") || gordoTexto.includes("registrarte");

        if (debug.hasPremiumContent) {
          // Extraer todos los valores — el primero es actual, el segundo es anterior
          const allNovillos = [...gordoTexto.matchAll(/(\d+[.,]\d+)\s*D[oó]lares por kilo en cuarta balanza/gi)];
          debug.allValues = allNovillos.map(m => m[1]);

          // Buscar específicamente "Semana anterior"
          const antMatch = gordoTexto.match(/Semana anterior[\s\S]{0,50}?([\d,]+)\s*D[oó]lares por kilo en cuarta balanza/i);
          if (antMatch) {
            novilloAnt = antMatch[1].replace(",",".");
          }
        }

      } catch (e) {
        debug.loginError = e.message;
      }
    }

    return res.status(200).json({
      ok: true,
      semana,
      gordos: { novillo, novilloAnt, vaca, vacaAnt, vaquillona, vaquillonaAnt },
      reposicion: { ternero, ternera, vacaInvernada },
      faena: {
        bovinos: bovinos?.replace(/\./g,"") || null,
        bovinosAnt: bovinosAnt?.replace(/\./g,"") || null,
        ovinos: ovinos?.replace(/\./g,"") || null,
        ovinosAnt: ovinosAnt?.replace(/\./g,"") || null,
      },
      debug,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
