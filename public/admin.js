const ordersEl = document.querySelector("#orders");
const searchInput = document.querySelector("#searchInput");
const backupBtn = document.querySelector("#backupBtn");
const refreshBtn = document.querySelector("#refreshBtn");

let allOrders = [];

const STATUS_TEXT = {
  waiting_slip_review: "🟡 รอตรวจสลิป",
  manual_review: "🟡 รอตรวจสลิป",
  paid_verified: "🟢 ชำระเงินแล้ว",
  delivering: "🔵 กำลังส่งของ",
  delivered: "✅ ส่งแล้ว",
  cancelled: "❌ ยกเลิก",
};

async function loadOrders() {
  try {
    ordersEl.innerHTML = "กำลังโหลด...";

    const res = await fetch("/api/admin/orders");

    if (!res.ok) {
      ordersEl.innerHTML = "<p>โหลดข้อมูลไม่สำเร็จ กรุณาล็อกอินใหม่</p>";
      return;
    }

    const orders = await res.json();
    allOrders = Array.isArray(orders) ? orders : [];

    renderDashboard(allOrders);
    applySearch();
  } catch (err) {
    console.error(err);
    ordersEl.innerHTML = "<p>โหลดข้อมูลไม่สำเร็จ</p>";
  }
}

function renderDashboard(orders) {
  const dashboard = document.querySelector("#dashboard");
  if (!dashboard) return;

  const today = new Date().toLocaleDateString("th-TH");

  const validOrders = orders.filter(order => order.status !== "cancelled");

  const todayOrders = validOrders.filter(order => {
    return new Date(order.createdAt).toLocaleDateString("th-TH") === today;
  });

  const todaySales = todayOrders.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
  );

  const totalSales = validOrders.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
  );

  dashboard.innerHTML = `
    <div class="stat-card">
      <b>💰 ยอดขายวันนี้</b>
      <span>${todaySales.toLocaleString()} บาท</span>
    </div>

    <div class="stat-card">
      <b>📦 ออเดอร์วันนี้</b>
      <span>${todayOrders.length} รายการ</span>
    </div>

    <div class="stat-card">
      <b>💸 ยอดขายทั้งหมด</b>
      <span>${totalSales.toLocaleString()} บาท</span>
    </div>
  `;
}

function applySearch() {
  const keyword = (searchInput?.value || "").toLowerCase().trim();

  if (!keyword) {
    renderOrders(allOrders);
    return;
  }

  const filteredOrders = allOrders.filter(order => {
    const statusThai = STATUS_TEXT[order.status] || "";
    const paymentThai = STATUS_TEXT[order.paymentStatus] || "";

    const searchableText = [
      order.id,
      order.customerName,
      order.customerContact,
      order.receiverLineId,
      order.stickerUrl,
      order.status,
      statusThai,
      order.paymentStatus,
      paymentThai,
      order.paymentMessage,
      order.note,
      order.amount,
      order.createdAt,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(keyword);
  });

  renderOrders(filteredOrders);
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersEl.innerHTML = `<div class="card">ไม่พบออเดอร์</div>`;
    return;
  }

  ordersEl.innerHTML = orders
    .map(order => {
      const statusText = STATUS_TEXT[order.status] || order.status || "-";
      const paymentText = STATUS_TEXT[order.paymentStatus] || order.paymentStatus || "-";

      return `
        <article class="order-card">
          <div class="order-top">
            <h3>#${escapeHtml(order.id)}</h3>
            <span>${formatDate(order.createdAt)}</span>
          </div>

          <p><b>ลูกค้า:</b> ${escapeHtml(order.customerName || "-")}</p>
          <p><b>ติดต่อ:</b> ${escapeHtml(order.customerContact || "-")}</p>

          <p>
            <b>LINE ID:</b>
            <span class="line-id">${escapeHtml(order.receiverLineId || "-")}</span>
            <button class="mini-btn" data-copy="${escapeAttr(order.receiverLineId || "")}">
              📋 Copy
            </button>
          </p>

          <p><b>ยอด:</b> ${Number(order.amount || 0).toLocaleString()} บาท</p>
          <p><b>สถานะงาน:</b> ${statusText}</p>
          <p><b>สถานะสลิป:</b> ${paymentText}</p>

          <p>
            <b>สินค้า:</b>
            <a href="${escapeAttr(order.stickerUrl || "#")}" target="_blank">เปิดลิงก์</a>
          </p>

          <p>
            <b>สลิป:</b>
            <a href="${escapeAttr(order.slipUrl || "#")}" target="_blank">ดูสลิป</a>
          </p>

          <p><b>หมายเหตุ:</b> ${escapeHtml(order.note || "-")}</p>

          <div class="actions">
            <button data-status="paid_verified" data-id="${escapeAttr(order.id)}">
              🟢 ตรวจสลิปผ่าน
            </button>

            <button data-status="delivering" data-id="${escapeAttr(order.id)}">
              🔵 กำลังส่ง
            </button>

            <button data-status="delivered" data-id="${escapeAttr(order.id)}">
              ✅ ส่งแล้ว
            </button>

            <button data-status="cancelled" data-id="${escapeAttr(order.id)}">
              ❌ ยกเลิก
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function updateOrder(id, status) {
  try {
    const body = {
      status,
    };

    if (status === "paid_verified") {
      body.paymentStatus = "paid_verified";
    }

    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      alert("อัปเดตสถานะไม่สำเร็จ");
      return;
    }

    await loadOrders();
  } catch (err) {
    console.error(err);
    alert("อัปเดตสถานะไม่สำเร็จ");
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("คัดลอก LINE ID แล้ว");
  } catch {
    alert("คัดลอกไม่ได้ ลองลากคัดลอกเอง");
  }
}

async function downloadBackup() {
  try {
    const res = await fetch("/api/admin/orders");

    if (!res.ok) {
      alert("Backup ไม่สำเร็จ กรุณาล็อกอินใหม่");
      return;
    }

    const orders = await res.json();

    const blob = new Blob([JSON.stringify(orders, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    a.href = url;
    a.download = `orders-backup-${date}.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Backup ไม่สำเร็จ");
  }
}

function formatDate(dateString) {
  if (!dateString) return "-";

  try {
    return new Date(dateString).toLocaleString("th-TH");
  } catch {
    return dateString;
  }
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}

function escapeAttr(str = "") {
  return escapeHtml(str).replace(/`/g, "&#096;");
}

if (searchInput) {
  searchInput.addEventListener("input", applySearch);
}

if (backupBtn) {
  backupBtn.addEventListener("click", downloadBackup);
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadOrders);
}

ordersEl.addEventListener("click", event => {
  const copyBtn = event.target.closest("[data-copy]");
  if (copyBtn) {
    copyText(copyBtn.dataset.copy);
    return;
  }

  const statusBtn = event.target.closest("[data-status]");
  if (statusBtn) {
    updateOrder(statusBtn.dataset.id, statusBtn.dataset.status);
  }
});

loadOrders();