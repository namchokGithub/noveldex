## firestore-data-modeling

เมื่อ:

- เพิ่ม collection
  - เพิ่ม field
- ทำ cross-reference
  - เพิ่ม adaptation
- เปลี่ยน query
  - ทำ batch update

ก่อนแก้:

1. Inspect existing Firestore model
2. Inspect existing query
3. Inspect firestore.indexes.json
4. Inspect firestore.rules
5. หา usages ของ collection/field ก่อน

ต้องพิจารณา:

- document structure
- denormalization
- read/write cost
- query limitations
- indexes
- backward compatibility
- migration/backfill
- security rules

ห้าม:

- query Firestore ใน UI component แบบกระจัดกระจาย
- เปลี่ยน document shape โดยไม่ตรวจ consumers
- เพิ่ม query โดยไม่คิดเรื่อง index
- ทำ N+1 reads โดยไม่จำเป็น

หลังแก้:

- lint
- test
- Firestore rules test (ถ้าเกี่ยวข้อง)
- สรุป schema/query ที่เปลี่ยน
