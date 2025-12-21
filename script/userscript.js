import { db } from "./firebase.js";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

//Overlay
const openBtn = document.querySelector(".primary-btn");
const closeBtn = document.querySelector(".closePopup");
const overlay = document.querySelector(".overlay");

openBtn.addEventListener("click", () => {
  overlay.classList.add("active");
});

closeBtn.addEventListener("click", () => {
  overlay.classList.remove("active");
});

// Close when clicking outside popup
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) {
    overlay.classList.remove("active");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".join").addEventListener("click", joinQueue);
});

let joinedQueues = {};
async function joinQueue() {
  const queueID = document.querySelector(".input").value;
  const queueRef = doc(db, "Queues", queueID);
  if (!queueID) {
    alert("Please enter a Queue ID");
    return;
  }

  try {
    const result = await runTransaction(db, async (transaction) => {
      const queueSnap = await transaction.get(queueRef);
      if (!queueSnap.exists()) throw new Error("Queue does not exist");

      const data = queueSnap.data();
      if (data.Status == "Paused") throw new Error("Queue is paused");

      const membersRef = collection(db, "Queues", queueID, "Members");
      const member = doc(membersRef);

      transaction.set(member, {
        Number: data.Count,
        TokenNo: member.id,
        JoinedAt: serverTimestamp(),
      });

      transaction.update(queueRef, { Count: data.Count + 1 });
      return {
        memberId: member.id,
        Count: data.Count + 1,
        Buffer: data.Buffer,
        QueueName: data.QueueName,
      };
    });
    joinedQueues[queueID] = {
      Buffer: result.Buffer,
      Position: result.Count,
      QueueName: result.QueueName,
      TokenNumber: result.memberId,
    };
    console.log(joinedQueues[queueID]);
  } catch (err) {
    alert(err);
    console.error(err);
  }
  console.log("Everything worked");
}
