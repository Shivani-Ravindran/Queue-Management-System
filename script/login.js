import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

const btn = document.getElementById("googleLoginBtn");

btn.addEventListener("click", async () => {
  try {

    const result = await signInWithPopup(auth, provider);

    const user = result.user;

    localStorage.setItem("adminUID", user.uid);
    localStorage.setItem("adminEmail", user.email);

    alert("Login success");
    window.location.href = "admin.html";
  } catch (err) {
    console.error(err);
    alert(err.code + " : " + err.message);
  }
});