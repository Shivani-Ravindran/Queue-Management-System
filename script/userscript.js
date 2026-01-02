import { db } from "./firebase.js";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  runTransaction,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let qrScanner;
let isScanning = false;

document.addEventListener("DOMContentLoaded", () => {
  //JOIN OVERLAY
  const openBtn = document.querySelector(".primary-btn");
  const overlay = document.querySelector(".overlay");

  openBtn.addEventListener("click", () => {
    overlay.classList.add("active");
  });

  overlay.addEventListener("click", async (e) => {
    if (e.target === overlay) {
      overlay.classList.remove("active");
      await stopScannerIfRunning();

      joinContent.style.display = "block";
      qrScannerDiv.style.display = "none";
      overlay.classList.remove("active");
    }
  });

  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      joinQueue();
      overlay.classList.remove("active");
    }
  });

  document.querySelector(".pop-up").addEventListener("click", (e) => {
    e.stopPropagation();
  });


  
  //QR button
  async function stopScannerIfRunning() {
    if (isScanning) {
      isScanning = false;
      await qrScanner.stop();
    }
  }

  const scanBtn = document.querySelector(".QR-btn");
  const joinContent = document.querySelector(".join-content");
  const qrScannerDiv = document.getElementById("qr-scanner");
  qrScanner = new Html5Qrcode("qr-scanner");

  scanBtn.addEventListener("click", () => {
    if (isScanning) return;

    joinContent.style.display = "none";
    qrScannerDiv.style.display = "block";

    isScanning = true;

    qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        isScanning = false;
        await qrScanner.stop();
        overlay.classList.remove("active");

        const inputValue = decodedText.trim();
        let queueID;
        try {
          const url = new URL(inputValue);
          queueID = url.searchParams.get("queueId") || inputValue;
        } catch (e) {
          queueID = inputValue;
        }

        document.querySelector(".input").value = queueID;

        await joinQueue();
        await qrScanner.clear();
        qrScanner = new Html5Qrcode("qr-scanner");

        joinContent.style.display = "block"; //reset UI
        qrScannerDiv.style.display = "none";
      },
      () => {}
    );
  });



  //HELP OVERLAY
  const openHelpBtn = document.querySelector(".help-btn");
  const helpOverlay = document.querySelector(".overlay-help");
  const closeBtn = document.querySelector(".x-button");

  openHelpBtn.addEventListener("click", () => {
    helpOverlay.classList.add("active");
  });

  closeBtn.addEventListener("click", (e) => {
    helpOverlay.classList.remove("active");
  });

  document.querySelector(".pop-up-help").addEventListener("click", (e) => {
    e.stopPropagation();
  });



  //JS
  document.querySelector(".join-btn").addEventListener("click", () => {
    joinQueue();
    overlay.classList.remove("active");
  });

  const leftContainer = document.querySelector(".left-empty-state");
  leftContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".queue-item");
    if (!btn) return;

    document.querySelectorAll(".queue-item").forEach((item) => {
      item.classList.remove("selected");
    });
    btn.classList.add("selected");

    const queueID = btn.dataset.queueId;
    renderDetails(queueID);
  });

  const rightContainer = document.querySelector(".right-empty-state");
  rightContainer.addEventListener("click", (e) => {
    const btn = e.target.closest(".leave-queue");
    if (!btn) return;

    const queueID = btn.dataset.queueId;
    const memberID = btn.dataset.memberId;
    leaveQueue(queueID, memberID);
  });

  let joinedQueues = JSON.parse(localStorage.getItem("joinedQueues")) || {};
  displayQueues();



  //JOIN QUEUE FUNCTION
  async function joinQueue() {
    const queueID = document.querySelector(".input").value;
    const queueRef = doc(db, "Queues", queueID);
    if (!queueID) {
      alert("Please enter a Queue ID");
      return;
    }
    if (joinedQueues[queueID]) {
      alert("You already joined this queue");
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
          ...(data.Count === 0 && { ServiceStartedAt: serverTimestamp() }),
        });

        transaction.update(queueRef, { Count: data.Count + 1 });
        return {
          memberId: member.id,
          Count: data.Count + 1,
          Buffer: data.Buffer,
          AvgWaitTime: data.AvgWaitTime,
          QueueName: data.QueueName,
        };
      });

      joinedQueues[queueID] = {
        QueueID: queueID,
        Buffer: result.Buffer,
        AvgWaitTime: result.AvgWaitTime,
        QueueName: result.QueueName,
        TokenNumber: result.memberId,
      };
      localStorage.setItem("joinedQueues", JSON.stringify(joinedQueues));
    } catch (err) {
      alert(err);
      console.error(err);
    }
    displayQueues();
    renderDetails(queueID);
  }



  //DISPLAY QUEUE ON LEFT PANEL FUNCTION
  function displayQueues() {
    const queues = Object.values(joinedQueues);
    if (queues.length === 0) {
      renderLeftEmptyState();
      return;
    }
    leftContainer.innerHTML = "";
    queues.forEach((queue) => {
      const queueHTML = `
        <button type="button" class="queue-item" data-queue-id="${queue.QueueID}">
        <p class="queue-name">${queue.QueueName}</p>
        </button>
        `;
      leftContainer.insertAdjacentHTML("beforeend", queueHTML);
    });
  }



  //RENDER DETAILS ON RIGHT PANEL FUNCTION
  let unsubscribeMemberListener = null;
  let unsubscribeQueueListener = null;
  function renderDetails(queueID) {
    if (unsubscribeMemberListener) {
      unsubscribeMemberListener();
      unsubscribeMemberListener = null;
    }
    const queue = joinedQueues[queueID];
    if (!queue) return;

    const queueRef = doc(db, "Queues", queueID);
    let avgWaitTime = 0;
    let lastMemberData = null;

    if (unsubscribeQueueListener) {
      unsubscribeQueueListener();
      unsubscribeQueueListener = null;
    }

    unsubscribeQueueListener = onSnapshot(queueRef, (queueSnap) => {
      if (!queueSnap.exists()) return;
      avgWaitTime = queueSnap.data().AvgWaitTime || 0;

      if (lastMemberData) {
        let WT;
        if (data.Number === 0) {
          WT = "Being served";
        } else if (avgWaitTime === 0) {
          WT = "Estimating...";
        } else {
          WT = (avgWaitTime * data.Number).toFixed(1) + " min"; 
        }

        const ewtEl = document.querySelector(".EWT");
        if (ewtEl) {
          ewtEl.textContent = WT;
        }
      }
    });
    
    const memberRef = doc(db, "Queues", queueID, "Members", queue.TokenNumber);
    let hasExited = false;
    let alertShown = false;
    unsubscribeMemberListener = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.metadata.fromCache && docSnap.exists()) return;
      if (!docSnap.exists()) {
        if (hasExited) return;
        hasExited = true;
        alert("You are no longer in the queue");
        delete joinedQueues[queueID];
        localStorage.setItem("joinedQueues", JSON.stringify(joinedQueues));
        displayQueues();
        renderRightEmptyState();
        return;
      }
      const data = docSnap.data();
      lastMemberData = data;
      const status =
        data.Number > 0 ? "Waiting in queue" : "It's your turn now";
      let WT;
      if (data.Number === 0) {
        WT = "Being served";
      } else if (avgWaitTime === 0) {
        WT = "Estimating...";
      } else {
        WT = (avgWaitTime * data.Number).toFixed(1) + " min"; // 1 decimal place
      }
      rightContainer.innerHTML = `
      <div class="queue-details">
          <p class="your-token-number">Your Token Number</p>
          <p class="token-number">${queue.TokenNumber}</p>
          <p class="queue-position">Position in Queue: ${data.Number + 1}</p>
      </div>
      <div class="flex">
          <div class="buffer-status">
              <p class="current-status">Current Status</p>
              <p class="status-val">${status}</p>
          </div>
          <div class="buffer-status">
              <p class="buffer">Buffer</p>
              <p class="buffer-time">${queue.Buffer} minutes</p>
          </div>
          <div class="buffer-status">
              <p class="ET">Estimated Wait Time</p>
              <p class="EWT">${WT}</p>
          </div>
      </div>
      <button class="leave-queue" data-queue-id="${queueID}" data-member-id="${
        queue.TokenNumber
      }">Leave</button>
      
      <div class="flex-note">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="note-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <p class="note">You will be notified when it is your turn. Please note that you will be moved to end of queue after the specified buffer time</p>
      </div>
      `;
      if (status === "It's your turn now" && !alertShown) {
        alertShown = true;
        alert("It's your turn now");
      }
    });
  }



  //LEAVE QUEUE FUNCTION
  async function leaveQueue(queueID, memberID) {
    const queueRef = doc(db, "Queues", queueID);
    const membersRef = collection(db, "Queues", queueID, "Members");
    const q = query(membersRef, orderBy("Number", "asc"));

    if (unsubscribeMemberListener) {
      unsubscribeMemberListener();
      unsubscribeMemberListener = null;
    }
    if (unsubscribeQueueListener) {
      unsubscribeQueueListener();
      unsubscribeQueueListener = null;
    }
    try {
      await runTransaction(db, async (transaction) => {
        // Read everything first
        const queueSnap = await transaction.get(queueRef);
        if (!queueSnap.exists()) throw new Error("Queue does not exist");

        const memberDocs = await getDocs(q); // read all members
        if (memberDocs.empty) throw new Error("No members in queue");

        // Find leaving member
        const leavingDoc = memberDocs.docs.find(
          (docSnap) => docSnap.id === memberID
        );
        if (!leavingDoc) return;

        const leavingNumber = leavingDoc.data().Number;
        const isFrontLeaving = leavingNumber === 0;

        // Delete leaving member
        const leavingRef = doc(db, "Queues", queueID, "Members", memberID);
        transaction.delete(leavingRef);

        // Renumber remaining members
        memberDocs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.Number > leavingNumber) {
            const newNumber = data.Number - 1;

            const updateData = { Number: newNumber };
            if (isFrontLeaving && newNumber === 0) {
              updateData.ServiceStartedAt = serverTimestamp();
            }

            transaction.update(
              doc(db, "Queues", queueID, "Members", docSnap.id), updateData);
          }
        });

        // Decrement queue count
        const currentCount = queueSnap.data().Count || 0;
        transaction.update(queueRef, { Count: Math.max(currentCount - 1, 0) });
      });

      // Update local state & UI
      delete joinedQueues[queueID];
      localStorage.setItem("joinedQueues", JSON.stringify(joinedQueues));
      displayQueues();

      rightContainer.innerHTML = `
      <div class="empty-state">
            <div class="empty-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="icon-user"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
            </div>
          <h2 class="empty-title">Select a queue to view</h2>
          <p class="empty-text">Choose from the list on the left</p>
      </div>
    `;

      console.log(`Member ${memberID} removed from queue ${queueID}`);
    } catch (err) {
      alert(err);
      console.error(err);
    }
  }

  //EMPTY STATE FUNCTIONS
  function renderRightEmptyState() {
    rightContainer.innerHTML = `
      <div class="empty-state">
            <div class="empty-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="icon-user"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
                />
              </svg>
            </div>
          <h2 class="empty-title">Select a queue to view</h2>
          <p class="empty-text">Choose from the list on the left</p>
      </div>`;
  }

  function renderLeftEmptyState() {
    leftContainer.innerHTML = `
      <div class="empty-icon">
      <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      class="icon-user"
      >
      <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
      </svg>
      </div>
      <div class="empty-title">No queues joined yet</div>
      <div class="empty-text">Click the button above to join one</div>`;
  }
});
