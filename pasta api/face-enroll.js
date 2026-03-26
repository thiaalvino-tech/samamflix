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

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido." });
  }

  try {
    const { adminAuth, adminDb } = getAdminServices();

    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Token ausente." });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email || "";

    const { descriptor } = req.body || {};
    const faceDescriptor = toNumericDescriptor(descriptor);

    await adminDb.collection("usuarios").doc(uid).set(
      {
        uid,
        usuarioId: uid,
        email,
        faceDescriptor,
        faceLoginEnabled: true,
        faceRegisteredAt: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      uid
    });
  } catch (error) {
    console.error("[face-enroll] Erro:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro interno ao cadastrar rosto."
    });
  }
}
