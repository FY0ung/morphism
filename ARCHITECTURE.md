# Project Architecture

โครงสร้างกลางสำหรับทุกโปรเจกต์ ห้ามแก้ structure นี้เว้นแต่ได้รับอนุมัติ

## 1. Stack & tooling

| ด้าน | ค่า |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| React | 19 + React Compiler (`reactCompiler: true`) |
| Language | TypeScript strict, ต้องผ่าน `tsc --noEmit` และ `next build` |
| Styling | Tailwind CSS v4 + design tokens ผ่าน `@theme` |
| Theme | `next-themes` (light / dark) |
| i18n | `i18next` + `react-i18next` + `dayjs` |
| Package manager | **Bun** |
| Import alias | `@/*` → `./src/*` (ห้าม relative import ข้ามโฟลเดอร์) |

## 2. Folder structure

```
src/
├─ app/                      # route files บางๆ เท่านั้น
│  ├─ layout.tsx             # root: ThemeProvider + LanguageProvider + font
│  ├─ globals.css            # design tokens (@theme) — single source of truth
│  └─ (main)/                # route group
│     ├─ layout.tsx          # ดึง layout จาก section
│     └─ page.tsx            # ดึง view จาก section
│
├─ sections/                 # implementation ของแต่ละ feature
│  └─ <feature>/
│     ├─ index.ts            # barrel — export View ของ feature
│     ├─ const.tsx           # static data / config ของ feature (ห้ามไว้ใน view)
│     ├─ view/               # หน้าจอจริง: <feature>-view.tsx
│     └─ layout/             # appbar / footer / content + index.ts (barrel)
│        └─ responsive/      # variant สำหรับจอเล็ก (ถ้ามี)
│
├─ components/               # UI ที่ reuse ข้าม feature (ชื่อ PascalCase)
│  ├─ actionable/            # Buttons.tsx, IconButtons.tsx
│  └─ icons/                 # ระบบไอคอน (ดู §6)
│
├─ contexts/                 # React context providers (เช่น theme.tsx)
├─ configs/                  # ค่าคงที่ระดับแอป
│  ├─ route.ts               # route ภายในแอป
│  └─ endpoint.ts            # baseURL + path ของ API
├─ hooks/                    # shared hooks + index.ts (barrel)
├─ lib/                      # business logic / helper (cn, localStorage…)
│  └─ api/                   # ชั้นเชื่อมต่อ API (ดู §9)
│     ├─ client.ts           # fetch wrapper กลาง (baseURL, header, error)
│     ├─ <resource>.ts       # service ต่อ resource เช่น user.ts
│     └─ index.ts            # barrel
├─ types/                    # shared types + index.ts (barrel)
├─ languages/                # i18n setup + typed keys + project/*.json
└─ material/                 # fonts + appFontFamily
```

### กฎการตั้งชื่อ
- โฟลเดอร์ทั้งหมด: `lowercase` (`kebab-case` ถ้ามีหลายคำ)
- ไฟล์ component ที่ reuse ได้ใน `components/`: `PascalCase` (เช่น `Buttons.tsx`)
- ไฟล์ใน `sections/`, `lib/`, `hooks/`, `configs/`: `kebab-case`
- View ของ feature: `<feature>-view.tsx`

## 3. Next.js / App Router rules

- ไฟล์ใน `app/` ต้อง **บางที่สุด** — แค่ import จาก section แล้ว render
  ```tsx
  // app/(main)/page.tsx
  import { HomeView } from "@/sections/home";
  export default function Home() { return <HomeView />; }
  ```
- เป็น Server Component โดย default; ใส่ `"use client"` เฉพาะเมื่อจำเป็น
  (ใช้ hooks, event handler, browser API)
- จัด page ด้วย route group `(group)` เพื่อแชร์ layout โดยไม่กระทบ URL

## 4. Import rules

```ts
// ✅
import { Button } from "@/components/actionable/Buttons";
import { HomeView } from "@/sections/home";

// ❌
import { Button } from "../../../components/actionable/Buttons";
```

## 5. Styling & design tokens

`globals.css` คือแหล่งความจริงเดียวของสี โครงเป็น 3 ชั้น:

1. **`@theme`** — map token เป็น Tailwind utility:
   `--color-background-primary-default: hsla(var(--background-primary-default));`
2. **`:root`** — ค่า HSL ของ theme สว่าง
3. **`.dark`** — ค่า HSL ของ theme มืด

รูปแบบชื่อ token: `{category}-{intent}-{state}`

- category: `background` · `text` · `icon` · `border`
- intent: `default` · `primary` · `secondary` · `success` · `warning` · `error` · `info`
- state (background): `default` · `hover` · `active` · `light` · `light_hover` · `light_active` · `disable`
- state (text/icon/border): `default` · `onlight` · `disable`

