import QRCode from "https://esm.sh/qrcode@1.5.4";
import { db } from "./firebase.js";
import {
  query,
  orderBy,
  limit,
  where,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

let isSwapEnabled = false;
let activeServingUserId = null;


document.addEventListener("DOMContentLoaded", () => {

  const openBtn = document.querySelector(".primary-btn");
  const closeBtn = document.querySelector(".closePopup");
  const overlay = document.querySelector(".overlay");
  const createBtn = document.querySelector("#createQueueBtn");

const queueNameInput = document.querySelectorAll(".input")[0];
const bufferTimeInput = document.querySelectorAll(".input")[1];


  const queueList = document.querySelector("#queueList");
  const leftEmptyState = document.querySelector("#leftEmpty");
  const rightPanel = document.querySelector("#rightPanel");

  let selectedQueueId = null;
  let unsubscribeMembers = null;

  let autoServeTimer = null;
  const queueBufferMap = {};
  let currentAdminName = null;

  currentAdminName = localStorage.getItem("adminName");

if (!currentAdminName) {
  alert("Admin not logged in");
  window.location.href = "login.html";
  return;
}


  loadQueues();
  showRightEmpty();

  openBtn.onclick = () => overlay.classList.add("active");
  closeBtn.onclick = closeOverlay;
  overlay.onclick = (e) => e.target === overlay && closeOverlay();

  function closeOverlay() {
  overlay.classList.remove("active");
  queueNameInput.value = "";
  bufferTimeInput.value = "";
}



  createBtn.onclick = async () => {
const AdminName = currentAdminName;
const QueueName = queueNameInput.value.trim();
const Buffer = Number(bufferTimeInput.value.trim());

if (!QueueName || !Buffer) {
  alert("Fill all fields");
  return;
}

  const docRef = await addDoc(collection(db, "Queues"), {
  AdminName,
  QueueName,
  Buffer,
  Count: 0,
  Status: "Active"
});


const queueId = docRef.id;

const joinUrl = `${window.location.origin}/join.html?queueId=${queueId}`;
const qrDataUrl = await QRCode.toDataURL(joinUrl);


await updateDoc(docRef, {
  QRCode: qrDataUrl
});


    setTimeout(() => {
    closeOverlay();
    loadQueues();
    }, 300);
  };


  async function loadQueues() {
  queueList.innerHTML = "";


  const q = query(
    collection(db, "Queues"),
    where("AdminName", "==", currentAdminName)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    leftEmptyState.style.display = "flex";
    return;
  }

  leftEmptyState.style.display = "none";

  snapshot.forEach(docSnap => {
    const q = docSnap.data();
    addQueueCard({
      Id: docSnap.id,
      QueueName: q.QueueName,
      Buffer: q.Buffer,
      Status: q.Status,
      QRCode: q.QRCode
    });
  });
}



  function addQueueCard(queue) {
    const card = document.createElement("div");
    card.className = "queue-card";

    card.innerHTML = `
      <div class="queue-Name">${queue.QueueName}</div>
      <div class="queue-Id">ID: ${queue.Id}</div>
      <div class="queue-Buffer">Buffer: ${queue.Buffer} min</div>
    `;

    card.onclick = () => {
      document.querySelectorAll(".queue-card")
      .forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");

      showQueueDetails(queue);
    };

    queueList.appendChild(card);
  }

 

  function showQueueDetails(queue) {
    const savedSwap = localStorage.getItem(`swap_${queue.Id}`);
    isSwapEnabled = savedSwap !== "false";
    selectedQueueId = queue.Id;
    activeServingUserId = null;
    queueBufferMap[queue.Id] = queue.Buffer;
    rightPanel.innerHTML = `
    
      <h1 class="selected-q">Currently Selected Queue</h1>
      <br><br><br>
      <div class="details">
  <div class="details-left">
    <p><strong>Queue Name:</strong> ${queue.QueueName}</p>
    <p><strong>Queue ID:</strong> ${queue.Id}</p>
    <p><strong>Buffer Time:</strong> ${queue.Buffer} minutes</p>
    <p><strong>Status:</strong> <span id="queueStatus">${queue.Status}</span></p>
  </div>

  <div class="details-right">
  ${queue.QRCode
    ? `
      <img src="${queue.QRCode}" class="queue-qr" />
      <button class="download-qr-btn">Download QR</button>
    `
    : `<p class="qr-missing">QR not available</p>`
  }
  <p class="qr-text">Scan to join queue</p>
</div>

</div>


      <br><br><br>
      <h2 class="control">Queue Controls</h2>
      <br><br><br>
      
      <div class="controls">
        <button id="deleteQueueBtn" class="join-btn delete-btn">Delete</button>
        <button id="toggleStatusBtn" class="join-btn">${queue.Status === "Active" ? "Pause" : "Resume"}</button>
        <button id="serveBtn" class="join-btn">Serve</button>
        <button id="stopSwapBtn" class="join-btn">Stop Swap</button>
      </div>


      <br><br><br>
      <h2 class="control">Queue Order</h2>
      <br><br><br>
      <div id="queueUsersPanel"></div>
    `;
    const downloadBtn = rightPanel.querySelector(".download-qr-btn");

if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = queue.QRCode;
    link.download = `${queue.QueueName}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}
    document.querySelector("#deleteQueueBtn").onclick = deleteQueue;
    document.querySelector("#toggleStatusBtn").onclick = () => toggleQueueStatus(queue);
    document.querySelector("#serveBtn").onclick = () => serveNext(queue.Id);
    document.querySelector("#stopSwapBtn").onclick = () => {
    isSwapEnabled = false;
    localStorage.setItem(`swap_${queue.Id}`, "false");
    clearAutoServeTimer();
    alert("You have stopped swap");

  };


    loadQueueMembers(queue.Id);
  }

  function clearAutoServeTimer() {
    if (autoServeTimer) {
      clearTimeout(autoServeTimer);
      autoServeTimer = null;
    }
  }


  function loadQueueMembers(queueId) {
  const panel = document.querySelector("#queueUsersPanel");

  if (unsubscribeMembers) unsubscribeMembers();

  const membersQuery = query(
    collection(db, "Queues", queueId, "Members"),
    orderBy("Number", "asc")
  );

  unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
    if (snapshot.empty) {
      panel.innerHTML = "<p>No members in queue</p>";
      clearAutoServeTimer();
      activeServingUserId = null;
      return;
    }

    const members = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ref: docSnap.ref,
      ...docSnap.data()
    }));

    panel.innerHTML = members.map((m, index) => `
      <div class="order">
        <div class="queue-user ${index === 0 ? "serving" : ""}">
          <div>
            <strong>${m.id}</strong>
            <div class="sub">
              Joined at ${
                m.JoinedAt
                  ? m.JoinedAt.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : "--"
              }
            </div>
          </div>
          <div>
            <span class="status ${index === 0 ? "serving" : "waiting"}">
              ${index === 0 ? "Serving" : "Waiting"}
            </span>
            <span class="token">#${index + 1}</span>
          </div>
        </div>
      </div>
    `).join("");
    
  const first = members[0];

if (!first.TurnStartedAt) {
  updateDoc(first.ref, {
    TurnStartedAt: serverTimestamp()
  });
  return;
}

    if (activeServingUserId === first.id && autoServeTimer) return;

    clearAutoServeTimer();
    activeServingUserId = first.id;


    if (!isSwapEnabled) return;

    const bufferMs = queueBufferMap[queueId] * 60 * 1000;
    const startedAt = first.TurnStartedAt.toDate().getTime();
    const remaining = startedAt + bufferMs - Date.now();

    autoServeTimer = setTimeout(() => {
      moveFirstUserToLast(queueId);
    }, Math.max(remaining, 0));

  });
}


async function moveFirstUserToLast(queueId) {
  const membersRef = collection(db, "Queues", queueId, "Members");

  const snap = await getDocs(
    query(membersRef, orderBy("Number", "asc"))
  );

  if (snap.docs.length <= 1) return;

  const docs = snap.docs;

  await runTransaction(db, async (transaction) => {

    transaction.update(docs[0].ref, {
      Number: docs.length - 1,
      JoinedAt: serverTimestamp(),
      TurnStartedAt: null
    });

    transaction.update(docs[1].ref, {
      Number: 0,
      TurnStartedAt: serverTimestamp()
    });

    for (let i = 2; i < docs.length; i++) {
      transaction.update(docs[i].ref, {
        Number: i - 1
      });
    }
  });
}

async function serveNext(queueId) {
  const membersRef = collection(db, "Queues", queueId, "Members");
  const queueRef = doc(db, "Queues", queueId);

  const snap = await getDocs(
    query(membersRef, orderBy("Number", "asc"))
  );

  if (snap.docs.length === 0) return;

  const docs = snap.docs;

  await runTransaction(db, async (transaction) => {

    const queueSnap = await transaction.get(queueRef);
    const count = queueSnap.data().Count || 0;

    transaction.delete(docs[0].ref);

    if (docs.length > 1) {
      transaction.update(docs[1].ref, {
        Number: 0,
        TurnStartedAt: serverTimestamp()
      });
    }

    isSwapEnabled = true;
    activeServingUserId = null;

    for (let i = 2; i < docs.length; i++) {
      transaction.update(docs[i].ref, {
        Number: i - 1
      });
    }

    transaction.update(queueRef, {
      Count: Math.max(count - 1, 0)
    });
  });
}

  async function toggleQueueStatus(queue) {
    const newStatus = queue.Status === "Active" ? "Paused" : "Active";
    await updateDoc(doc(db, "Queues", queue.Id), { Status: newStatus });
    queue.Status = newStatus;

    document.querySelector("#queueStatus").innerText = newStatus;
    document.querySelector("#toggleStatusBtn").innerText =
      newStatus === "Active" ? "Pause" : "Resume";
  }

  async function deleteQueue() {
    if (!confirm("Delete this queue?")) return;

    const membersRef = collection(db, "Queues", selectedQueueId, "Members");
    const snapshot = await getDocs(membersRef);

    for (const d of snapshot.docs) {
      await deleteDoc(d.ref);
    }

    await deleteDoc(doc(db, "Queues", selectedQueueId));
    localStorage.removeItem(`swap_${selectedQueueId}`);

    showRightEmpty();
    loadQueues();
  }
//  help button
const openHelpBtn = document.querySelector(".help-btn");
const helpOverlay = document.querySelector(".overlay-help");
const closeBtnn = document.querySelector(".x-button");

openHelpBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  helpOverlay.classList.add("active");
});

closeBtnn.addEventListener("click", () => {
  helpOverlay.classList.remove("active");
});

helpOverlay.addEventListener("click", (e) => {
  if (e.target === helpOverlay) {
    helpOverlay.classList.remove("active");
  }
});

document.querySelector(".pop-up-help").addEventListener("click", (e) => {
  e.stopPropagation();
});

//  end
  function showRightEmpty() {
    rightPanel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <h2 class="empty-title">Select a queue to manage</h2>
        <p class="empty-text">Choose from the list on the left</p>
      </div>
    `;
  }
});