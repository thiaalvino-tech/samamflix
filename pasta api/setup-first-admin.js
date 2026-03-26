import { getAdminServices } from "./_lib/firebase-admin.js";

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

    const bootstrapSecret = process.env.SETUP_ADMIN_SECRET;
    if (!bootstrapSecret) {
      return res.status(500).json({
        ok: false,
        error: "SETUP_ADMIN_SECRET não configurado na Vercel."
      });
    }

    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Token ausente." });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email || "";

    const body = req.body || {};
    const secret = String(body.secret || "").trim();

    if (!secret) {
      return res.status(400).json({ ok: false, error: "Segredo não informado." });
    }

    if (secret !== bootstrapSecret) {
      return res.status(403).json({ ok: false, error: "Segredo inválido." });
    }

    const usuarioRef = adminDb.collection("usuarios").doc(uid);
    const usuarioSnap = await usuarioRef.get();
    const dadosAtuais = usuarioSnap.exists ? (usuarioSnap.data() || {}) : {};

    await usuarioRef.set(
      {
        uid,
        usuarioId: uid,
        email,
        role: "admin",
        atualizadoEm: new Date().toISOString()
      },
      { merge: true }
    );

    await adminAuth.setCustomUserClaims(uid, {
      admin: true,
      role: "admin"
    });

    return res.status(200).json({
      ok: true,
      uid,
      role: "admin",
      email,
      previousRole: dadosAtuais.role || "user"
    });
  } catch (error) {
    console.error("[setup-first-admin] Erro:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro interno ao configurar o primeiro admin."
    });
  }
}
