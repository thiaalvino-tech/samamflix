import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return String(value);
}

function getPrivateKey() {
  const raw = getRequiredEnv("FIREBASE_ADMIN_PRIVATE_KEY");
  return raw.replace(/\\n/g, "\n");
}

function createOrGetAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = getRequiredEnv("FIREBASE_ADMIN_PROJECT_ID");
  const clientEmail = getRequiredEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
  const privateKey = getPrivateKey();

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

export function getAdminServices() {
  const app = createOrGetAdminApp();
  return {
    adminApp: app,
    adminAuth: getAuth(app),
    adminDb: getFirestore(app)
  };
}
