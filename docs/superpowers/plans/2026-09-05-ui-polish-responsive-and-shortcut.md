# UI Polish, Chapter Layout, Responsive Audit, Global Shortcut Fix

## Summary

มาจาก `_todo.md` (2026-09-05): 4 งาน — โพลิช UI ทั่วไป, หน้า chapter ดูอัดกลางจอ, เช็ค responsive web+mobile, shortcut `Ctrl/Cmd+Shift+K` ทำงานไม่ถูกต้อง. ทุกงานเป็น **UI/styling เท่านั้น ห้ามแก้ flow เดิม** และ **แค่วางแผนไว้ก่อน ยังไม่ลงมือทำ** (ตาม `_todo.md` บรรทัด 7-9). ห้าม commit git จนกว่าจะได้รับคำสั่งชัดเจนแยกต่างหาก.

## Key changes

### 1. หน้า chapter ดูอัดอยู่กลางจอ (`_todo.md` บรรทัด 4)

- `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/page.tsx:54` เรียก `DashboardPage maxWidth="max-w-4xl"` — แคบกว่า default ของ `DashboardPage` (`app/novels/ui.tsx:94`, default `max-w-6xl`) ทำให้เนื้อหาดูเป็นกล่องแคบกลางจอ
- `ChapterEditor.tsx:339-347` (summary) ใช้ `rows={6}` + `min-h-45` แบบ fix, `ChapterNotesEditor.tsx:67` (notes) ใช้ `rows={4}` + `min-h-32` แบบ fix — เนื้อหายาวจะโดนตัดเป็นกล่องเตี้ย ไม่ยืดตามจริง
- `app/novels/ui.tsx` (`pageRootClassName`, `shellClassName`, `innerShellClassName`) ไม่มี `overflow-hidden` ครอบเนื้อหา → document-level scroll ทำงานอยู่แล้วในปัจจุบัน ไม่ต้องสร้าง scroll container ใหม่
- แผนแก้ (ตอนลงมือทำจริง):
  - ขยาย `maxWidth` ของหน้า chapter ให้เท่ากับหน้าอื่นที่มีเนื้อหาลักษณะเดียวกัน (เช่น `max-w-5xl` หรือ default `max-w-6xl`)
  - เปลี่ยน textarea (summary + notes) จาก fixed `rows`/`min-h` เป็นแบบยืดตามเนื้อหา (เช่น CSS `field-sizing: content` ถ้า browser support พอ หรือ auto-resize on input) แทนความสูงตายตัว
  - ไม่แตะ logic การบันทึก/mention/suggestion ที่มีอยู่

### 2. Shortcut `Ctrl/Cmd+Shift+K` ทำงานไม่ถูกต้อง (`_todo.md` บรรทัด 6)

- `components/commands/CommandPalette.tsx:85` เช็คด้วย `event.key.toLocaleLowerCase() === 'k'` — `event.key` ขึ้นกับ keyboard layout และ browser; `Ctrl/Cmd+Shift+K` ยังชนกับ shortcut ที่บาง browser จองไว้เอง (เช่น Firefox Web Console) ซึ่ง browser จะดักคีย์ก่อนถึง JS ของหน้าเว็บ ทำให้ handler ไม่ถูกเรียกเลย
- `useEffect` บรรทัดเดียวกันไม่มี dependency array — re-subscribe listener ทุก render (ไม่ใช่สาเหตุ miss key โดยตรงเพราะ cleanup ทำงานก่อน add ใหม่เสมอ แต่ควรทำให้สะอาดตอนแก้)
- แผนวินิจฉัยก่อนแก้ (ทำตอนลงมือ ไม่ใช่ตอนนี้): repro จริงก่อนสรุป root cause — browser/OS ไหน, focus อยู่ใน input/textarea หรือไม่, มี extension ดักคีย์หรือไม่
- แผนแก้ไข: เปลี่ยนไปเช็ค `event.code === 'KeyK'` (physical key ไม่ขึ้นกับ layout/shift-produced character) ควบคู่กับ `event.key` เป็น fallback, เพิ่ม dependency array ให้ effect ถูกต้อง, ถ้ายังชนกับ browser reserved shortcut ให้พึ่งปุ่ม UI ที่มีอยู่แล้ว (`CommandPaletteTrigger`, `CommandPalette.tsx:37-40`) เป็นทางเข้าสำรอง แทนการไล่หา key combo ใหม่

### 3. เช็ค Responsive web+mobile (`_todo.md` บรรทัด 5)

