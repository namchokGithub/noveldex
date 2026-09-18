# Rich Note Editor Plan

## Summary

เพิ่ม roadmap checklist ใน `docs/engineering/PROGRESS.md` สำหรับ Rich Note Editor v1 ที่ใช้ร่วมกันทั้ง Chapter และ Adaptation notes

- ใช้ Tiptap พร้อม extensions เฉพาะ toolbar ที่ตกลง: bold, italic, strike, highlight, paragraph, heading 3, bullet/ordered list, quote, link/unlink, undo/redo และ clear formatting
- ไม่รองรับ table, font size/family, alignment หรือ ViewHtml ใน v1
- ไม่ render HTML ดิบ; ใช้ Tiptap read-only renderer จาก JSON จึงไม่ต้องเพิ่ม HTML sanitizer

## Data and editor behavior

- เพิ่ม dependencies ของ Tiptap และสร้าง shared `RichNoteEditor` / `RichNoteContent` เพื่อแทน textarea และตัวแสดงผลข้อความเดิมทั้งสองหน้า
- `ChapterNote` เพิ่ม optional `content_json` เป็น Tiptap JSON document; `content` คงอยู่เป็น derived plain text สำหรับ compatibility, MiniSearch และ parser ของ `[[...]]`
- Note เก่าที่ไม่มี `content_json` แสดงเป็น plain text และเมื่อเปิดแก้ไขให้แปลงเป็น Tiptap paragraph document; จะเขียน JSON ครั้งแรกเมื่อบันทึกเท่านั้น—ไม่มี backfill
- custom `EntityReference` inline node ต้อง render plain text เป็น syntax เดิมเสมอ: `[[Rimuru]]` สำหรับ character และ `[[location:Tempest]]` เป็นต้นสำหรับ typed entities
- ก่อนบันทึก derive `content` จาก document แล้วใช้ flow เดิม `reconcileReferenceOccurrences` เพื่อรักษา `references`, character legacy fields และ cross-reference views

## Entity reference UX

- ปุ่ม EntityReference เปิด popup ค้นหา entity ตามชื่อหรือ alias จากข้อมูล character และ generic entities ของ novel
- การพิมพ์ `[[` เปิด popup เดียวกัน; รองรับคีย์บอร์ด, Escape และ IME โดยไม่รบกวนการพิมพ์
- มี filter: character, location, skill, organization, item, concept
- เลือก character แทรก shorthand; ประเภทอื่นแทรก typed syntax ตาม ADR-011
- โหลด entities ใน Server Component ที่ส่ง props ให้ editor เพื่อไม่เพิ่ม Firestore read กระจัดกระจายใน client

## Integration and verification

- ขยาย Firestore adapters ของ chapter/adaptation ให้ map และ persist `content_json` พร้อม `content`; records เดิมต้องอ่านได้เหมือนเดิม
- MiniSearch ใช้ `content` derived plain text ต่อไป จึงค้นหา formatted text และ reference syntax ได้โดยไม่เปลี่ยน index contract
- เปลี่ยน ChapterNotesEditor และ AdaptationNotesEditor ให้ใช้ shared editor/viewer แต่คง pagination, auth gate, save/cancel, optimistic search updates และ UX เดิม
- เพิ่ม tests สำหรับ plain-text ↔ Tiptap JSON conversion, toolbar serialization, entity insertion/derived syntax, lazy legacy-note upgrade, references/cross-reference persistence และ MiniSearch indexing
- รัน focused Vitest ผ่าน Firebase emulator, `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit` และตรวจ manual ทั้ง Chapter/Adaptation: format, link, autocomplete, keyboard navigation, note เก่า, guest read-only และ dark/mobile layout

## Assumptions

- `content_json` เป็น canonical rich document; `content` เป็น derived compatibility/search projection
- Link v1 รับเฉพาะ safe `https:`, `http:` และ `mailto:` URLs
- ไม่ migrate production data ล่วงหน้า และไม่เปลี่ยน Firestore rules หรือ indexes

## Conclusion

- สรุปลง docs/\_complete_logs.md
- อัปเดตเอกสารที่เกี่ยวข้อง README.md และอื่น ๆ
- ขอ Git Commit Message อิง Rule จาก docs/ai/AGENTS.md
