// script/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCK783Fd-EV7HT_60Z2e4srnSJwSvaTj4s",
  authDomain: "queue-management-3d9cd.firebaseapp.com",
  projectId: "queue-management-3d9cd",
  storageBucket: "queue-management-3d9cd.appspot.com",
  messagingSenderId: "194012295754",
  appId: "1:194012295754:web:b11719c702f4aa95746cb3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Initialize Firestore
export const db = getFirestore(app);
