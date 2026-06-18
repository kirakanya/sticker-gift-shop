const form = document.querySelector("#orderForm");
const result = document.querySelector("#result");

const tokenInput = document.querySelector("#tokenInput");
const tokenButtons = document.querySelector("#tokenButtons");
const linePriceEl = document.querySelector("#linePrice");
const ourPriceEl = document.querySelector("#ourPrice");
const saveTextEl = document.querySelector("#saveText");
const savePercentEl = document.querySelector("#savePercent");
const amountInput = document.querySelector("#amountInput");

let currentPrice = null;

const LINE_PRICE_TABLE = {
  50: 35,
  70: 49,
  85: 59,
  100: 70,
  150: 105,
};

const OUR_PRICE_TABLE = {
  50: 25,
  70: 35,
  85: 45,
  100: 50,
  150: 75,
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

function renderPriceCalculator(token) {
  currentPrice = calculatePrice(token);

  if (!currentPrice) {
    return;
  }

  linePriceEl.textContent = `${currentPrice.linePrice} บาท`;
  ourPriceEl.textContent = `${currentPrice.ourPrice} บาท`;
  saveTextEl.textContent = `ประหยัด ${currentPrice.saveBaht} บาท`;
  savePercentEl.textContent = `ถูกกว่าประมาณ ${currentPrice.savePercent}%`;
}

function useCalculatedPrice() {
  if (!currentPrice) {
    alert("กรุณาเลือกจำนวน Token ก่อน");
    return;
  }

  amountInput.value = currentPrice.ourPrice;
  amountInput.scrollIntoView({ behavior: "smooth", block: "center" });
}

if (tokenButtons) {
  tokenButtons.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-token]");
    if (!btn) return;

    document.querySelectorAll("[data-token]").forEach((button) => {
      button.classList.remove("active");
    });

    btn.classList.add("active");

    tokenInput.value = btn.dataset.token;
    renderPriceCalculator(btn.dataset.token);
  });

  const defaultBtn = document.querySelector('[data-token="50"]');

  if (defaultBtn) {
    defaultBtn.classList.add("active");
    tokenInput.value = "50";
    renderPriceCalculator("50");
  }
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
        <p><a href="/status.html">ไปหน้าเช็กสถานะ</a></p>
      </div>
    `;

    form.reset();

    const defaultBtn = document.querySelector('[data-token="50"]');

    document.querySelectorAll("[data-token]").forEach((button) => {
      button.classList.remove("active");
    });

    if (defaultBtn) {
      defaultBtn.classList.add("active");
      tokenInput.value = "50";
      renderPriceCalculator("50");
    }
  } catch (err) {
    result.innerHTML = `<div class="error">${err.message}</div>`;
  }
});