# Phase 3 — Timeline location and event characters

## Summary

ปรับ Timeline จาก `ปี` เป็นโครงสร้าง `เล่ม → บท → หน้า → ลำดับเรียง` และให้ Event ผูกตัวละครได้หลายคน พร้อมสร้างตัวละครแบบฟอร์มย่อจากหน้า Timeline แล้วเชื่อมเข้ากับ Event ทันที

## Key changes

- เพิ่มข้อมูล Event ให้รองรับ `page_number`, `character_ids` และข้อมูลตำแหน่งที่ resolve จากบท/เล่ม
- หน้า Timeline จัดกลุ่มและเรียงเป็น เล่ม (เลขและชื่อ) → บท (เลขและชื่อ) → หน้า โดยรายการที่ไม่ระบุหน้าอยู่ท้ายบท และใช้ลำดับเรียงเดิมสำหรับ Event ที่อยู่หน้าเดียวกัน
- ฟอร์มเพิ่ม/แก้ไข Event ให้เลือกเล่มก่อน แล้วเลือกบทในเล่มนั้น (บังคับสำหรับรายการใหม่), กรอกหน้าเป็นเลขจำนวนเต็มแบบไม่บังคับ, และเลือกตัวละครได้หลายคน
- เพิ่ม “เพิ่มตัวละครใหม่” ในฟอร์ม Event: ชื่อบังคับ, เลือกบทบาทได้, หากไม่เลือกใช้ `minor`; สร้าง Character แล้วเลือกให้ Event ทันที
- ป้องกันชื่อ Character ซ้ำแบบไม่สนตัวพิมพ์ โดยให้เลือกตัวละครเดิมแทน
- บัตร Event แสดงตัวละครที่เชื่อมไว้ พร้อมลิงก์ไปโปรไฟล์ตัวละคร

## Data and migration

- ขยาย `NovelEvent` และ Firebase Event payload ให้ส่งกลับ/บันทึก `character_ids`, `page_number` และ metadata ของเล่มสำหรับจัดกลุ่ม
- ปรับ `createEvent` และ `updateEvent` ให้รับ character IDs และตำแหน่งหน้า
- เพิ่ม helper สร้าง Character แบบย่อจาก Timeline โดยใช้ validation และ role resolution เดียวกับหน้าตัวละคร
- เขียน backfill ที่รองรับ `--dry-run` และ `--apply`:
  - Event เดิมที่มี `chapter_id` จะเติมข้อมูลเล่ม/บทจาก Chapter ปัจจุบัน และกำหนด `page_number: null`
  - Event เดิมที่ไม่มีบทจะแสดงในกลุ่ม “ยังไม่ระบุตำแหน่ง”
  - เก็บ `story_date` เดิมใน Firestore เพื่อไม่ทำลายข้อมูล แต่ตัดออกจาก UI หลักและไม่รับค่าใหม่

## Test plan

- ทดสอบ Event service สำหรับการสร้าง/แก้ไข page, chapter location และหลาย character IDs
- ทดสอบการจัดกลุ่มและเรียง เล่ม → บท → หน้า → sort order รวมกรณีหน้าไม่ระบุและ Event เก่าไร้บท
- ทดสอบ quick-add character: สร้างสำเร็จ, auto-select, role เริ่มต้น และชื่อซ้ำ
- รัน unit tests, TypeScript, lint และ build หลังแก้ไข
- รัน backfill แบบ dry-run ก่อน apply และตรวจจำนวน Event/Character บน Firestore หลัง apply

## Assumptions

- “หน้า” เป็นเลขจำนวนเต็มบวก ไม่บังคับ
- Event ใหม่ต้องเลือกบทเสมอ; เล่ม derive จากบท ไม่ให้กรอกตำแหน่งเอง
- Full-text search ยังอยู่เป็นงาน Phase 3 แยกต่างหาก และไม่รวมในงาน Timeline นี้