### กฎการใช้สี
- ใช้ utility ที่ผูกกับ token เท่านั้น: `bg-*`, `text-*`, `border-*`
  เช่น `bg-background-primary-default`, `text-text-default-onlight`
- **ห้าม** hardcode hex (`bg-[#0C0D0D]`) หรือใส่ `hsla(var(--token))` ในคอมโพเนนต์
- เพิ่มสีใหม่ = เพิ่ม token ใน `globals.css` ทั้ง 3 ชั้น ไม่ใช่ใส่ค่าดิบในที่ใช้งาน

## 6. ระบบไอคอน

```
components/icons/
├─ list/<name>.tsx     # ไฟล์ SVG ทีละตัว (stroke="currentColor")
├─ icons-declare.tsx   # re-export ทุกตัวเป็น PascalCase
├─ icons-list.ts       # รวมเป็น object `icons`
├─ icon-elem.tsx       # <Icon name="..." /> (memo, size-4, text-current)
└─ index.ts            # export { Icon }
```

ใช้งาน: `import { Icon } from "@/components/icons"` → `<Icon name="ChevronRight" />`
เพิ่มไอคอน: วางไฟล์ใน `list/` → เพิ่มใน `icons-declare.tsx` → เพิ่มใน `icons-list.ts`

## 7. i18n

- ข้อความอยู่ใน `languages/project/{th,en}.json` (โครงต้องตรงกันทั้งสองภาษา)
- `languages/types.ts` สร้าง `TranslationKey` / `TFunction` แบบ type-safe จาก `th.json`
  อัตโนมัติ — ใช้ `t("common.appName")` แล้วได้ autocomplete + ตรวจ key ผิดตอน build
- `defaultNS` / `ns` ใช้ค่า `"translation"` ให้ตรงกันทั้ง `index.tsx` และ `types.ts`

## 8. Component conventions

- `components/actionable/Buttons.tsx` (`Button`) และ `IconButtons.tsx` (`IconButton`)
  รองรับ prop `color` (7 intent) · `variant` (`filled` | `text`) · `size`
  (`small` | `medium` | `large`) ผ่าน class map ที่ผูกกับ token
- ออกแบบ UI ให้ครบทุก state: default / hover / focus / active / disabled /
  loading / empty / error และผ่าน WCAG AA, semantic HTML, keyboard, `prefers-reduced-motion`

## 9. การเชื่อมต่อ API

แบ่งหน้าที่ตามโฟลเดอร์เดิม ไม่มีโฟลเดอร์ใหม่นอกกฎ:

| ส่วน | ที่อยู่ | หน้าที่ |
| --- | --- | --- |
| Config | `configs/endpoint.ts` | `API_BASE_URL` + path ของ endpoint, อ่าน env |
| ตัวเชื่อมต่อ | `lib/api/client.ts` | `apiClient()` — fetch wrapper กลาง (header, error, `ApiError`) |
| Service | `lib/api/<resource>.ts` | ฟังก์ชันต่อ resource เช่น `getUsers()`, `createUser()` |
| Type | `types/<resource>.ts` | DTO / response type ของ API |
| Client hook | `hooks/use-<resource>.ts` | เฉพาะตอน fetch ฝั่ง client (loading / error / refetch) |

### กฎ
- **`lib/api` คือแหล่งเดียวที่คุยกับ backend** — component/section เรียกผ่าน service เท่านั้น ห้าม `fetch` ตรงในคอมโพเนนต์
- ทุก path มาจาก `configs/endpoint.ts` ไม่ hardcode string ใน service
- request/response ต้องมี type ใน `types/` ใช้ร่วมกันระหว่าง service กับ view

### Server vs Client (App Router)
- **ดึงตอน render หน้า** → เรียก service ใน Server Component ของ section
  (`sections/<feature>/view/...`) ตรงๆ ไม่ต้อง `"use client"` ไม่ต้องมี hook
- **interaction ฝั่ง client** (กดปุ่มแล้วยิง, ต้องมี loading/error state) → ใช้ hook ใน `hooks/`

```ts
// Server Component — ดึงตอน render
import { getUsers } from "@/lib/api";
export default async function UsersView() {
  const users = await getUsers();
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}

// Client — มี loading/error/refetch
"use client";
import { useUsers } from "@/hooks";
const { data, loading, error, refetch } = useUsers();
```

## 10. Response / change rules

1. รักษา structure เดิม
2. ห้ามเพิ่ม dependency ใหม่โดยไม่ขออนุมัติ
3. แก้เล็ก → ส่งเฉพาะไฟล์ที่แก้
4. ฟีเจอร์ใหญ่ → ส่งโครงไฟล์ครบ
5. โค้ดต้องผ่าน `tsc --noEmit` และ TypeScript strict mode
