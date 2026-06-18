const ordersEl = document.querySelector("#orders");
const totalSalesEl = document.querySelector("#totalSales");
const todayOrdersEl = document.querySelector("#todayOrders");
const allSalesEl = document.querySelector("#allSales");
const adminSearchEl = document.querySelector("#adminSearch");

let allOrders = [];

function formatDate(dateString) {
  if (!dateString) return "-";

  return new Date(dateString).toLocaleString("th-TH", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getPaymentStatusText(status) {
  const map = {
    manual_review: "รอตรวจสลิป",
    paid_verified: "ชำระเงินแล้ว",
    payment_problem: "สลิปมีปัญหา",
  };

  return map[status] || status || "-";
}

function getOrderStatusText(status) {
  const map = {
    waiting_slip_review: "รอตรวจสลิป",
    processing: "กำลังดำเนินการ",
    delivered: "ส่งแล้ว",
    cancelled: "ยกเลิก",
  };

  return map[status] || status || "-";
}

async function copyText(text, label = "ข้อความ") {
  if (!text) {
    alert(`ไม่มี${label}ให้คัดลอก`);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    alert(`คัดลอก${label}แล้ว: ${text}`);
  } catch {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);

    alert(`คัดลอก${label}แล้ว: ${text}`);
  }
}

function copyLineId(lineId) {
  copyText(lineId, " LINE ID");
}

function copyOrderId(orderId) {
  copyText(orderId, "เลขออเดอร์");
}

function copyProductLink(link) {
  copyText(link, "ลิงก์สินค้า");
}

async function loadOrders() {
  try {
    ordersEl.innerHTML = `<div class="notice">กำลังโหลดออเดอร์...</div>`;

    const res = await fetch("/api/admin/orders");

    if (!res.ok) {
      throw new Error("โหลดออเดอร์ไม่สำเร็จ");
    }

    const orders = await res.json();

    allOrders = Array.isArray(orders) ? orders : [];

    renderDashboard(allOrders);
    renderOrders(allOrders);
  } catch (err) {
    ordersEl.innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function renderDashboard(orders) {
  const today = new Date().toISOString().slice(0, 10);

  const todayOrders = orders.filter((order) => {
    return order.createdAt && order.createdAt.slice(0, 10) === today;
  });

  const todaySales = todayOrders.reduce((sum, order) => {
    return sum + Number(order.amount || 0);
  }, 0);

  const allSales = orders.reduce((sum, order) => {
    return sum + Number(order.amount || 0);
  }, 0);

  if (totalSalesEl) totalSalesEl.textContent = `${todaySales} บาท`;
  if (todayOrdersEl) todayOrdersEl.textContent = `${todayOrders.length} รายการ`;
  if (allSalesEl) allSalesEl.textContent = `${allSales} บาท`;
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersEl.innerHTML = `<div class="notice">ไม่พบออเดอร์</div>`;
    return;
  }

  ordersEl.innerHTML = orders
    .map((order) => {
      const lineId = order.receiverLineId || "";
      const productLink = order.stickerUrl || "";
      const slipUrl = order.slipUrl || "";

      return `
        <article class="order-card">
          <div class="order-top">
            <div>
              <h3>
                ออเดอร์ #${order.id}
                <button class="mini-btn" type="button" onclick="copyOrderId('${order.id}')">
                  คัดลอกเลข
                </button>
              </h3>
              <p class="muted">${formatDate(order.createdAt)}</p>
            </div>
            <b>${Number(order.amount || 0)} บาท</b>
          </div>

          <p>
            <b>สินค้า:</b>
            ${
              productLink
                ? `<a href="${productLink}" target="_blank">เปิดลิงก์สินค้า</a>
                   <button class="mini-btn" type="button" onclick="copyProductLink('${productLink}')">คัดลอกลิงก์</button>`
                : "-"
            }
          </p>

          <p>
            <b>LINE ID ผู้รับ:</b>
            <span class="line-id">${lineId || "-"}</span>
            ${
              lineId
                ? `<button class="mini-btn" type="button" onclick="copyLineId('${lineId}')">คัดลอก</button>`
                : ""
            }
          </p>

          <p><b>ชื่อลูกค้า:</b> ${order.customerName || "-"}</p>
          <p><b>ช่องทางติดต่อ:</b> ${order.customerContact || "-"}</p>
          <p><b>หมายเหตุ:</b> ${order.note || "-"}</p>

          <p><b>สถานะชำระเงิน:</b> ${getPaymentStatusText(order.paymentStatus)}</p>
          <p><b>สถานะออเดอร์:</b> ${getOrderStatusText(order.status)}</p>

          <p>
            <b>สลิป:</b>
            ${
              slipUrl
                ? `<a href="${slipUrl}" target="_blank">ดูสลิป</a>`
                : "-"
            }
          </p>

          <div class="actions">
            <button onclick="updateOrder('${order.id}', 'waiting_slip_review', 'manual_review')">
              รอตรวจสลิป
            </button>

            <button onclick="updateOrder('${order.id}', 'processing', 'paid_verified')">
              ชำระเงินแล้ว
            </button>

            <button onclick="updateOrder('${order.id}', 'waiting_slip_review', 'payment_problem')">
              ยอดไม่ตรง / สลิปไม่ชัด
            </button>

            <button onclick="updateOrder('${order.id}', 'delivered', 'paid_verified')">
              ส่งแล้ว
            </button>

            <button onclick="updateOrder('${order.id}', 'cancelled', 'payment_problem')">
              ยกเลิก
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function filterOrders(keyword) {
  const q = keyword.trim().toLowerCase();

  if (!q) {
    renderOrders(allOrders);
    return;
  }

  const filtered = allOrders.filter((order) => {
    return [
      order.id,
      order.stickerUrl,
      order.receiverLineId,
      order.customerName,
      order.customerContact,
      order.amount,
      order.note,
      order.paymentStatus,
      order.status,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  renderOrders(filtered);
}

async function updateOrder(id, status, paymentStatus) {
  try {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        paymentStatus,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "อัปเดตไม่สำเร็จ");
    }

    await loadOrders();
  } catch (err) {
    alert(err.message);
  }
}

if (adminSearchEl) {
  adminSearchEl.addEventListener("input", (event) => {
    filterOrders(event.target.value);
  });
}

loadOrders();