// js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// onfiguración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBGIFemXK8kR5ZP6d71HCsDLKgXjTwJVPM",
  authDomain: "v2integradora-ef9ea.firebaseapp.com",
  projectId: "v2integradora-ef9ea",
  storageBucket: "v2integradora-ef9ea.firebasestorage.app",
  messagingSenderId: "117720791449",
  appId: "1:117720791449:web:84b123280737d23e41bb08"
};

// Inicializa Firebase
export const app = initializeApp(firebaseConfig);

// Inicializa Auth
export const auth = getAuth(app);

// Configura persistencia local (la sesión se mantiene hasta logout manual)
export const authReady = setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Persistencia LOCAL activa: la sesión se mantendrá abierta.");
  })
  .catch((error) => {
    console.error("Error configurando persistencia:", error);
  });

// Firestore (base de datos)
export const db = getFirestore(app);
