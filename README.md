# StickerGift - เว็บรับออเดอร์สติ๊กเกอร์ LINE

ระบบตัวอย่างสำหรับร้านรับซื้อสติ๊กเกอร์/ธีม LINE เป็นของขวัญ

## ฟีเจอร์
- หน้าร้านรับออเดอร์
- ลูกค้าวางลิงก์ LINE Store
- กรอก LINE ID ผู้รับ
- แนบสลิปโอนเงิน
- หลังบ้านดูออเดอร์
- ส่งแจ้งเตือนเข้า Discord Webhook
- มีจุดต่อ API ตรวจสลิปอัตโนมัติ

## วิธีรัน
```bash
npm install
cp .env.example .env
npm run dev
```

เปิดเว็บ:
```text
http://localhost:3000
```

หลังบ้าน:
```text
http://localhost:3000/admin.html
```

## การตั้งค่า Discord
1. เข้า Discord Server
2. Server Settings > Integrations > Webhooks
3. Create Webhook
4. Copy Webhook URL
5. เอาไปใส่ใน `.env`

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxxxx/yyyyy
```

## การตรวจสลิป
ค่าเริ่มต้น:
```env
ENABLE_SLIP_VERIFY=false
```

ถ้าเปิดเป็น `true` ต้องต่อ API ตรวจสลิปจริงก่อน เช่น ผู้ให้บริการตรวจ QR/slip ที่ถูกกฎหมาย

```env
ENABLE_SLIP_VERIFY=true
SLIP_VERIFY_API_URL=https://api.example.com/verify-slip
SLIP_VERIFY_API_KEY=your_api_key
```

## สิ่งที่ควรทำก่อนเปิดขายจริง
- ใส่ระบบล็อกอินแอดมิน
- ซ่อน `/api/admin/orders`
- ใช้ฐานข้อมูลจริง เช่น PostgreSQL / Supabase
- เก็บสลิปใน Cloud Storage
- ต่อระบบตรวจสลิปจริง
- ตรวจสลิปซ้ำ
- ทำ Terms ว่าร้านเป็นบริการสั่งซื้อของขวัญ ไม่ขายของละเมิดลิขสิทธิ์
