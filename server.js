require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, "[]", "utf8");
}

app.use(cors());
app.use(express.json());

// ===== Admin Login =====
function checkAdmin(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", "Basic");
    return res.status(401).send("ต้องเข้าสู่ระบบแอดมิน");
  }

  const base64 = auth.split(" ")[1];
  const [username, password] = Buffer.from(base64, "base64")
    .toString()
    .split(":");

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return next();
  }

  return res.status(401).send("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
}

// หน้า admin ต้องล็อกอินก่อน
app.get("/admin.html", checkAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("รองรับเฉพาะไฟล์ JPG, PNG, WEBP"));
    }

    cb(null, true);
  },
});

function readOrders() {
  return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf8");
}

function isValidLineStickerUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes("line.me") || u.hostname.includes("store.line.me");
  } catch {
    return false;
  }
}

async function verifySlip() {
  if (process.env.ENABLE_SLIP_VERIFY !== "true") {
    return {
      status: "manual_review",
      message: "รอตรวจสลิปโดยแอดมิน",
    };
  }

  return {
    status: "manual_review",
    message: "ยังไม่ได้เชื่อม API ตรวจสลิปจริง",
  };
}

async function notifyDiscord(order) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;

  if (!webhook || webhook.includes("xxxxx")) {
    console.log("ยังไม่ได้ตั้งค่า Discord Webhook");
    return;
  }

  const statusText = {
    manual_review: "🟡 รอตรวจสลิป",
    paid_verified: "🟢 ชำระเงินแล้ว",
    payment_problem: "🔴 สลิปมีปัญหา",
  }[order.paymentStatus] || order.paymentStatus;

  await axios.post(webhook, {
    embeds: [
      {
        title: `🛒 ออเดอร์ใหม่ #${order.id}`,
        color: 0xff4fa3,
        fields: [
          { name: "สินค้า", value: order.stickerUrl || "-", inline: false },
          { name: "LINE ID ผู้รับ", value: order.receiverLineId || "-", inline: true },
          { name: "ชื่อลูกค้า", value: order.customerName || "-", inline: true },
          { name: "ช่องทางติดต่อ", value: order.customerContact || "-", inline: true },
          { name: "ยอดโอน", value: `${order.amount} บาท`, inline: true },
          { name: "สถานะ", value: statusText, inline: true },
          { name: "หมายเหตุ", value: order.note || "-", inline: false },
          { name: "สลิป", value: order.slipUrl || "-", inline: false },
        ],
        timestamp: new Date(order.createdAt).toISOString(),
      },
    ],
  });
}

// ===== ลูกค้าส่งออเดอร์ =====
app.post("/api/orders", upload.single("slip"), async (req, res) => {
  try {
    const {
      stickerUrl,
      receiverLineId,
      customerName,
      customerContact,
      amount,
      note,
    } = req.body;

    if (!stickerUrl || !receiverLineId || !customerName || !customerContact || !amount) {
      return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" });
    }

    if (!isValidLineStickerUrl(stickerUrl)) {
      return res.status(400).json({ error: "ลิงก์ต้องเป็นลิงก์จาก LINE Store" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "กรุณาอัปโหลดสลิป" });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "ยอดโอนไม่ถูกต้อง" });
    }

    const id = nanoid(10);
    const slipExt = path.extname(req.file.originalname || "") || ".jpg";
    const newSlipName = `${id}${slipExt}`;
    const newSlipPath = path.join(UPLOAD_DIR, newSlipName);

    fs.renameSync(req.file.path, newSlipPath);

    const slipCheck = await verifySlip();

    const order = {
      id,
      stickerUrl,
      receiverLineId,
      customerName,
      customerContact,
      amount: numericAmount,
      note: note || "",
      slipFile: newSlipName,
      slipUrl: `/uploads/${newSlipName}`,
      paymentStatus: slipCheck.status,
      paymentMessage: slipCheck.message,
      status: "waiting_slip_review",
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    const orders = readOrders();
    orders.unshift(order);
    writeOrders(orders);

    await notifyDiscord(order);

    res.json({
      ok: true,
      orderId: id,
      paymentStatus: order.paymentStatus,
      message: "ส่งออเดอร์สำเร็จ",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ระบบมีปัญหา กรุณาลองใหม่" });
  }
});

// ===== ลูกค้าเช็กสถานะออเดอร์ =====
app.get("/api/orders/:id", (req, res) => {
  const { id } = req.params;

  const orders = readOrders();
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return res.status(404).json({ error: "ไม่พบออเดอร์นี้" });
  }

  res.json({
    id: order.id,
    customerName: order.customerName,
    amount: order.amount,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt || null,
  });
});

// ===== หลังบ้าน ต้องล็อกอิน =====
app.get("/api/admin/orders", checkAdmin, (req, res) => {
  res.json(readOrders());
});

app.patch("/api/admin/orders/:id", checkAdmin, (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus } = req.body;

  const orders = readOrders();
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return res.status(404).json({ error: "ไม่พบออเดอร์" });
  }

  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;

  order.updatedAt = new Date().toISOString();

  writeOrders(orders);

  res.json({ ok: true, order });
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});