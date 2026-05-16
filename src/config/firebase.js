import admin from "firebase-admin";
import { config } from "./config.js";

const serviceAccount = {
  type: "service_account",
  project_id: config.firebase.projectId,
  private_key_id: config.firebase.privateKeyId,
  private_key: config.firebase.privateKey,
  client_email: config.firebase.clientEmail,
  client_id: config.firebase.clientId,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
