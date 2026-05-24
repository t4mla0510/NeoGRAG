import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCPBKPjaa7NaBVGalJe8hedK7pBgI80lrI",
  authDomain: "rebot-7b5be.firebaseapp.com",
  projectId: "rebot-7b5be",
  storageBucket: "rebot-7b5be.firebasestorage.app",
  messagingSenderId: "549768738039",
  appId: "1:549768738039:web:f3a8f4ac5da03c69410ff2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
