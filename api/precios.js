// api/precios.js — login via wp-login.php

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
    // Valores actuales desde home
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

    const ACG_USER = process.env.ACG_USER;
    const ACG_PASS = process.env.ACG_PASS;
    const debug = { hasUser: !!ACG_USER, hasPass: !!ACG_PASS };

    let novilloAnt = null, vacaAnt = null, vaquillonaAnt = null;

    if (ACG_USER && ACG_PASS) {
      try {
        // Obtener nonce desde wp-login.php (WordPress nativo)
        const wpLoginPageRes = await fetch("https://acg.com.uy/wp-login.php", {
          headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
        });
        const wpLoginHtml = await wpLoginPageRes.text();
        const initCookies = wpLoginPageRes.headers.get("set-cookie") || "";
        debug.wpLoginStatus = wpLoginPageRes.status;

        // Extraer nonce de wp-login
        const nonceMatch = wpLoginHtml.match(/name="testcookie"\s+value="([^"]*)"/);
        debug.wpNonce = !!nonceMatch;

        // POST a wp-login.php
        const wpLoginBody = new URLSearchParams({
          log: ACG_USER,
          pwd: ACG_PASS,
          "wp-submit": "Acceder",
          redirect_to: "https://acg.com.uy/ganado-gordo/",
          testcookie: "1",
        });

        const wpLoginRes = await fetch("https://acg.com.uy/wp-login.php", {
          method: "POST",
          headers: {
            "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": initCookies + "; wordpress_test_cookie=WP+Cookie+check",
            "Referer": "https://acg.com.uy/wp-login.php",
          },
          body: wpLoginBody.toString(),
          redirect: "manual",
        });

        debug.wpLoginPostStatus = wpLoginRes.status;
        debug.wpLoginLocation = wpLoginRes.headers.get("location") || "no redirect";

        const sessionCookies = [initCookies, wpLoginRes.headers.get("set-cookie") || ""]
          .filter(Boolean).join("; ");
        debug.sessionCookieLen = sessionCookies.length;

        // Acceder a ganado gordo con la sesión de WordPress
        const gordoRes = await fetch("https://acg.com.uy/ganado-gordo/", {
          headers: {
            "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0",
            "Cookie": sessionCookies,
            "Referer": "https://acg.com.uy/",
          },
          redirect: "follow",
        });

        debug.gordoStatus = gordoRes.status;
        const gordoHtml = await gordoRes.text();
        const gordoTexto = gordoHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

        debug.hasPremiumContent = gordoTexto.includes("cuarta balanza");
        debug.hasLoginRequired  = gordoTexto.includes("suscripción premium");

        if (debug.hasPremiumContent && !debug.hasLoginRequired) {
          // Extraer todos los precios — buscar pares actual/anterior
          const allVals = [...gordoTexto.matchAll(/([\d]+[.,][\d]+)\s*D[oó]lares por kilo en cuarta balanza/gi)];
          debug.allVals = allVals.map(m => m[1]);

          // Buscar "semana anterior" explícitamente
          const semAntIdx = gordoTexto.indexOf("Semana anterior");
          if (semAntIdx > -1) {
            const afterAnt = gordoTexto.substring(semAntIdx, semAntIdx + 500);
            const valsAnt = [...afterAnt.matchAll(/([\d]+[.,][\d]+)/g)].map(m => m[1].replace(",","."));
            novilloAnt    = valsAnt[0] || null;
            vacaAnt       = valsAnt[1] || null;
            vaquillonaAnt = valsAnt[2] || null;
          }
        }

      } catch(e) {
        debug.error = e.message;
      }
    }

    return res.status(200).json({
      ok: true, semana,
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
