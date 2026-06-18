const ordersEl = document.querySelector("#orders");
const totalSalesEl = document.querySelector("#totalSales");
const todayOrdersEl = document.querySelector("#todayOrders");
const allSalesEl = document.querySelector("#allSales");

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

async function loadOrders() {
  try {
    ordersEl.innerHTML = `<div class="notice">กำลังโหลดออเดอร์...</div>`;

    const res = await fetch("/api/admin/orders");

    if (!res.ok) {
      throw new Error("โหลดออเดอร์ไม่สำเร็จ");
    }

    const orders = await res.json();

    renderDashboard(orders);
    renderOrders(orders);
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
      return `
        <article class="order-card">
          <div class="order-top">
            <div>
              <h3>ออเดอร์ #${order.id}</h3>
              <p class="muted">${formatDate(order.createdAt)}</p>
            </div>
            <b>${Number(order.amount || 0)} บาท</b>
          </div>

          <p><b>สินค้า:</b> <a href="${order.stickerUrl}" target="_blank">เปิดลิงก์สินค้า</a></p>
          <p><b>LINE ID ผู้รับ:</b> <span class="line-id">${order.receiverLineId || "-"}</span></p>
          <p><b>ชื่อลูกค้า:</b> ${order.customerName || "-"}</p>
          <p><b>ช่องทางติดต่อ:</b> ${order.customerContact || "-"}</p>
          <p><b>หมายเหตุ:</b> ${order.note || "-"}</p>

          <p><b>สถานะชำระเงิน:</b> ${getPaymentStatusText(order.paymentStatus)}</p>
          <p><b>สถานะออเดอร์:</b> ${getOrderStatusText(order.status)}</p>

          <p>
            <b>สลิป:</b>
            ${
              order.slipUrl
                ? `<a href="${order.slipUrl}" target="_blank">ดูสลิป</a>`
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

loadOrders();