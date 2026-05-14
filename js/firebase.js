import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDG3qjytDNxHHi0f05sKqbMHl-3C2vtNFI",
  authDomain: "dev-projects-97c3c.firebaseapp.com",
  projectId: "dev-projects-97c3c",
  storageBucket: "dev-projects-97c3c.firebasestorage.app",
  messagingSenderId: "693983236964",
  appId: "1:693983236964:web:e8767b69f452fb25d4e071",
  measurementId: "G-CKHF9M21VG"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
// Storage devre dışı bırakıldı.
