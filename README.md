# Lote21 → agrodemaria.com.uy — Widget automático

Actualiza automáticamente la fecha del próximo remate de Lote21
en el sitio web de agrodemaria.com.uy.

---

## Cómo funciona

```
lote21.uy/vivo/  →  Proxy en Vercel  →  agrodemaria.com.uy
   (fuente)           (este código)        (muestra la fecha)
```

Cada vez que alguien visita agrodemaria, el widget lee el proxy,
que a su vez leyó lote21 (con caché de 1 hora). Sin intervención manual.

---

## PASO 1 — Subir el proxy a Vercel (gratis, 5 minutos)

### Opción A: desde GitHub (recomendada)

1. Crear cuenta gratuita en https://vercel.com
2. Crear cuenta gratuita en https://github.com
3. Crear un repositorio nuevo en GitHub, llamarlo `lote21-proxy`
4. Subir los archivos de esta carpeta (`api/remate.js`, `package.json`, `vercel.json`)
5. En Vercel → "Add New Project" → importar ese repositorio de GitHub
6. Click en "Deploy" — listo en 1 minuto
7. Vercel te dará una URL del estilo: `https://lote21-proxy.vercel.app`

### Opción B: desde la terminal (si tenés Node.js instalado)

```bash
npm install -g vercel
cd lote21-proxy
vercel deploy
```

---

## PASO 2 — Verificar que el proxy funciona

Abrí en el navegador:
```
https://TU-PROYECTO.vercel.app/api/remate
```

Deberías ver algo así:
```json
{
  "ok": true,
  "numero": "248",
  "dias": [
    { "dia": "1", "descripcion": "jueves, 21 de mayo - 09:00" },
    { "dia": "2", "descripcion": "viernes, 22 de mayo - 09:00" }
  ],
  "proximoRemate": "jueves, 21 de mayo - 09:00",
  "timestamp": "2026-05-09T..."
}
```

---

## PASO 3 — Instalar el widget en Joomla

1. Abrí el administrador de Joomla: `agrodemaria.com.uy/administrator`
2. Ir a **Contenido → Artículos** (o al módulo donde está el texto actual del remate)
3. Buscá el artículo que tiene el texto "248° Remate de Lote21..."
4. En el editor, cambiar a vista **HTML/Código fuente** (botón `<>` o "Source")
5. **Reemplazá** el texto actual del remate por el contenido del archivo `widget-joomla.html`
6. En el widget, cambiá `TU-PROYECTO.vercel.app` por tu URL real de Vercel
7. Guardar y publicar

> ⚠️ Joomla a veces filtra JavaScript. Si el editor lo elimina,
> instalá el plugin **"JCE Editor"** (gratuito) que permite HTML/JS completo,
> o usá un módulo de tipo "HTML personalizado".

---

## Mantenimiento

**Ninguno.** El widget se actualiza solo. Vercel es gratis para este uso.

Si Lote21 cambia el diseño de su web y el scraper deja de funcionar,
el widget mostrará un enlace directo a lote21.uy como fallback.

---

## Archivos

```
lote21-proxy/
├── api/
│   └── remate.js          ← El proxy serverless (core del sistema)
├── public/
│   └── widget-joomla.html ← El snippet para pegar en Joomla
├── package.json
├── vercel.json
└── README.md
```
