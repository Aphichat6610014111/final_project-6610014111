Manual test instructions for Receipt screen

Purpose

This document explains how to manually test the Thai receipt UI and the PDF export added to `Receipt.js`.

Prerequisites

- Node.js + npm installed
- Expo CLI (optional, but recommended): `npm install -g expo-cli`
- A device or simulator with Expo Go, or build the app if using native features

Install dependencies

From `autopart-app` folder:

```powershell
cd "d:\Auto Part System\autopart-app"
npm install
```

(If you use `yarn`, run `yarn`.)

Note: The project now depends on `expo-print` and `expo-sharing`. These are Expo packages; they generally work in Expo-managed projects. If you use a bare workflow or custom native builds, ensure you add the appropriate native modules and rebuild.

Run the app

```powershell
npm run start
```

Open the app in Expo Go (or emulator). Navigate to the Receipt screen (the app normally navigates with `route.params.order` or `orderId`).

Manual test steps

1. Show the Receipt screen with an order JSON (either by navigating from the app where an order exists, or by triggering navigation with route params in dev).
2. Verify UI:
   - Header text is `ใบเสร็จรับเงิน`.
   - Fields displayed: `เลขที่ผู้ใช้`, `สถานะคำสั่งซื้อ`, `วันที่ออก`, `ที่อยู่จัดส่ง` (ชื่อ, address lines, อำเภอ/เขต, จังหวัด, รหัสไปรษณีย์).
      - รายการสินค้าแสดงชื่อ x จำนวน และราคา (เป็นรูปแบบสกุลเงินดอลลาร์ `USD`).
      - ยอดรวมย่อย, ค่าจัดส่ง, ภาษี และ รวมทั้งสิ้น แสดงเป็นสกุล `USD`.

3. Export PDF:
   - กดปุ่ม `ส่งออกเป็น PDF`.
   - ควรขึ้น dialog สำหรับแชร์/บันทึกไฟล์ (บนอุปกรณ์ที่รองรับ) หรือแสดง Alert พร้อมพาธไฟล์ที่บันทึกไว้.
   - เปิดไฟล์ PDF เพื่อแน่ใจว่าเนื้อหา (เลขที่สั่งซื้อ, วันที่, ที่อยู่, รายการสินค้า, ยอดรวม) ปรากฏถูกต้อง.

Edge cases to test

- Order ไม่มี `shipping` field -> ดูว่าจะแสดง `N/A` หรือช่องว่างโดยไม่ crash
- Item ไม่มี `quantity` หรือ `price` -> ควร default เป็น 1 / 0
- Order มีค่า `paymentMethod` แปลกๆ -> ต้องไม่ทำให้ UI พัง
- ทดสอบบน Android และ iOS (และ Expo Go) เพื่อยืนยันการทำงานของ `expo-print` + `expo-sharing`

If PDF fails to generate

- ตรวจสอบ console logs (Metro) เพื่อดู error message
- บางกรณี Expo Go บน iOS/Android may not support all printing/sharing features without a custom build. ให้พิจารณา `expo run:android` / `expo run:ios` หรือ EAS build.

Next steps (optional)

- Add a Jest snapshot test for `Receipt.js` to capture changes in structure
- Create a backend endpoint to generate PDF server-side if client-side is not consistent across platforms
- Improve printed HTML styling (fonts, logo, page size) and add unit tests

Contact

If you want me to add automated tests (Jest) or implement server-side PDF generation, tell me and I'll implement the next step.