- เช็คโค้ดเบื้องต้นพบ breakpoint coverage บาง: `app/novels/[id]/VolumeManager.tsx` (445 บรรทัด) มี `sm:` แค่ 4 จุด, ไม่มี `md:`/`lg:` เลย; `app/novels/[id]/characters/[characterId]/CharacterDetail.tsx` (281 บรรทัด) มี `sm:` 3 จุด + `lg:` 1 จุด — สองไฟล์นี้เพิ่งถูกแก้ layout ใน commit ล่าสุด (`b86ff2a`) แต่ responsive coverage ยังบาง
- แผน: ทดสอบจริงด้วย viewport 375 / 768 / 1024 / 1440px บน `/novels`, `/novels/[id]` (VolumeManager), `/novels/[id]/characters/[characterId]` (CharacterDetail), หน้า chapter, CommandPalette (มือถือ), LanguageToggle — เช็ค horizontal overflow, tap target ขนาดเล็กไป, grid ล้นจอ
- Deliverable ของงานนี้คือ **punch list** (ไม่ใช่โค้ดทันที) ผูกกับ backlog เดิมที่มีอยู่แล้วใน `docs/engineering/PROGRESS.md` → Phase 6 "Mobile-responsive layout"

### 4. Polish UI ทั่วไป (`_todo.md` บรรทัด 3)

- แผน: audit ความสม่ำเสมอของ spacing/typography/สี ที่มาจาก shared class ใน `app/novels/ui.tsx` ข้ามทุกหน้าที่ใช้ `DashboardPage` — หาจุดที่หลุด pattern (เช่น inline style แทน shared className, หรือ spacing ที่ไม่ตรง scale เดิม)
- ไม่แตะ flow เดิมตามที่ระบุใน `_todo.md` บรรทัด 7
- Deliverable คือ punch list เช่นกัน ใช้ต่อยอดเป็นงานย่อยรอบถัดไป

## Test plan (ตอนลงมือทำจริง)

- Chapter layout: เปิดผ่าน `corepack pnpm dev`, ทดสอบเนื้อหายาว/สั้น, ยืนยัน scroll ปกติ, ไม่กระทบการบันทึก title/summary/notes/tags เดิม
- Shortcut: ทดสอบ Chrome + Firefox (+ Safari ถ้ามี) บน Mac และ Windows, ทั้งตอน focus อยู่ใน input/textarea และตอนไม่อยู่, ทดสอบทั้งปุ่ม UI สำรองว่ายังใช้ได้
- Responsive: DevTools device toolbar ตาม breakpoint ที่ระบุด้านบน บนหน้าทั้งหมดที่ระบุ
- รัน `corepack pnpm lint` และ `corepack pnpm test` หลังแก้โค้ดจริงทุกครั้ง (ยังไม่ต้องรันตอนนี้ เพราะยังไม่ลงมือ)

## Constraints

- UI/styling เท่านั้น ห้ามเปลี่ยน flow ระบบเดิม (`_todo.md` บรรทัด 7)
- ห้าม commit git จนกว่าจะได้รับคำสั่งแยกต่างหากอย่างชัดเจน (`_todo.md` บรรทัด 9)
- ไม่เพิ่ม Go API / Redis / `NEXT_PUBLIC_API_URL` — งานนี้เป็น frontend-only ตาม `CLAUDE.md` / `docs/ai/CONTEXT.md`
- ไม่แตะ `AddNovelForm` (ปิดใช้งานตามเดิม, pre-existing, ไม่เกี่ยวกับงานนี้)
- ไม่แตะ Firestore rules/schema/indexes

## Assumptions

- Root cause ของ shortcut bug คือ browser-reserved-key conflict หรือ `event.key` ขึ้นกับ layout — ต้อง repro ยืนยันก่อนสรุปจริง ไม่ใช่แก้แบบเดา
- "หน้า chapter ยาวขึ้นได้ scroll ได้" หมายถึงเนื้อหาไม่ถูกบีบให้ดูเล็ก/ลอยกลางจอ ไม่ใช่การสร้าง scroll container ใหม่ (document scroll มีอยู่แล้วในปัจจุบัน)
- งาน responsive/polish เป็น audit-first แล้วค่อยแตกเป็นแผนย่อยแก้ทีละจุดในรอบถัดไป เพราะ scope กว้างกว่า 1-2 ไฟล์

## Execution order แนะนำ

1. Shortcut fix — เล็กสุด, isolated, ไฟล์เดียว (`CommandPalette.tsx`)
2. Chapter layout — 2-3 ไฟล์, ไม่กระทบหน้าอื่น
3. Responsive audit → punch list ผูกกับ PROGRESS.md Phase 6
4. Polish audit → punch list ต่อยอดรอบถัดไป

งาน 3-4 เป็น audit ก่อน ไม่ใช่ลงโค้ดทันที เพราะ scope กว้าง ควรแตกเป็นแผนย่อยอีกทีหลัง audit เสร็จ.
