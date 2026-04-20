# Auth API Example

API ตัวอย่างสำหรับระบบ Authentication ด้วย Elysia, Bun, Drizzle ORM และ Turso/libSQL

## สิ่งที่ต้องมี

- [Bun](https://bun.sh/)
- Turso database
- Turso auth token

## ติดตั้งและรันแบบ Local

Clone โปรเจกต์และติดตั้ง dependencies:

```bash
git clone https://github.com/naay99999/auth-api-example.git
cd auth-api-example
bun install
```

สร้างไฟล์ `.env`:

```bash
cp .env.example .env
```

แก้ค่าใน `.env` ให้พร้อมใช้งาน:

```env
PORT=5678
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
TURSO_DATABASE_URL=your-database-url
TURSO_AUTH_TOKEN=your-turso-auth-token
JWT_SECRET=your-random-secret
```

รัน database migration:

```bash
bun run db:migrate
```

ถ้าต้องการข้อมูลตัวอย่างสำหรับทดลองใช้งาน ให้ seed demo users:

```bash
bun run db:seed
```

เริ่มรัน server:

```bash
bun run dev
```

API จะพร้อมใช้งานที่:

```text
http://localhost:5678
```

## API Docs

หลังจากรัน server แล้ว เปิดเอกสาร API ได้ที่:

```text
http://localhost:5678/api/v1/docs
```

ในหน้านี้สามารถดู endpoint, request body, response และทดลองเรียก API ได้

## Demo Users

ถ้ารัน `bun run db:seed` แล้ว จะมี user สำหรับทดลองใช้งาน:

| Email | Password |
|---|---|
| alex@example.com | Password123! |
| maya@example.com | Password123! |
| sam@example.com | Password123! |
