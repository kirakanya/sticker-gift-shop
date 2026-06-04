const form = document.querySelector("#orderForm");
const result = document.querySelector("#result");

const tokenInput = document.querySelector("#tokenInput");
const priceCompare = document.querySelector("#priceCompare");
const linePriceEl = document.querySelector("#linePrice");
const ourPriceEl = document.querySelector("#ourPrice");
const saveTextEl = document.querySelector("#saveText");
const amountInput = document.querySelector("#amountInput");

let currentPrice = null;

const LINE_PRICE_TABLE = {
  50: 35,
  100: 65,
  150: 95,
  200: 129,
  250: 159,
  300: 199,
  500: 329,
};

const OUR_PRICE_TABLE = {
  50: 29,
  100: 49,
  150: 69,
  200: 99,
  250: 119,
  300: 149,
  500: 249,
};

function calculatePrice(token) {
  token = Number(token);

  const linePrice = LINE_PRICE_TABLE[token];
  const ourPrice = OUR_PRICE_TABLE[token];

  if (!linePrice || !ourPrice) {
    return null;
  }

  const saveBaht = linePrice - ourPrice;
  const savePercent = Math.round((saveBaht / linePrice) * 100);

  return {
    token,
    linePrice,
    ourPrice,
    saveBaht,
    savePercent,
  };
}

function renderPriceCalculator() {
  currentPrice = calculatePrice(tokenInput.value);

  if (!currentPrice) {
    priceCompare.classList.add("hidden");
    return;
  }

  priceCompare.classList.remove("hidden");

  linePriceEl.textContent = `${currentPrice.linePrice} บาท`;
  ourPriceEl.textContent = `${currentPrice.ourPrice} บาท`;
  saveTextEl.textContent = `ประหยัด ${currentPrice.saveBaht} บาท • ถูกกว่าประมาณ ${currentPrice.savePercent}%`;
}

function useCalculatedPrice() {
  if (!currentPrice) {
    alert("กรุณาเลือกจำนวน Token ก่อน");
    return;
  }

  amountInput.value = currentPrice.ourPrice;
  amountInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

if (tokenInput) {
  tokenInput.addEventListener("change", renderPriceCalculator);
  tokenInput.addEventListener("input", renderPriceCalculator);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  result.innerHTML = `<div class="notice">กำลังส่งออเดอร์...</div>`;

  const formData = new FormData(form);

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "ส่งออเดอร์ไม่สำเร็จ");
    }

    result.innerHTML = `
      <div class="success">
        <h3>ส่งออเดอร์สำเร็จ</h3>
        <p>เลขออเดอร์: <b>${data.orderId}</b></p>
        <p>นำเลขออเดอร์ไปเช็กสถานะได้ที่หน้าเช็กสถานะ</p>
        <p><a href="/status.html">ไปหน้าเช็กสถานะ</a></p>
      </div>
    `;

    form.reset();
    priceCompare.classList.add("hidden");
    currentPrice = null;
  } catch (err) {
    result.innerHTML = `<div class="error">${err.message}</div>`;
  }
});