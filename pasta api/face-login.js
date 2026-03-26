import { getAdminServices } from "./_lib/firebase-admin.js";

function toNumericDescriptor(descriptor) {
  if (!Array.isArray(descriptor)) {
    throw new Error("Descriptor facial ausente ou inválido.");
  }

  if (descriptor.length !== 128) {
    throw new Error("Descriptor facial inválido. Esperado array com 128 posições.");
  }

  const parsed = descriptor.map((item) => Number(item));

  if (parsed.some((n) => Number.isNaN(n))) {
    throw new Error("Descriptor facial contém valores inválidos.");
  }

  return parsed;
}

function euclideanDistance(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }

  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = Number(a[i]) - Number(b[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido." });
  }

  try {
    const { adminAuth, adminDb } = getAdminServices();

    const { descriptor } = req.body || {};
    const inputDescriptor = toNumericDescriptor(descriptor);

    const snap = await adminDb
      .collection("usuarios")
      .where("faceLoginEnabled", "==", true)
      .get();

    if (snap.empty) {
      return res.status(404).json({
        ok: false,
        error: "Nenhum rosto cadastrado encontrado."
      });
    }

    let bestMatch = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const savedDescriptor = Array.isArray(data.faceDescriptor) ? data.faceDescriptor : null;
      if (!savedDescriptor || savedDescriptor.length !== 128) return;

      const distance = euclideanDistance(inputDescriptor, savedDescriptor);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = {
          uid: data.uid || data.usuarioId || docSnap.id,
          distance
        };
      }
    });

    const THRESHOLD = 0.55;

    if (!bestMatch || bestDistance > THRESHOLD) {
      return res.status(401).json({
        ok: false,
        error: "Rosto não reconhecido."
      });
    }

    const customToken = await adminAuth.createCustomToken(bestMatch.uid);

    return res.status(200).json({
      ok: true,
      uid: bestMatch.uid,
      distance: Number(bestDistance.toFixed(4)),
      customToken
    });
  } catch (error) {
    console.error("[face-login] Erro:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro interno no login facial."
    });
  }
}
