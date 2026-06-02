const form = document.querySelector("#orderForm");
const result = document.querySelector("#result");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  result.innerHTML = `<div class="notice">กำลังส่งออเดอร์...</div>`;

  const formData = new FormData(form);

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "ส่งออเดอร์ไม่สำเร็จ");

    result.innerHTML = `
      <div class="success">
        <h3>ส่งออเดอร์สำเร็จ 🎉</h3>
        <p>เลขออเดอร์: <b>${data.orderId}</b></p>
        <p>สถานะชำระเงิน: <b>${data.paymentStatus}</b></p>
        <p>แอดมินจะตรวจสอบและจัดส่งให้เร็วที่สุด</p>
      </div>
    `;
    form.reset();
  } catch (err) {
    result.innerHTML = `<div class="error">${err.message}</div>`;
  }
});
