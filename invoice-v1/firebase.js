// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔴 এখানে আপনার নিজের Firebase config বসান
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCUW69PP3zxgUb3r2zWjXti6nYiWRm0L_4",
  authDomain: "invoice-77f44.firebaseapp.com",
  projectId: "invoice-77f44",
  storageBucket: "invoice-77f44.firebasestorage.app",
  messagingSenderId: "790061488061",
  appId: "1:790061488061:web:da582bd2bbe04c4c92a4d4",
  measurementId: "G-XKBVX8SN8B"
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
