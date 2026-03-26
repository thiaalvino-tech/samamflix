import { adminAuth, adminDb } from "./_lib/firebase-admin.js";

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function senhaForte(senha = "") {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(senha);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido." });
  }

  try {
    const { phoneIdToken, newPassword } = req.body || {};

    if (!phoneIdToken || !newPassword) {
      return res.status(400).json({ ok: false, error: "Parâmetros obrigatórios ausentes." });
    }

    if (!senhaForte(newPassword)) {
      return res.status(400).json({
        ok: false,
        error: "A nova senha deve ter 8+ caracteres, com maiúscula, minúscula, número e caractere especial."
      });
    }

    const decoded = await adminAuth.verifyIdToken(phoneIdToken);
    const phoneNumber = normalizePhone(decoded.phone_number || "");

    if (!phoneNumber) {
      return res.status(400).json({ ok: false, error: "Telefone do token não encontrado." });
    }

    const snap = await adminDb
      .collection("usuarios")
      .where("telefoneE164", "==", phoneNumber)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ ok: false, error: "Nenhuma conta vinculada a esse telefone." });
    }

    const doc = snap.docs[0];
    const data = doc.data() || {};
    const targetUid = data.uid || data.usuarioId || doc.id;

    if (!targetUid) {
      return res.status(400).json({ ok: false, error: "UID do usuário de destino não encontrado." });
    }

    await adminAuth.updateUser(targetUid, {
      password: newPassword
    });

    await adminDb.collection("usuarios").doc(doc.id).set(
      {
        telefoneVerificado: true,
        senhaAtualizadaEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      uid: targetUid,
      phoneNumber
    });
  } catch (error) {
    console.error("[reset-password-sms] Erro:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro interno ao redefinir senha por SMS."
    });
  }
}
