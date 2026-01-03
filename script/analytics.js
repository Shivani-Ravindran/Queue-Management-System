import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

google.charts.load("current", { packages: ["corechart"] });
google.charts.setOnLoadCallback(loadAnalytics);

function getAdminUID() {
  const params = new URLSearchParams(window.location.search);
  return params.get("adminUID");
}

async function resetIfNewDay(queueRef, data) {
  const today = new Date().toISOString().slice(0, 10);

  if (data.LastResetDate !== today) {
    await updateDoc(queueRef, {
      ServedToday: 0,
      LastResetDate: today
    });
    return 0;
  }

  return data.ServedToday || 0;
}


async function loadAnalytics() {
  const adminUID = getAdminUID();
  if (!adminUID) return;

  const q = query(
    collection(db, "Queues"),
    where("AdminUID", "==", adminUID)
  );

  const snapshot = await getDocs(q);

  const queues = [];

for (const docSnap of snapshot.docs) {
  const data = docSnap.data();
  const served = await resetIfNewDay(docSnap.ref, data);

  queues.push({
    name: data.QueueName,
    avg: data.AvgWaitTime || 0,
    count: served,
    status: data.Status
  });
}


  drawAvgWaitChart(queues);
  drawServedCountChart(queues);
  drawStatusChart(queues);
}

/* -------- Charts -------- */

function drawAvgWaitChart(queues) {
  const data = google.visualization.arrayToDataTable([
    ["Queue", "Avg Wait (min)"],
    ...queues.map(q => [q.name, q.avg])
  ]);

new google.visualization.BarChart(
  document.getElementById("avgWaitChart")
).draw(data, {
  title: "Average Wait Time per Queue",
  colors: ["#673147"] 
});

}

function drawServedCountChart(queues) {
  const data = google.visualization.arrayToDataTable([
    ["Queue", "Users Served"],
    ...queues.map(q => [q.name, q.count])
  ]);

new google.visualization.ColumnChart(
  document.getElementById("servedCountChart")
).draw(data, {
  title: "Users Served per Queue",
  colors: ["#43a047"] 
});

}

function drawStatusChart(queues) {
  const activeQueues = queues
    .filter(q => q.status === "Active")
    .map(q => q.name);

  const pausedQueues = queues
    .filter(q => q.status === "Paused")
    .map(q => q.name);

  const data = new google.visualization.DataTable();
  data.addColumn("string", "Status");
  data.addColumn("number", "Count");
  data.addColumn({ type: "string", role: "tooltip" });

  data.addRows([
    [
      "Active",
      activeQueues.length,
      activeQueues.length
        ? `Active Queues:\n${activeQueues.join(", ")}`
        : "No active queues"
    ],
    [
      "Paused",
      pausedQueues.length,
      pausedQueues.length
        ? `Paused Queues:\n${pausedQueues.join(", ")}`
        : "No paused queues"
    ]
  ]);

  const options = {
    title: "Queue Status Distribution",
    tooltip: { isHtml: false },
    legend: { position: "right" }
  };

  const chart = new google.visualization.PieChart(
    document.getElementById("statusChart")
  );

  chart.draw(data, options);
}