require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const { nanoid } = require("nanoid");
const { createClient } = require("@supabase/supabase-js");
const generatePayload = require("promptpay-qr");
const QRCode = require("qrcode");
const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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

app.get("/admin.html", checkAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("รองรับเฉพาะไฟล์ JPG, PNG, WEBP"));
    }

    cb(null, true);
  },
});

function mapOrderFromDb(row) {
  return {
    id: row.id,
    stickerUrl: row.sticker_url,
    receiverLineId: row.receiver_line_id,
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    amount: Number(row.amount),
    note: row.note || "",
    slipFile: row.slip_file || "",
    slipUrl: row.slip_url || "",
    paymentStatus: row.payment_status,
    paymentMessage: row.payment_message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOrderToDb(order) {
  return {
    id: order.id,
    sticker_url: order.stickerUrl,
    receiver_line_id: order.receiverLineId,
    customer_name: order.customerName,
    customer_contact: order.customerContact,
    amount: order.amount,
    note: order.note || "",
    slip_file: order.slipFile || "",
    slip_url: order.slipUrl || "",
    payment_status: order.paymentStatus,
    payment_message: order.paymentMessage,
    status: order.status,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

function isValidLineProductUrl(url) {
  try {
    const u = new URL(url);

    const allowedHosts = [
      "line.me",
      "store.line.me",
      "music.line.me",
      "lin.ee",
    ];

    return allowedHosts.some(
      (host) => u.hostname === host || u.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

async function uploadSlipToSupabase(file, orderId) {
  const ext = path.extname(file.originalname || "") || ".jpg";
  const fileName = `${orderId}${ext}`;

  const { error } = await supabase.storage
    .from("slips")
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) {
    console.error("Upload slip error:", error);
    throw error;
  }

  const { data } = supabase.storage.from("slips").getPublicUrl(fileName);

  return {
    slipFile: fileName,
    slipUrl: data.publicUrl,
  };
}

async function getAllOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get orders error:", error);
    throw error;
  }

  return data.map(mapOrderFromDb);
}

async function getOrderById(id) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;

  return mapOrderFromDb(data);
}

async function createOrder(order) {
  const { data, error } = await supabase
    .from("orders")
    .insert(mapOrderToDb(order))
    .select("*")
    .single();

  if (error) {
    console.error("Create order error:", error);
    throw error;
  }

  return mapOrderFromDb(data);
}

async function updateOrder(id, updates) {
  const dbUpdates = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status) dbUpdates.status = updates.status;
  if (updates.paymentStatus) dbUpdates.payment_status = updates.paymentStatus;

  const { data, error } = await supabase
    .from("orders")
    .update(dbUpdates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Update order error:", error);
    throw error;
  }

  return mapOrderFromDb(data);
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

  const statusText =
    {
      manual_review: "รอตรวจสลิป",
      paid_verified: "ชำระเงินแล้ว",
      payment_problem: "สลิปมีปัญหา",
      waiting_slip_review: "รอตรวจสลิป",
      delivered: "ส่งแล้ว",
      cancelled: "ยกเลิก",
    }[order.paymentStatus] || order.paymentStatus;

  try {
    await axios.post(webhook, {
      embeds: [
        {
          title: `ออเดอร์ใหม่ #${order.id}`,
          color: 0x16a34a,
          fields: [
            { name: "สินค้า", value: order.stickerUrl || "-", inline: false },
            { name: "LINE ID ผู้รับ", value: order.receiverLineId || "-", inline: true },
            { name: "ชื่อลูกค้า", value: order.customerName || "-", inline: true },
            { name: "ช่องทางติดต่อ", value: order.customerContact || "-", inline: true },
            { name: "ยอดโอน", value: `${order.amount} บาท`, inline: true },
            { name: "สถานะ", value: statusText || "-", inline: true },
            { name: "หมายเหตุ", value: order.note || "-", inline: false },
            { name: "สลิป", value: order.slipUrl || "-", inline: false },
          ],
          timestamp: new Date(order.createdAt).toISOString(),
        },
      ],
    });
  } catch (err) {
    console.error("Discord แจ้งเตือนไม่สำเร็จ:", err.response?.data || err.message);
  }
}

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

    if (!isValidLineProductUrl(stickerUrl)) {
      return res.status(400).json({
        error: "ลิงก์ต้องเป็นลิงก์สินค้าจาก LINE เช่น Sticker / Theme / Melody",
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "กรุณาอัปโหลดสลิป" });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "ยอดโอนไม่ถูกต้อง" });
    }

    const id = nanoid(10);
    const slipCheck = await verifySlip();
    const slip = await uploadSlipToSupabase(req.file, id);

    const order = {
      id,
      stickerUrl,
      receiverLineId,
      customerName,
      customerContact,
      amount: numericAmount,
      note: note || "",
      slipFile: slip.slipFile,
      slipUrl: slip.slipUrl,
      paymentStatus: slipCheck.status,
      paymentMessage: slipCheck.message,
      status: "waiting_slip_review",
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };

    const savedOrder = await createOrder(order);

    await notifyDiscord(savedOrder);

    res.json({
      ok: true,
      orderId: savedOrder.id,
      paymentStatus: savedOrder.paymentStatus,
      message: "ส่งออเดอร์สำเร็จ",
    });
  } catch (err) {
    console.error("Create order failed:", err);
    res.status(500).json({
      error: "ระบบมีปัญหา กรุณาลองใหม่",
      detail: err.message,
    });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);

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
  } catch (err) {
    console.error("Get order status failed:", err);
    res.status(500).json({ error: "ระบบมีปัญหา" });
  }
});

app.get("/api/admin/orders", checkAdmin, async (req, res) => {
  try {
    const orders = await getAllOrders();
    res.json(orders);
  } catch (err) {
    console.error("Load admin orders failed:", err);
    res.status(500).json({ error: "โหลดออเดอร์ไม่สำเร็จ" });
  }
});

app.patch("/api/admin/orders/:id", checkAdmin, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;

    const order = await updateOrder(req.params.id, {
      status,
      paymentStatus,
    });

    res.json({ ok: true, order });
  } catch (err) {
    console.error("Update order failed:", err);
    res.status(500).json({ error: "อัปเดตออเดอร์ไม่สำเร็จ" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});