# Novelndex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase 6: Polish

### Small

- [x] Empty states in remaining pages
- [x] Accessibility + keyboard UX
  - `Tab` จากต้นหน้า → เห็น “Skip to main content” → `Enter`
  - Search → `Ctrl + Shift + K`, ใช้ `↑ ↓`, `Enter`, `Esc`
  - Language menu → `Tab` ถึงปุ่มภาษา, `↓` เปิด, `↑ ↓`, `Home/End`, `Enter`, `Esc`
  - Account menu → `↓` เปิด, `Esc` ปิดและ focus กลับปุ่มเดิม
  - Modal confirm / Tag / Character dialog → `Tab` วนใน modal, `Esc` ปิด, ปิดแล้ว focus กลับ trigger
  - Chapter reorder mode → `Tab` ถึงปุ่ม `↑ / ↓`, กดเพื่อย้าย chapter; ปุ่มต้น/ท้ายต้อง disabled
  - Pagination → ปุ่ม Prev ที่หน้า 1 และ Next หน้าสุดท้ายต้อง disabled จริง
  - Tag picker → พิมพ์, `↑ ↓` เลือก, `Enter` เพิ่ม, `Esc` ปิด
  - Note mention → พิมพ์ `[[`, `↑ ↓`, `Enter` แทรกชื่อ, `Esc` ซ่อน suggestion; กด `Esc` อีกครั้งยกเลิก note edit
  - Inline Chapter edit (title, description, date, entry type) → แก้ค่าแล้ว `Esc` ต้องคืนค่าเดิมและปิด edit mode
- [ ] Localization / typography polish

### Medium

- [ ] Loading / saving / deleting states
- [ ] Error handling + user-facing messages
- [ ] Mobile-responsive layout
- [ ] Guest/Admin UX polish
- [ ] Data consistency polish

### Large

- [ ] Firestore read-cost + performance audit
- [ ] Cross-browser / device verification
- [ ] Production readiness checklist

## Fix & Issue

- [ ] Unit test
- [ ] `AddNovelForm` is disabled (commented out) in `app/novels/page.tsx` — no way to add a novel from the UI right now; pre-existing, unrelated to the Firebase migration
- [ ] `components/commands/CommandPalette.tsx` keydown `useEffect` has no dependency array — flagged in the 2026-09-05 UI polish plan, not yet cleaned up
