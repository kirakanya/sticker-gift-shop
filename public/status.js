const form = document.querySelector("#statusForm");
const orderIdInput = document.querySelector("#orderId");
const result = document.querySelector("#statusResult");

const STATUS_TEXT = {
  waiting_slip_review: "🟡 รอตรวจสลิป",
  manual_review: "🟡 รอตรวจสลิป",
  paid_verified: "🟢 ชำระเงินแล้ว",
  delivering: "🔵 กำลังส่งของ",
  delivered: "✅ ส่งแล้ว",
  cancelled: "❌ ยกเลิก",
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = orderIdInput.value.trim();

  if (!id) return;

  result.innerHTML = `<div class="notice">กำลังค้นหาออเดอร์...</div>`;

  try {
    const res = await fetch(`/api/orders/${id}`);
    const data = await res.json();

    if (!res.ok) {
      result.innerHTML = `
        <div class="error">
          ไม่พบออเดอร์นี้ กรุณาตรวจสอบเลขออเดอร์อีกครั้ง
        </div>
      `;
      return;
    }

    const statusText = STATUS_TEXT[data.status] || data.status || "-";
    const paymentText = STATUS_TEXT[data.paymentStatus] || data.paymentStatus || "-";

    result.innerHTML = `
      <div class="success">
        <h2>สถานะออเดอร์ #${escapeHtml(data.id)}</h2>
        <p><b>ชื่อลูกค้า:</b> ${escapeHtml(data.customerName || "-")}</p>
        <p><b>ยอดชำระ:</b> ${Number(data.amount || 0).toLocaleString()} บาท</p>
        <p><b>สถานะงาน:</b> ${statusText}</p>
        <p><b>สถานะสลิป:</b> ${paymentText}</p>
        <p><b>วันที่สั่ง:</b> ${new Date(data.createdAt).toLocaleString("th-TH")}</p>
      </div>
    `;
  } catch (err) {
    console.error(err);

    result.innerHTML = `
      <div class="error">
        ระบบมีปัญหา กรุณาลองใหม่อีกครั้ง
      </div>
    `;
  }
});

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[m]));
}