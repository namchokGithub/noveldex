# รองรับ Prologue, Epilogue และบทพิเศษในการเรียง Chapter

## สรุป

แยก “ลำดับการอ่าน” ออกจาก “เลข Chapter” เพื่อให้ลาก Prologue, Epilogue, Afterword และ Side Story ได้ โดยเลข `Ch. 1`, `Ch. 2` ของบทปกติไม่เปลี่ยนตามการลาก

## การเปลี่ยนแปลงหลัก

- เพิ่ม `kind` สำหรับ Chapter: `chapter`, `prologue`, `epilogue`, `afterword`, `side_story`, `other`
- เพิ่ม `sort_order` เป็นลำดับภายใน Volume สำหรับทุก entry
- เปลี่ยน `number` เป็น `number | null`
  - `chapter` ต้องมีเลข Chapter เป็นจำนวนเต็มบวกและ unique ระดับนิยายตามระบบ `chapterNumbers` เดิม
  - บทพิเศษมี `number: null` และไม่สร้าง marker
- เพิ่ม `custom_label` สำหรับ `kind: "other"` โดยต้องไม่ว่าง; preset อื่นใช้ชื่อประเภทจาก locale
- สร้าง formatter กลางสำหรับ label เช่น `Ch. 3 — Title`, `Prologue — Title`, `Interlude — Title` เพื่อใช้ซ้ำใน list, reorder, detail, Timeline, Character appearances และ Quick Search

## Firestore และ migration

- ปรับ create/update/delete Chapter:
  - สร้าง Chapter ปกติสร้าง `chapterNumbers` marker ตามเดิม
  - สร้างบทพิเศษไม่สร้าง marker และให้ `sort_order` ต่อท้ายใน Volume
  - เปลี่ยนประเภทจาก Chapter เป็นบทพิเศษต้องลบ marker และตั้ง `number` เป็น `null`
  - เปลี่ยนกลับเป็น Chapter ต้องระบุเลขที่ยังว่าง แล้วสร้าง marker ใน transaction
  - reorder อัปเดตเฉพาะ `sort_order`; ห้ามเปลี่ยน `number` หรือ marker
- เพิ่ม admin script แบบ `--dry-run` / `--apply` เพื่อ backfill Chapter เดิมเป็น:
  - `kind: "chapter"`
  - `sort_order: number`
  - `custom_label: null`
- รัน migration ก่อน deploy โค้ดที่ query ด้วย `sort_order` เพื่อไม่ให้ Chapter เดิมหายจากผล query
- ปรับ Firestore indexes สำหรับ collection-group queries ที่เรียง Chapter; การเรียงข้าม Volume ให้ใช้ `volume.number` ก่อน แล้วใช้ `chapter.sort_order`
- Event ที่ผูก Chapter จะใช้ label จาก Chapter ปัจจุบันใน UI; `chapter_number` snapshot เดิมยังเก็บเพื่อ backward compatibility

## UI

- ฟอร์ม Add Chapter เพิ่ม `Entry type` โดยค่าเริ่มต้นเป็น Chapter
  - Chapter แสดงช่อง Number และเสนอเลข Chapter ถัดไป
  - Prologue, Epilogue, Afterword และ Side Story ซ่อนช่อง Number
  - Other แสดงช่องชื่อประเภทเพิ่มเติม
  - ทุก entry ใหม่ถูกเพิ่มท้าย Volume แล้วผู้ใช้ย้ายตำแหน่งด้วย Reorder
- หน้า Chapter detail แก้ไขประเภทได้ โดยแสดง/ซ่อนช่อง Number ตามประเภท และตรวจสอบข้อขัดแย้งก่อนบันทึก
- หน้า Reorder แสดง label จาก formatter และบันทึกเฉพาะลำดับอ่าน
- หน้า list, Timeline, Character appearances และผล Quick Search ใช้ label เดียวกัน; ห้ามแสดง `Ch. null` หรือเลขภายในของบทพิเศษ
- เพิ่ม locale ไทยและอังกฤษสำหรับประเภท, ฟอร์ม, validation และข้อความยืนยันการลบ

## การทดสอบ

- Firestore tests สำหรับการสร้าง, เปลี่ยนประเภท, ลบ และการใช้ marker ของ Chapter ปกติ
- ทดสอบบทพิเศษไม่มี marker และรับ `number: null`
- ทดสอบ reorder ที่แทรก Prologue ก่อน Ch. 1 และ Epilogue หลัง Chapter สุดท้าย โดยเลข Chapter ปกติคงเดิม
- ทดสอบ `Other` ต้องมี custom label
- ทดสอบ migration ทั้ง dry-run และ apply กับข้อมูล Chapter เดิม
- ตรวจ Timeline, Character appearances และ Quick Search แสดง label ถูกต้อง
- รัน focused emulator tests, lint และ production build

## ข้อสมมติที่ล็อกแล้ว

- Reorder ทำงานภายใน Volume เท่านั้น
- Chapter ปกติยังมีเลข unique ระดับนิยาย
- ใช้ preset พร้อม `Other` สำหรับประเภทใหม่ในอนาคต
- บทพิเศษสร้างต่อท้ายก่อน แล้วจัดตำแหน่งจริงด้วย Reorder
