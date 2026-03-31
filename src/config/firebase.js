import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAokxdJX-47uXEe4tzYj6Vb0dYjp3Mdig0",
  authDomain: "meal-planer-d8184.firebaseapp.com",
  databaseURL: "https://meal-planer-d8184-default-rtdb.firebaseio.com",
  projectId: "meal-planer-d8184",
  storageBucket: "meal-planer-d8184.firebasestorage.app",
  messagingSenderId: "6386360698",
  appId: "1:6386360698:web:c14bedf626edd9238d76c3",
  measurementId: "G-1N2C9WHHDE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
