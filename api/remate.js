export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const response = await fetch("https://www.lote21.uy/vivo/", {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" }
  });
  const html = await response.text();

  const numeroMatch = html.match(/Remate\s+(\d+)/i);
  const numero = numeroMatch ? numeroMatch[1] : null;

  const textoLimpio = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const posDia = textoLimpio.indexOf("DIA");
  const fragmento = posDia > -1 ? textoLimpio.substring(posDia - 10, posDia + 400) : "no encontrado";

  return res.status(200).json({
    debug: true,
    numero,
    fragmento,
    timestamp: new Date().toISOString(),
  });
}
