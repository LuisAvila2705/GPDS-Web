const MAX_FILES = 4;
const MAX_MB = 3;
const ALLOWED = ["image/jpeg","image/png","image/webp"];

export async function uploadImages(files) {
  const list = Array.from(files || []);
  if (list.length === 0) return [];
  if (list.length > MAX_FILES) throw new Error(`Máximo ${MAX_FILES} imágenes.`);
  for (const f of list) {
    if (!ALLOWED.includes(f.type)) throw new Error("Formato no permitido (JPG/PNG/WEBP).");
    if (f.size > MAX_MB * 1024 * 1024) throw new Error(`Cada imagen ≤ ${MAX_MB}MB.`);
  }

  // 1) pedir firma al backend
  const sign = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({})
  }).then(r=>r.json());

  if (!sign?.ok) throw new Error("No se pudo firmar la subida.");
  const { cloudName, apiKey, timestamp, signature, folder } = sign;

  // 2) subir una por una a Cloudinary
  const out = [];
  for (const file of list) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", apiKey);
    fd.append("timestamp", timestamp);
    fd.append("signature", signature);
    fd.append("folder", folder);

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const r = await fetch(url, { method: "POST", body: fd }).then(r=>r.json());

    if (!r?.secure_url) throw new Error("Error subiendo a Cloudinary.");
    out.push({
      type: "image",
      url: r.secure_url,
      publicId: r.public_id,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
      format: r.format
    });
  }
  return out;
}

export function thumb(url, { w=400, h=300 } = {}) {
  return url.replace("/upload/", `/upload/c_fill,w_${w},h_${h},f_auto,q_auto/`);
}
