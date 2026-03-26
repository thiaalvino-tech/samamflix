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

    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Token ausente." });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const snap = await adminDb.collection("usuarios").doc(uid).get();

    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "Usuário não encontrado no Firestore." });
    }

    const dados = snap.data() || {};
    const role = dados.role || "user";
    const isAdmin = role === "admin";

    await adminAuth.setCustomUserClaims(uid, {
      admin: isAdmin,
      role
    });

    return res.status(200).json({
      ok: true,
      uid,
      role,
      admin: isAdmin
    });
  } catch (error) {
    console.error("[admin-sync-claims] Erro:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao sincronizar custom claims."
    });
  }
}
