// api/granos.js — DEBUG
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = {};

  // Test 1: allorigins + Revista Verde
  try {
    const url = "https://api.allorigins.win/get?url=" + encodeURIComponent("https://revistaverde.com.uy/precio-mercado-nacional/");
    const r = await fetch(url);
    const data = await r.json();
    debug.allorigins_status = r.status;
    debug.allorigins_content_length = (data.contents || "").length;
    debug.allorigins_preview = (data.contents || "").substring(0, 200);
  } catch(e) {
    debug.allorigins_error = e.message;
  }

  // Test 2: fetch directo a Revista Verde
  try {
    const r2 = await fetch("https://revistaverde.com.uy/precio-mercado-nacional/", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    });
    debug.rv_direct_status = r2.status;
    const text = await r2.text();
    debug.rv_direct_length = text.length;
    debug.rv_direct_preview = text.substring(0, 200);
  } catch(e) {
    debug.rv_direct_error = e.message;
  }

  // Test 3: fetch directo a BCR
  try {
    const r3 = await fetch("https://www.bcr.com.ar/es/mercados/granos/futuros-y-opciones/pizarra-futuros-del-cbot", {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
    });
    debug.bcr_status = r3.status;
    const text3 = await r3.text();
    debug.bcr_length = text3.length;
    debug.bcr_has_soja = text3.toLowerCase().includes("soja");
  } catch(e) {
    debug.bcr_error = e.message;
  }

  return res.status(200).json({ ok: true, debug });
}
