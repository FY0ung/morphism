# Moldable Design System

> Design system documentation generated from the [Moldable Design System Figma file](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system).
> Last sync: 2026-05-23 · Source of truth: Figma · © 2024 Moldable Studio.

This document is the single reference shared between designers and developers. The **Design** sections describe intent and visual rules; the **Developer notes** at the end of each section explain how to consume the tokens in code.

---

## Table of contents

1. [Overview — Brand & Style](#1-overview)
2. [Colors](#2-colors)
3. [Typography](#3-typography)
4. [Layout & Spacing](#4-layout--spacing)
5. [Elevation & Depth](#5-elevation--depth)
6. [Shapes (Radius)](#6-shapes-radius)
7. [Iconography](#7-iconography)
8. [Logo](#8-logo)
9. [Components](#9-components)
10. [Do's and Don'ts](#10-dos-and-donts)
11. [Token reference (Schema)](#11-token-reference-schema)
12. [Implementation guide for developers](#12-implementation-guide-for-developers)

---

## 1. Overview

> ⏳ รอข้อมูลจาก Figma frame

---

## 2. Colors

> Source: Style guide → Color
> Figma: [Color roles](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=55-1521) · [Primitives](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=14-577) · [Backgrounds](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=40-1640) · [Texts](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=55-106) · [Icons](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=55-971) · [Borders](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=55-1246)

ระบบสีเป็น **2-tier token system**:
- **Primitives** — ค่าสีดิบ (HEX/RGB) จัดเป็น family × scale 100-1000
- **Semantic tokens** — token ที่อ้างอิงไป primitive อีกที สำหรับใช้ใน component จริง รองรับทั้ง Light mode และ Dark mode

> Color palette ใช้ scale 11 step โดย **100 คือสีอ่อนสุด** และ **1000 คือสีเข้มสุด** เพื่อความ consistent ทั่วทั้งระบบ

### 2.1 Color roles

ระบบกำหนด **role 7 ตัว** ที่บอก "intent" ของสีเมื่อนำไปใช้:

| Role | ใช้สำหรับ |
|---|---|
| **default** | Baseline color ที่ใช้ทั่วทั้งระบบ (สีพื้นฐาน) |
| **brand primary** | Primary/brand color สำหรับ action หลัก หรือ element ที่สื่อแบรนด์ |
| **brand secondary** | สนับสนุน/ถ่วงดุล primary action, ใช้กับ element ที่ priority รอง หรือ alternative action |
| **success** | บอกผลสำเร็จ, task ที่เสร็จแล้ว, การยืนยัน |
| **warning** | เตือนระวัง, ปัญหาที่ต้องสนใจแต่ยังไม่ใช่ failure |
| **danger** | Failure, ปัญหารุนแรง, invalid state ที่ต้อง user action |
| **information** | ข้อความให้ข้อมูล, tip, system state |

> ทุก semantic token จะ map กับ role เหล่านี้เสมอ เช่น `background/primary/default` ใช้ role brand primary, `text/danger/default` ใช้ role danger

### 2.2 Primitives

Primitive palette มี **9 families × 10 steps** = 90 colors ทั้งหมด

#### 2.2.1 Brand families

##### Pigeon (Brand primary)

| Token | HEX | RGB |
|---|---|---|
| `Pigeon 100` | `#E7EFF8` | 231, 239, 248 |
| `Pigeon 200` | `#D3E0F2` | 211, 224, 242 |
| `Pigeon 300` | `#ABC2E5` | 171, 194, 229 |
| `Pigeon 400` | `#9BB0DE` | 155, 176, 222 |
| `Pigeon 500` | `#8296D2` | 130, 150, 210 |
| `Pigeon 600` | `#6978C2` | 105, 120, 194 |
| `Pigeon 700` | `#5864AA` | 88, 100, 170 |
| `Pigeon 800` | `#49548A` | 73, 84, 138 |
| `Pigeon 900` | `#40496F` | 64, 73, 111 |
| `Pigeon 1000` | `#252941` | 37, 41, 65 |

##### Tower Gray

| Token | HEX | RGB |
|---|---|---|
| `Tower 100` | `#EBF1F3` | 235, 241, 243 |
| `Tower 200` | `#D3E1E4` | 211, 225, 228 |
| `Tower 300` | `#9BBCC3` | 155, 188, 195 |
| `Tower 400` | `#7FA9B1` | 127, 169, 177 |
| `Tower 500` | `#5F8E98` | 95, 142, 152 |
| `Tower 600` | `#4B757E` | 75, 117, 126 |
| `Tower 700` | `#3D5E67` | 61, 94, 103 |
| `Tower 800` | `#365056` | 54, 80, 86 |
| `Tower 900` | `#30444A` | 48, 68, 74 |
| `Tower 1000` | `#202D31` | 32, 45, 49 |

##### Lilac

| Token | HEX | RGB |
|---|---|---|
| `Lilac 100` | `#F6F0F7` | 246, 240, 247 |
| `Lilac 200` | `#EFE3F1` | 239, 227, 241 |
| `Lilac 300` | `#E2CCE6` | 226, 204, 230 |
| `Lilac 400` | `#CBA5D1` | 203, 165, 209 |
| `Lilac 500` | `#BB8AC2` | 187, 138, 194 |
| `Lilac 600` | `#A76FAE` | 167, 111, 174 |
| `Lilac 700` | `#8F5B95` | 143, 91, 149 |
| `Lilac 800` | `#774E7B` | 119, 78, 123 |
| `Lilac 900` | `#613F64` | 97, 63, 100 |
| `Lilac 1000` | `#422645` | 66, 38, 69 |

##### Illusion (Brand secondary)

| Token | HEX | RGB |
|---|---|---|
| `Illusion 100` | `#FAEDF3` | 250, 237, 243 |
| `Illusion 200` | `#F9D9E6` | 249, 217, 230 |
| `Illusion 300` | `#F5BDD2` | 245, 189, 210 |
| `Illusion 400` | `#EB92B3` | 235, 146, 179 |
| `Illusion 500` | `#D46085` | 212, 96, 133 |
| `Illusion 600` | `#C14164` | 193, 65, 100 |
| `Illusion 700` | `#A6304C` | 166, 48, 76 |
| `Illusion 800` | `#8A2A40` | 138, 42, 64 |
| `Illusion 900` | `#742739` | 116, 39, 57 |
| `Illusion 1000` | `#45121D` | 69, 18, 29 |

#### 2.2.2 Neutral

##### Gray

| Token | HEX | RGB |
|---|---|---|
| `Gray 100` | `#F5F5F5` | 245, 245, 245 |
| `Gray 200` | `#E6E6E6` | 230, 230, 230 |
| `Gray 300` | `#D9D9D9` | 217, 217, 217 |
| `Gray 400` | `#B3B3B3` | 179, 179, 179 |
| `Gray 500` | `#757575` | 117, 117, 117 |
| `Gray 600` | `#454545` | 69, 69, 69 |
| `Gray 700` | `#383838` | 56, 56, 56 |
| `Gray 800` | `#2B2B2B` | 43, 43, 43 |
| `Gray 900` | `#1F1F1F` | 31, 31, 31 |
| `Gray 1000` | `#121212` | 18, 18, 18 |

#### 2.2.3 Semantic colors

##### Green (Success)

| Token | HEX | RGB |
|---|---|---|
| `Green 100` | `#ECFEF4` | 236, 254, 244 |
| `Green 200` | `#CEF8E1` | 206, 248, 225 |
| `Green 300` | `#88EDB6` | 136, 237, 182 |
| `Green 400` | `#21D172` | 33, 209, 114 |
| `Green 500` | `#1BB161` | 27, 177, 97 |
| `Green 600` | `#129C52` | 18, 156, 82 |
| `Green 700` | `#138247` | 19, 130, 71 |
| `Green 800` | `#14673C` | 20, 103, 60 |
| `Green 900` | `#135433` | 19, 84, 51 |
| `Green 1000` | `#042F1A` | 4, 47, 26 |

##### Yellow (Warning)

| Token | HEX | RGB |
|---|---|---|
| `Yellow 100` | `#FFFBEB` | 255, 251, 235 |
| `Yellow 200` | `#FFF1C2` | 255, 241, 194 |
| `Yellow 300` | `#FFE8A3` | 255, 232, 163 |
| `Yellow 400` | `#FAB619` | 250, 182, 25 |
| `Yellow 500` | `#F09810` | 240, 152, 16 |
| `Yellow 600` | `#DD7202` | 221, 114, 2 |
| `Yellow 700` | `#B74F06` | 183, 79, 6 |
| `Yellow 800` | `#943C0C` | 148, 60, 12 |
| `Yellow 900` | `#7A320D` | 122, 50, 13 |
| `Yellow 1000` | `#461802` | 70, 24, 2 |

##### Red (Danger)

| Token | HEX | RGB |
|---|---|---|
| `Red 100` | `#FFEBEB` | 255, 235, 235 |
| `Red 200` | `#FFC7C6` | 255, 199, 198 |
| `Red 300` | `#FF9F9E` | 255, 159, 158 |
| `Red 400` | `#FF7270` | 255, 114, 112 |
| `Red 500` | `#FF403D` | 255, 64, 61 |
| `Red 600` | `#EB1A17` | 235, 26, 23 |
| `Red 700` | `#C6120F` | 198, 18, 15 |
| `Red 800` | `#A41210` | 166, 18, 16 |
| `Red 900` | `#871715` | 135, 23, 21 |
| `Red 1000` | `#4A0605` | 74, 6, 5 |

##### Blue (Information)

| Token | HEX | RGB |
|---|---|---|
| `Blue 100` | `#EBF5FF` | 235, 245, 255 |
| `Blue 200` | `#B8E0FF` | 184, 224, 255 |
| `Blue 300` | `#78C9FF` | 120, 201, 255 |
| `Blue 400` | `#52BAFF` | 82, 186, 255 |
| `Blue 500` | `#0692F1` | 5, 146, 241 |
| `Blue 600` | `#0073CE` | 0, 115, 206 |
| `Blue 700` | `#005CA7` | 0, 92, 167 |
| `Blue 800` | `#024E8A` | 3, 79, 138 |
| `Blue 900` | `#084172` | 8, 65, 114 |
| `Blue 1000` | `#06294B` | 6, 41, 75 |

### 2.3 Semantic tokens

Semantic token แต่ละตัวจะ **อ้างอิง primitive ทั้งใน Light mode และ Dark mode** เพื่อให้ component เดียวสลับ theme ได้โดยอัตโนมัติ

โครงสร้าง token name: `{property}/{role}/{state}`
- **property:** `background`, `text`, `icon`, `border`
- **role:** `default`, `primary`, `secondary`, `success`, `warning`, `danger`, `info`
- **state:** `default`, `hover`, `active`, `light`, `light/hover`, `light/active`, `disabled`, `on/light`

#### 2.3.1 Backgrounds

มี state ครบที่สุด 7 states ต่อ role: `default`, `hover`, `active`, `light`, `light/hover`, `light/active`, `disabled`

##### Default

| Token | Light mode | Dark mode |
|---|---|---|
| `background/default/default` | White 1000 (`#FFFFFF`) | Gray 900 (`#1F1F1F`) |
| `background/default/hover` | Gray 100 (`#F5F5F5`) | Gray 800 (`#2B2B2B`) |
| `background/default/active` | Gray 100 (`#F5F5F5`) | Gray 800 (`#2B2B2B`) |
| `background/default/light` | Gray 100 (`#F5F5F5`) | Gray 800 (`#2B2B2B`) |
| `background/default/light/hover` | Gray 200 (`#E6E6E6`) | Gray 700 (`#383838`) |
| `background/default/light/active` | Gray 200 (`#E6E6E6`) | Gray 700 (`#383838`) |
| `background/default/disabled` | Gray 100 (`#F5F5F5`) | Gray 800 (`#2B2B2B`) |

##### Primary

| Token | Light mode | Dark mode |
|---|---|---|
| `background/primary/default` | Pigeon 400 | Pigeon 600 |
| `background/primary/hover` | Pigeon 500 | Pigeon 700 |
| `background/primary/active` | Pigeon 500 | Pigeon 700 |
| `background/primary/light` | Pigeon 100 | Pigeon 900 |
| `background/primary/light/hover` | Pigeon 200 | Pigeon 1000 |
| `background/primary/light/active` | Pigeon 200 | Pigeon 1000 |
| `background/primary/disabled` | Gray 100 | Gray 800 |

##### Secondary

| Token | Light mode | Dark mode |
|---|---|---|
| `background/secondary/default` | Illusion 400 | Illusion 600 |
| `background/secondary/hover` | Illusion 500 | Illusion 700 |
| `background/secondary/active` | Illusion 500 | Illusion 700 |
| `background/secondary/light` | Illusion 100 | Illusion 900 |
| `background/secondary/light/hover` | Illusion 200 | Illusion 1000 |
| `background/secondary/light/active` | Illusion 200 | Illusion 1000 |
| `background/secondary/disabled` | Gray 100 | Gray 800 |

##### Success

| Token | Light mode | Dark mode |
|---|---|---|
| `background/success/default` | Green 500 | Green 600 |
| `background/success/hover` | Green 600 | Green 700 |
| `background/success/active` | Green 600 | Green 700 |
| `background/success/light` | Green 100 | Green 900 |
| `background/success/light/hover` | Green 200 | Green 1000 |
| `background/success/light/active` | Green 200 | Green 1000 |
| `background/success/disabled` | Gray 100 | Gray 800 |

##### Warning

| Token | Light mode | Dark mode |
|---|---|---|
| `background/warning/default` | Yellow 400 | Yellow 600 |
| `background/warning/hover` | Yellow 500 | Yellow 700 |
| `background/warning/active` | Yellow 500 | Yellow 700 |
| `background/warning/light` | Yellow 100 | Yellow 900 |
| `background/warning/light/hover` | Yellow 200 | Yellow 1000 |
| `background/warning/light/active` | Yellow 200 | Yellow 1000 |
| `background/warning/disabled` | Gray 100 | Gray 800 |

##### Danger

| Token | Light mode | Dark mode |
|---|---|---|
| `background/danger/default` | Red 500 | Red 600 |
| `background/danger/hover` | Red 600 | Red 700 |
| `background/danger/active` | Red 600 | Red 700 |
| `background/danger/light` | Red 100 | Red 900 |
| `background/danger/light/hover` | Red 200 | Red 1000 |
| `background/danger/light/active` | Red 200 | Red 1000 |
| `background/danger/disabled` | Gray 100 | Gray 800 |

##### Info

| Token | Light mode | Dark mode |
|---|---|---|
| `background/info/default` | Blue 500 | Blue 600 |
| `background/info/hover` | Blue 600 | Blue 700 |
| `background/info/active` | Blue 600 | Blue 700 |
| `background/info/light` | Blue 100 | Blue 900 |
| `background/info/light/hover` | Blue 200 | Blue 1000 |
| `background/info/light/active` | Blue 200 | Blue 1000 |
| `background/info/disabled` | Gray 100 | Gray 800 |

#### 2.3.2 Texts

Text token มี 3 states ต่อ role: `default`, `on/light`, `disabled`

| Token | Light mode | Dark mode |
|---|---|---|
| `text/default/default` | Gray 900 | Gray 200 |
| `text/default/on/light` | Gray 600 | Gray 400 |
| `text/default/disabled` | Gray 400 | Gray 500 |
| `text/primary/default` | Pigeon 1000 | Pigeon 200 |
| `text/primary/on/light` | Pigeon 800 | Pigeon 400 |
| `text/primary/disabled` | Gray 400 | Gray 500 |
| `text/secondary/default` | Illusion 1000 | Illusion 200 |
| `text/secondary/on/light` | Illusion 800 | Illusion 400 |
| `text/secondary/disabled` | Gray 400 | Gray 500 |
| `text/success/default` | Green 100 | Green 100 |
| `text/success/on/light` | Green 800 | Green 400 |
| `text/success/disabled` | Gray 400 | Gray 500 |
| `text/warning/default` | Yellow 100 | Yellow 100 |
| `text/warning/on/light` | Yellow 800 | Yellow 400 |
| `text/warning/disabled` | Gray 400 | Gray 500 |
| `text/danger/default` | Red 100 | Red 100 |
| `text/danger/on/light` | Red 800 | Red 400 |
| `text/danger/disabled` | Gray 400 | Gray 500 |
| `text/info/default` | Blue 100 | Blue 100 |
| `text/info/on/light` | Blue 800 | Blue 400 |
| `text/info/disabled` | Gray 400 | Gray 500 |

> **เมื่อใช้:** `text/{role}/default` ใช้บนพื้นสี role นั้น (เช่น text ขาวบนปุ่ม danger), `text/{role}/on/light` ใช้บนพื้นอ่อน/ขาว (เช่น text แดงเข้มบนพื้น light), `text/{role}/disabled` ใช้กับสถานะ disabled

#### 2.3.3 Icons

Icon token mapping เหมือน Text ทุกประการ (`default`, `on/light`, `disabled`)

| Token | Light mode | Dark mode |
|---|---|---|
| `icon/default/default` | Gray 900 | Gray 200 |
| `icon/default/on/light` | Gray 600 | Gray 400 |
| `icon/default/disabled` | Gray 400 | Gray 500 |
| `icon/primary/default` | Pigeon 1000 | Pigeon 200 |
| `icon/primary/on/light` | Pigeon 800 | Pigeon 400 |
| `icon/primary/disabled` | Gray 400 | Gray 500 |
| `icon/secondary/default` | Illusion 1000 | Illusion 200 |
| `icon/secondary/on/light` | Illusion 800 | Illusion 400 |
| `icon/secondary/disabled` | Gray 400 | Gray 500 |
| `icon/success/default` | Green 100 | Green 100 |
| `icon/success/on/light` | Green 800 | Green 400 |
| `icon/success/disabled` | Gray 400 | Gray 500 |
| `icon/warning/default` | Yellow 100 | Yellow 100 |
| `icon/warning/on/light` | Yellow 800 | Yellow 400 |
| `icon/warning/disabled` | Gray 400 | Gray 500 |
| `icon/danger/default` | Red 100 | Red 100 |
| `icon/danger/on/light` | Red 800 | Red 400 |
| `icon/danger/disabled` | Gray 400 | Gray 500 |
| `icon/info/default` | Blue 100 | Blue 100 |
| `icon/info/on/light` | Blue 800 | Blue 400 |
| `icon/info/disabled` | Gray 400 | Gray 500 |

> Icon ใช้ `currentColor` ในโค้ดเสมอ — ไอคอนจะ inherit สีจาก parent text color อัตโนมัติ ไม่ต้อง hardcode

#### 2.3.4 Borders

Border token mapping ใช้สีเข้มกว่า text/icon เล็กน้อย เพื่อให้เส้นแบ่งชัด

| Token | Light mode | Dark mode |
|---|---|---|
| `border/default/default` | Gray 300 | Gray 700 |
| `border/default/on/light` | Gray 500 | Gray 600 |
| `border/default/disabled` | Gray 400 | Gray 600 |
| `border/primary/default` | Pigeon 400 | Pigeon 500 |
| `border/primary/on/light` | Pigeon 400 | Pigeon 800 |
| `border/primary/disabled` | Gray 400 | Gray 600 |
| `border/secondary/default` | Illusion 400 | Illusion 500 |
| `border/secondary/on/light` | Illusion 400 | Illusion 800 |
| `border/secondary/disabled` | Gray 400 | Gray 600 |
| `border/success/default` | Green 400 | Green 500 |
| `border/success/on/light` | Green 400 | Green 800 |
| `border/success/disabled` | Gray 400 | Gray 600 |
| `border/warning/default` | Yellow 400 | Yellow 500 |
| `border/warning/on/light` | Yellow 400 | Yellow 800 |
| `border/warning/disabled` | Gray 400 | Gray 600 |
| `border/danger/default` | Red 400 | Red 500 |
| `border/danger/on/light` | Red 400 | Red 800 |
| `border/danger/disabled` | Gray 400 | Gray 600 |
| `border/info/default` | Blue 400 | Blue 500 |
| `border/info/on/light` | Blue 400 | Blue 800 |
| `border/info/disabled` | Gray 400 | Gray 600 |

### 2.4 Example usage

ตัวอย่างการใช้ semantic tokens กับ Button component:

#### Primary button (default state)

```
┌─────────────────────────────┐
│  🔵 Button  🔵             │  ← background: background/primary/default (Pigeon 400)
└─────────────────────────────┘     text:       text/primary/default (Pigeon 1000)
                                    icon:       icon/primary/default (Pigeon 1000)
                                    border:     border/primary/default (Pigeon 400)
```

#### Primary button (light variant)

```
┌─────────────────────────────┐
│  🔵 Button  🔵             │  ← background: background/primary/light (Pigeon 100)
└─────────────────────────────┘     text:       text/primary/on/light (Pigeon 800)
                                    icon:       icon/primary/on/light (Pigeon 800)
                                    border:     border/primary/on/light (Pigeon 400)
```

**กฎการ pair ที่ใช้ตลอดทั้งระบบ:**

| Surface | Text/Icon | Border |
|---|---|---|
| `background/{role}/default` | `text/{role}/default` (สีอ่อน) | `border/{role}/default` |
| `background/{role}/light` | `text/{role}/on/light` (สีเข้ม) | `border/{role}/on/light` |
| `background/{role}/disabled` | `text/{role}/disabled` | `border/{role}/disabled` |

#### Token reference chain (ตัวอย่าง)

```
Component (Button)
  └─ uses background/primary/default
       └─ references Pigeon 400 (light mode)
            └─ value: #9BB0DE (155, 176, 222)
       └─ references Pigeon 600 (dark mode)
            └─ value: #6978C2 (105, 120, 194)
```

### Developer notes

#### Token structure (Style Dictionary friendly)

```yaml
# Primitives
color:
  pigeon:
    100: "#E7EFF8"
    200: "#D3E0F2"
    # ...
    1000: "#252941"
  illusion: { 100: "#FAEDF3", ..., 1000: "#45121D" }
  gray:     { 100: "#F5F5F5", ..., 1000: "#121212" }
  green:    { 100: "#ECFEF4", ..., 1000: "#042F1A" }
  yellow:   { 100: "#FFFBEB", ..., 1000: "#461802" }
  red:      { 100: "#FFEBEB", ..., 1000: "#4A0605" }
  blue:     { 100: "#EBF5FF", ..., 1000: "#06294B" }

# Semantic — Light mode
background:
  primary:
    default: { value: "{color.pigeon.400}" }
    hover:   { value: "{color.pigeon.500}" }
    light:   { value: "{color.pigeon.100}" }
    # ...
```

#### CSS variables (Light + Dark mode)

```css
:root {
  /* ── Primitives — Pigeon ──────── */
  --color-pigeon-100: #E7EFF8;
  --color-pigeon-200: #D3E0F2;
  --color-pigeon-300: #ABC2E5;
  --color-pigeon-400: #9BB0DE;
  --color-pigeon-500: #8296D2;
  --color-pigeon-600: #6978C2;
  --color-pigeon-700: #5864AA;
  --color-pigeon-800: #49548A;
  --color-pigeon-900: #40496F;
  --color-pigeon-1000: #252941;

  /* (ทำซ้ำสำหรับ tower, lilac, illusion, gray, green, yellow, red, blue) */

  /* ── Semantic — Light mode (default) ──────── */
  --bg-default:        var(--color-white-1000);
  --bg-default-light:  var(--color-gray-100);
  --bg-primary:        var(--color-pigeon-400);
  --bg-primary-hover:  var(--color-pigeon-500);
  --bg-primary-light:  var(--color-pigeon-100);

  --text-default:      var(--color-gray-900);
  --text-on-light:     var(--color-gray-600);
  --text-primary:      var(--color-pigeon-1000);

  --border-default:    var(--color-gray-300);
  --border-primary:    var(--color-pigeon-400);
}

/* ── Semantic — Dark mode (override) ──────── */
[data-theme="dark"] {
  --bg-default:        var(--color-gray-900);
  --bg-default-light:  var(--color-gray-800);
  --bg-primary:        var(--color-pigeon-600);
  --bg-primary-hover:  var(--color-pigeon-700);
  --bg-primary-light:  var(--color-pigeon-900);

  --text-default:      var(--color-gray-200);
  --text-on-light:     var(--color-gray-400);
  --text-primary:      var(--color-pigeon-200);

  --border-default:    var(--color-gray-700);
  --border-primary:    var(--color-pigeon-500);
}
```

> **กฎสำหรับ dev:** ใน component ให้ใช้ **semantic token เท่านั้น** (`var(--bg-primary)`) **ห้ามใช้ primitive โดยตรง** (`var(--color-pigeon-400)`) เพราะจะทำให้สลับ theme ไม่ได้

---

## 3. Typography

> Source: Style guide → Typography
> Figma: [Font family](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=69-1687) · [Text style](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=71-1967)

### 3.1 Font family

ระบบใช้ฟอนต์เดียวคือ **Poppins** สำหรับทุกข้อความทั้งระบบ

#### Specs

| Property | Value |
|---|---|
| Font family | Poppins |
| Glyph support | `A–Z`, `a–z`, `0–9`, `!@#$%^&*()` |
| Available weights | Light (300), Regular (400), Semibold (600), Bold (700) |
| Fallback stack | `'Poppins', system-ui, -apple-system, sans-serif` |

#### Weight scale

| Token | Value | Use |
|---|---|---|
| Light | 300 | Display only (decorative, oversized) |
| Regular | 400 | Body, Subtitle, Subheading, Caption |
| Semibold | 600 | Title, Heading, emphasis variants |
| Bold | 700 | Display only (reserved) |

> Weight ที่ใช้จริงในระบบ text style คือ **Regular (400)** กับ **Semibold (600)** เป็นหลัก Light/Bold โชว์ไว้บนหน้า Font family เพื่อบอกว่า "พร้อมใช้" หากต้องการ display treatment เพิ่มเติม

#### Developer notes

```css
:root {
  --font-family-base: 'Poppins', system-ui, -apple-system, sans-serif;

  --font-weight-light:    300;
  --font-weight-regular:  400;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;
}
```

โหลด Poppins จาก Google Fonts หรือ self-host (woff2) ที่ weights 300/400/600/700

### 3.2 Text style

ระบบ text style แบ่งเป็น **4 หมวด** ตาม role: **Title**, **Heading**, **Body**, **Caption** รวม **22 styles** ทุกตัวใช้ Poppins, line-height 100% (ยกเว้น Title-7xl ที่ 130%)

#### Overview

| Role | Size range | Styles | ใช้สำหรับ |
|---|---|---|---|
| Title | 24–72 px | 7 | Hero, page title, display text |
| Heading | 16–30 px | 6 | Section header, card title, panel header |
| Body | 14–20 px | 7 | Paragraph, list, form text |
| Caption | 12 px | 2 | Metadata, timestamp, footnote |

#### 3.2.1 Title — 24 px ถึง 72 px

| Token | Weight | Size | Line-height | Letter-spacing |
|---|---|---|---|---|
| `Title/Title-7xl-Semibold` | SemiBold (600) | 72 | 130% | -3 |
| `Title/Title-6xl-Semibold` | SemiBold (600) | 60 | 100% | -2 |
| `Title/Title-5xl-Semibold` | SemiBold (600) | 48 | 100% | -2 |
| `Title/Title-4xl-Semibold` | SemiBold (600) | 36 | 100% | -2 |
| `Title/Subtitle-4xl-Regular` | Regular (400) | 36 | 100% | 0 |
| `Title/Subtitle-3xl-Regular` | Regular (400) | 30 | 100% | 0 |
| `Title/Subtitle-2xl-Regular` | Regular (400) | 24 | 100% | 0 |

> Title-7xl เป็น style เดียวที่ line-height ไม่ใช่ 100% (เป็น 130%) เพื่อให้หายใจที่ขนาดใหญ่

#### 3.2.2 Heading — 16 px ถึง 30 px

| Token | Weight | Size | Line-height | Letter-spacing |
|---|---|---|---|---|
| `Heading/Heading-3xl-Semibold` | SemiBold (600) | 30 | 100% | -2 |
| `Heading/Heading-2xl-Semibold` | SemiBold (600) | 24 | 100% | -2 |
| `Heading/Heading-xl-Semibold` | SemiBold (600) | 20 | 100% | -2 |
| `Heading/Subheading-2xl-Regular` | Regular (400) | 24 | 100% | 0 |
| `Heading/Subheading-xl-Regular` | Regular (400) | 20 | 100% | 0 |
| `Heading/Subheading-md-Regular` | Regular (400) | 16 | 100% | 0 |

#### 3.2.3 Body — 14 px ถึง 20 px

| Token | Weight | Size | Line-height | Letter-spacing | Decoration |
|---|---|---|---|---|---|
| `Body/Body-xl-Semibold` | SemiBold (600) | 20 | 100% | 0 | — |
| `Body/Body-xl-Regular` | Regular (400) | 20 | 100% | 0 | — |
| `Body/Body-md-Semibold` | SemiBold (600) | 16 | 100% | 0 | — |
| `Body/Body-md-Regular` | Regular (400) | 16 | 100% | 0 | — |
| `Body/Body-sm-Srmibold` ⚠ | SemiBold (600) | 14 | 100% | 0 | — |
| `Body/Body-sm-Regular` | Regular (400) | 14 | 100% | 0 | — |
| `Body/BodyLink-sm-Regular` | Regular (400) | 14 | 100% | 0 | **underline** |

> ⚠ Token `Body/Body-sm-Srmibold` พิมพ์ผิดใน Figma (ควรเป็น `Semibold`) ในโค้ดให้ alias เป็น `body-sm-semibold` เพื่อไม่ให้ typo หลุดไป

#### 3.2.4 Caption — 12 px

| Token | Weight | Size | Line-height | Letter-spacing |
|---|---|---|---|---|
| `Caption/Caption-xs-Semibold` | SemiBold (600) | 12 | 100% | 0 |
| `Caption/Caption-xs-Regular` | Regular (400) | 12 | 100% | 0 |

#### Role meanings

| Role | When to use |
|---|---|
| **Title** | Page-level display — hero, marketing headline, large numerical readout (Semibold พร้อม letter-spacing ติดลบ) |
| **Subtitle** | Supporting text ใต้ Title — น้ำหนักเบากว่า, tracking ปกติ |
| **Heading** | Section/component header — card title, panel header, dialog title |
| **Subheading** | Supporting text ใต้ Heading หรือ label สำหรับกลุ่มย่อย |
| **Body** | Default running text — paragraph, list, form helper. `BodyLink-sm` คือ inline link variant |
| **Caption** | ขนาดเล็กที่สุด — metadata, timestamp, image caption, table footnote |

#### Token reference graph (ตัวอย่าง)

```
Title/Title-7xl-Semibold
  ├─ fontFamily    → Title/Font family       ("Poppins")
  ├─ style         → SemiBold
  ├─ fontSize      → Title/Size-7xl           (72)
  ├─ fontWeight    → Title/Font Weight        (600)
  ├─ lineHeight    → 1.3                      (literal — style เดียวที่ไม่ใช่ 100%)
  └─ letterSpacing → -3

Heading/Heading-2xl-Semibold
  ├─ fontFamily    → Heading/Font Family      ("Poppins")
  ├─ fontSize      → Subtitle/Size-2xl        (24)  ← cross-role alias
  ├─ fontWeight    → Heading/Font Weight      (600)
  ├─ lineHeight    → 100
  └─ letterSpacing → -2
```

> Cross-role size aliases เป็นเรื่องตั้งใจ: `Heading-2xl` ใช้ `Subtitle/Size-2xl` token เดียวกัน เพื่อให้ "อะไรก็ตามที่ 24 px" sync กันทั้งระบบ

#### Developer notes

```css
:root {
  /* Size scale */
  --font-size-xs:   12px;  /* Caption */
  --font-size-sm:   14px;  /* Body-sm */
  --font-size-md:   16px;  /* Body-md, Subheading-md */
  --font-size-xl:   20px;  /* Body-xl, Heading-xl, Subheading-xl */
  --font-size-2xl:  24px;  /* Subtitle-2xl, Heading-2xl, Subheading-2xl */
  --font-size-3xl:  30px;  /* Subtitle-3xl, Heading-3xl */
  --font-size-4xl:  36px;  /* Title-4xl, Subtitle-4xl */
  --font-size-5xl:  48px;  /* Title-5xl */
  --font-size-6xl:  60px;  /* Title-6xl */
  --font-size-7xl:  72px;  /* Title-7xl */
}

/* ตัวอย่าง utility classes */
.text-title-7xl-semibold {
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-semibold);
  font-size:   var(--font-size-7xl);
  line-height: 1.3;
  letter-spacing: -3px;
}

.text-heading-2xl-semibold {
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-semibold);
  font-size:   var(--font-size-2xl);
  line-height: 1;
  letter-spacing: -2px;
}

.text-body-md-regular {
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-regular);
  font-size:   var(--font-size-md);
  line-height: 1;
}
```

> **Heads-up:** ทุก style ใน Figma ใช้ line-height 100% เพราะ design มี text ส่วนใหญ่เป็นบรรทัดเดียว ถ้า render multi-line ให้ override locally — Body 1.5, Heading 1.3, Title (≤5xl) 1.2

---

## 4. Layout & Spacing

> Source: Style guide → Space & radius
> Figma: [Space](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=73-6080)

Section นี้ครอบคลุม **Space tokens** สำหรับ padding/margin/gap ทั้งหมดใช้หน่วย px

(สำหรับ Radius ดูที่ [§6 Shapes (Radius)](#6-shapes-radius))

### 4.1 Space

Space tokens ใช้สูตร: **ค่า px = token number ÷ 25** (เช่น `Space-400` = 400/25 = 16 px)

มีทั้งหมด **21 tokens** แบ่งเป็น positive 16 ตัว และ negative 5 ตัว

#### 4.1.1 Positive scale

| Token | Value (px) | ใช้สำหรับ |
|---|---|---|
| `Space-0` | 0 | ตัด spacing ออก |
| `Space-050` | 2 | hairline gap, fine adjustment |
| `Space-100` | 4 | gap ระหว่าง element เล็ก |
| `Space-150` | 6 | gap ระหว่างกลาง |
| `Space-200` | 8 | icon ↔ label gap, chip padding |
| `Space-300` | 12 | compact padding |
| `Space-400` | 16 | inner card padding, default form gap |
| `Space-600` | 24 | section padding |
| `Space-800` | 32 | group separator |
| `Space-1000` | 40 | sub-section separator |
| `Space-1200` | 48 | large group separator |
| `Space-1600` | 64 | hero inner padding |
| `Space-2000` | 80 | page gutter, section separator |
| `Space-2400` | 96 | large section separator |
| `Space-4000` | 160 | hero vertical rhythm |

> **ข้อสังเกต:** scale ไม่ใช่ linear แบบ Tailwind (ที่เพิ่มทีละ 4) แต่เป็น **modular scale** ที่ขยับขึ้นเร็วขึ้นเรื่อยๆ เช่น 16 → 24 → 32 → 40 → 48 → 64 ทำให้มีความหลากหลายของระยะที่ใช้งานจริง

#### 4.1.2 Negative scale

Negative scale ใช้สำหรับสร้าง overlap, offset, หรือดึงขอบเข้าหากัน (เช่น shadow spread negative, container outdent, element ที่ต้องยื่นออกนอก parent)

| Token | Value (px) | ใช้สำหรับ |
|---|---|---|
| `Space-negative-100` | -4 | shadow inset/spread, small overlap |
| `Space-negative-200` | -6 | medium spread |
| `Space-negative-300` | -8 | shadow spread (ใช้ใน `Dropshadow/600`), button overlap |
| `Space-negative-400` | -16 | large outdent |
| `Space-negative-600` | -24 | hero element overlap |

> Negative scale **ไม่ได้ mirror positive ทุกค่า** — มีแค่ 5 step ที่ใช้บ่อยที่สุดเท่านั้น ถ้าต้องการ negative value อื่นๆ ใช้ positive token เดิมแล้ว negate เอง (เช่น `calc(-1 * var(--space-200))`)

### Developer notes

#### CSS variables

```css
:root {
  /* ── Space — Positive ──────── */
  --space-0:     0;
  --space-050:   2px;
  --space-100:   4px;
  --space-150:   6px;
  --space-200:   8px;
  --space-300:   12px;
  --space-400:   16px;
  --space-600:   24px;
  --space-800:   32px;
  --space-1000:  40px;
  --space-1200:  48px;
  --space-1600:  64px;
  --space-2000:  80px;
  --space-2400:  96px;
  --space-4000:  160px;

  /* ── Space — Negative ──────── */
  --space-negative-100: -4px;
  --space-negative-200: -6px;
  --space-negative-300: -8px;
  --space-negative-400: -16px;
  --space-negative-600: -24px;
}
```

#### Tailwind preset

```js
// tailwind.config.js (excerpt)
module.exports = {
  theme: {
    extend: {
      spacing: {
        0: '0',
        '050': '2px',
        100: '4px',
        150: '6px',
        200: '8px',
        300: '12px',
        400: '16px',
        600: '24px',
        800: '32px',
        1000: '40px',
        1200: '48px',
        1600: '64px',
        2000: '80px',
        2400: '96px',
        4000: '160px',
      },
    },
  },
};
```

#### Usage examples

```css
/* Card */
.card {
  padding: var(--space-400);    /* 16 px */
  gap:     var(--space-200);    /* 8 px */
}

/* Page container */
.container {
  padding-inline: var(--space-2000);  /* 80 px gutter */
  max-width: 1440px;
  margin-inline: auto;
}

/* Button padding */
.button {
  padding: var(--space-200) var(--space-400);  /* 8 / 16 */
}

/* Overlap badge (negative space) */
.badge-overlap {
  margin-top: var(--space-negative-300);  /* -8 px, ดึงขึ้นทับขอบ */
}
```

#### กฎสำคัญ

1. **ห้ามใช้ค่า px ตรงๆ** เช่น `padding: 10px` — ให้ใช้ token ที่ใกล้เคียงที่สุดเสมอ (10 px → ใช้ `Space-300` 12 px หรือ `Space-200` 8 px)
2. **ห้ามใช้ negative ที่ไม่ได้อยู่ใน scale** เช่นต้องการ -12 px ให้ใช้ `calc(-1 * var(--space-300))` แทนการสร้าง token ใหม่

---

## 5. Elevation & Depth

> Source: Effects → Shadow → Drop shadow
> Figma: [Shadow](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=82-5785)

### 5.1 Concept

หน้าจอเป็นพื้นแบน 2D แต่ UI ที่ดีต้องสื่อ "ความสูง" ของ element เพื่อบอกลำดับชั้น (z-axis) เช่น modal ลอยทับ page, dropdown ลอยทับ button, tooltip ลอยทับทุกอย่าง

- **Elevation** = ระดับความสูง (concept)
- **Depth** = ความลึกที่แสดงผ่าน drop shadow (visual)

ระบบ Moldable ใช้ **multi-layer drop shadow** (เงาซ้อนหลายชั้น) เพื่อสร้างความรู้สึกธรรมชาติ — เงาใกล้ + เงาไกล ทำให้รู้สึกว่า element ลอยจริงๆ ไม่ใช่แค่มี outline

ระบบมี **shadow scale 6 ระดับ** (`Dropshadow/100` ถึง `Dropshadow/600`) โดยยิ่งเลขสูง element ยิ่งลอยสูงและเงายิ่งเข้ม

### 5.2 Depth primitives

ค่า primitive สำหรับใช้สร้าง offset/radius/spread ของ shadow ทุกตัว ใช้หน่วย px

| Token | Value (px) |
|---|---|
| `depth-negative-200` | -8 |
| `depth-negative-100` | -4 |
| `depth-negative-025` | -1 |
| `depth-0` | 0 |
| `depth-025` | 1 |
| `depth-100` | 4 |
| `depth-200` | 8 |
| `depth-400` | 16 |
| `depth-800` | 32 |

> Negative depth ใช้กับ `spread` ของ shadow เพื่อ "หด" เงาให้แคบกว่า element (ทำให้เงาดูเหมือนแสงตกลงด้านล่างจริงๆ ไม่ใช่ halo รอบ element)

### 5.3 Shadow colors

ใช้ฐานสี `#0C0D0D` (ดำเกือบสนิท ออกน้ำเงินอ่อนๆ) ปรับ alpha ตามระดับ shadow ที่ต้องการ — **ไม่ใช้ pure black** เพราะจะทำให้เงาดูแข็ง

| Token | HEX (8-digit) | RGBA | Alpha |
|---|---|---|---|
| `Black/100` | `#0C0D0D0D` | `rgba(12, 13, 13, 0.05)` | 5% |
| `Black/200` | `#0C0D0D1A` | `rgba(12, 13, 13, 0.10)` | 10% |
| `Black/300` | `#0C0D0D33` | `rgba(12, 13, 13, 0.20)` | 20% |
| `Black/400` | `#0C0D0D66` | `rgba(12, 13, 13, 0.40)` | 40% |

### 5.4 Dropshadow tokens

มี 6 tokens — ส่วนใหญ่เป็น **2 layer** ซ้อนกัน (เงาใกล้คม + เงาไกลฟุ้ง) ยกเว้น `Dropshadow/100` กับ `Dropshadow/600` ที่เป็น single layer

| Token | Layers | Offset Y / Blur / Spread / Color | ใช้สำหรับ |
|---|---|---|---|
| `Dropshadow/100` | 1 | `0 1 4 0` · Black/200 | Subtle lift — flat card, list item hover, button rest |
| `Dropshadow/200` | 2 | `0 1 4 0` · Black/200<br>`0 1 8 0` · Black/100 | Resting card, segmented control |
| `Dropshadow/300` | 2 | `0 4 4 -1` · Black/100<br>`0 4 16 -1` · Black/200 | Raised card, button hover, dropdown trigger |
| `Dropshadow/400` | 2 | `0 4 4 -4` · Black/100<br>`0 16 32 -4` · Black/200 | Floating panel, dropdown menu, popover |
| `Dropshadow/500` | 2 | `0 4 4 -4` · Black/100<br>`0 16 16 -8` · Black/300 | Modal, sticky header lifted, sheet |
| `Dropshadow/600` | 1 | `0 16 32 -8` · Black/400 | Toast, top-most overlay, hero element |

> **อ่าน offset/blur/spread อย่างไร:** `0 4 16 -1` = offset-x 0, offset-y 4 px, blur 16 px, spread -1 px

#### Token reference chain (ตัวอย่าง `Dropshadow/400`)

```
Dropshadow/400
  ├─ Layer 1 (เงาใกล้, คม)
  │    color:  Black/100   (rgba 12,13,13,0.05)
  │    offset: (0, depth-100)        → (0, 4 px)
  │    radius: depth-100              → 4 px blur
  │    spread: depth-negative-100     → -4 px
  │
  └─ Layer 2 (เงาไกล, ฟุ้ง)
       color:  Black/200   (rgba 12,13,13,0.10)
       offset: (0, depth-400)        → (0, 16 px)
       radius: depth-800              → 32 px blur
       spread: depth-negative-100     → -4 px
```

### Developer notes

#### CSS variables

```css
:root {
  /* ── Depth primitives ──────── */
  --depth-negative-200: -8px;
  --depth-negative-100: -4px;
  --depth-negative-025: -1px;
  --depth-0:    0;
  --depth-025:  1px;
  --depth-100:  4px;
  --depth-200:  8px;
  --depth-400:  16px;
  --depth-800:  32px;

  /* ── Shadow colors ──────── */
  --shadow-black-100: rgba(12, 13, 13, 0.05);
  --shadow-black-200: rgba(12, 13, 13, 0.10);
  --shadow-black-300: rgba(12, 13, 13, 0.20);
  --shadow-black-400: rgba(12, 13, 13, 0.40);

  /* ── Dropshadow tokens ──────── */
  --shadow-100: 0 1px 4px 0 var(--shadow-black-200);
  --shadow-200:
    0 1px 4px 0 var(--shadow-black-200),
    0 1px 8px 0 var(--shadow-black-100);
  --shadow-300:
    0 4px 4px -1px var(--shadow-black-100),
    0 4px 16px -1px var(--shadow-black-200);
  --shadow-400:
    0 4px 4px -4px var(--shadow-black-100),
    0 16px 32px -4px var(--shadow-black-200);
  --shadow-500:
    0 4px 4px -4px var(--shadow-black-100),
    0 16px 16px -8px var(--shadow-black-300);
  --shadow-600: 0 16px 32px -8px var(--shadow-black-400);
}
```

#### Tailwind preset

```js
// tailwind.config.js (excerpt)
module.exports = {
  theme: {
    extend: {
      boxShadow: {
        100: '0 1px 4px 0 rgba(12,13,13,0.10)',
        200: '0 1px 4px 0 rgba(12,13,13,0.10), 0 1px 8px 0 rgba(12,13,13,0.05)',
        300: '0 4px 4px -1px rgba(12,13,13,0.05), 0 4px 16px -1px rgba(12,13,13,0.10)',
        400: '0 4px 4px -4px rgba(12,13,13,0.05), 0 16px 32px -4px rgba(12,13,13,0.10)',
        500: '0 4px 4px -4px rgba(12,13,13,0.05), 0 16px 16px -8px rgba(12,13,13,0.20)',
        600: '0 16px 32px -8px rgba(12,13,13,0.40)',
      },
    },
  },
};
```

#### Usage examples

```css
/* Card at rest */
.card {
  box-shadow: var(--shadow-200);
}

/* Card on hover (ยกขึ้น) */
.card:hover {
  box-shadow: var(--shadow-300);
}

/* Dropdown menu */
.dropdown {
  box-shadow: var(--shadow-400);
}

/* Modal */
.modal {
  box-shadow: var(--shadow-500);
}

/* Toast notification */
.toast {
  box-shadow: var(--shadow-600);
}
```

#### กฎสำคัญ

1. **เลือก shadow ตาม semantic ของ element ไม่ใช่ตามความสวย** — ใช้ `Dropshadow/200` กับทุก card, `Dropshadow/400` กับทุก dropdown ไม่ใช่เลือกตามใจชอบ เพื่อให้ลำดับชั้นใน UI สม่ำเสมอกัน
2. **ห้ามใช้ pure black shadow** (`rgba(0,0,0,...)`) — ระบบใช้ `#0C0D0D` เพื่อให้เงานุ่มและกลมกลืนกับ background
3. **ใช้ token เท่านั้น** — ห้าม hardcode `box-shadow: 0 4px 16px ...` ใน component ให้อ้าง `var(--shadow-XXX)` เสมอ
4. **Hover/active state ขยับ shadow ขึ้นทีละ step** — เช่น card รอ `shadow-200` → hover `shadow-300` → active `shadow-200` (กลับลงเพื่อสื่อ "กด")

---

## 6. Shapes (Radius)

> Source: Style guide → Space & radius → Radius
> Figma: [Radius](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=73-6640)

Radius scale ใช้สำหรับ `border-radius` ทุก surface ในระบบ มีทั้งหมด **8 tokens** ครอบคลุมตั้งแต่ไม่มีมุมโค้งจนถึง pill shape

### 6.1 Radius scale

| Token | Value (px) | ใช้สำหรับ |
|---|---|---|
| `Radius-none` | 0 | sharp corner, table cell, divider |
| `Radius-sm` | 4 | chip, tag, small badge |
| `Radius-md` | 6 | compact input, small button |
| `Radius-lg` | 8 | button, input, small card |
| `Radius-xl` | 12 | medium card |
| `Radius-2xl` | 16 | sheet, drawer, large card |
| `Radius-3xl` | 24 | modal, hero panel |
| `Radius-full` | 999 | pill button, avatar, circular badge |

> `Radius-full` ใช้ค่า 999 px (ไม่ใช่ 9999 หรือ 50%) เพื่อให้ได้ pill shape บน element ที่ไม่ใช่สี่เหลี่ยมจัตุรัส (สี่เหลี่ยมจัตุรัสจะกลายเป็นวงกลมพอดี)

### Developer notes

#### CSS variables

```css
:root {
  --radius-none:  0;
  --radius-sm:    4px;
  --radius-md:    6px;
  --radius-lg:    8px;
  --radius-xl:    12px;
  --radius-2xl:   16px;
  --radius-3xl:   24px;
  --radius-full:  999px;
}
```

#### Tailwind preset

```js
// tailwind.config.js (excerpt)
module.exports = {
  theme: {
    extend: {
      borderRadius: {
        none:  '0',
        sm:    '4px',
        md:    '6px',
        lg:    '8px',
        xl:    '12px',
        '2xl': '16px',
        '3xl': '24px',
        full:  '999px',
      },
    },
  },
};
```

#### Usage examples

```css
/* Card */
.card {
  border-radius: var(--radius-xl);    /* 12 px */
}

/* Pill button */
.button-pill {
  border-radius: var(--radius-full);  /* 999 px → pill */
}

/* Circular avatar */
.avatar {
  width:  40px;
  height: 40px;
  border-radius: var(--radius-full);  /* สี่เหลี่ยมจัตุรัส → วงกลม */
}

/* Modal */
.modal {
  border-radius: var(--radius-3xl);   /* 24 px */
}
```

#### กฎสำคัญ

1. **Nested radius rule** — เมื่อ component ซ้อนกัน inner radius ควรเล็กกว่า outer ตามสัดส่วน padding เพื่อให้มุมขนานกัน:

   ```
   inner radius = outer radius − padding
   ```

   ตัวอย่าง: Card ใช้ `Radius-xl` (12) มี padding `Space-400` (16) → ปุ่มข้างในใช้ `Radius-lg` (8) จะได้มุมที่สมดุล

2. **ห้ามใช้ค่า px ตรงๆ** เช่น `border-radius: 10px` — ให้เลือก token ที่ใกล้ที่สุด (10 → `Radius-lg` 8 หรือ `Radius-xl` 12)

3. **Radius เดียวต่อ component** — ปุ่มในระบบเดียวกันควรใช้ radius เดียวกันทุกตัว (เว้นแต่จะเป็น variant ที่ตั้งใจ เช่น pill vs square)

---

## 7. Iconography

> Source: Style guide → Icons
> Figma: [Icon library](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=36-1942)

ระบบใช้ **Untitled UI line icon set** — เป็น icon library แนว outline ที่นิยมในวงการ design system

### 7.1 Icon library

ไอคอนทั้งหมดประมาณ **600 ตัว** แบ่งเป็น **19 หมวด** ที่ครอบคลุม use case ส่วนใหญ่ของ product UI

> Designer ดูไอคอนทั้งหมดได้ที่ Figma frame "Icon library" (ลิงก์ด้านบน) — design.md จะระบุเฉพาะหมวดและตัวอย่าง 1 ตัวต่อหมวด ไม่ list ครบทั้งหมดเพราะ Figma เป็น source of truth ที่อัปเดตเร็วกว่า

### 7.2 Style

| Property | Value |
|---|---|
| Style | Outline (line) icon เท่านั้น |
| Source viewBox | `0 0 24 24` (Figma) |
| Render viewBox | `0 0 16 16` (โค้ด) |
| Stroke width | `1.2` |
| Stroke linecap | `round` |
| Stroke linejoin | `round` |
| Fill | `none` (เป็น stroke ล้วน) |
| Stroke color | `currentColor` (inherit จาก text color) |

> **หมายเหตุเรื่อง viewBox:** Figma ออกแบบบน grid 24×24 แต่ component ใน code ใช้ viewBox 16×16 — เพราะ default render size เป็น 16 px (เท่า text body) อยู่แล้ว ถ้าต้องการขนาดอื่น override ด้วย className ได้

### 7.3 Sizing

ไอคอนใช้ Tailwind size utility ที่ map กับ Space token:

| Token | Size (px) | Use case |
|---|---|---|
| `size-3` | 12 | inline กับ Caption (12 px) |
| `size-4` | 16 | **default** — inline กับ Body-md |
| `size-5` | 20 | inline กับ Body-xl |
| `size-6` | 24 | icon-only button, list item |
| `size-8` | 32 | feature icon, empty state |
| `size-10` | 40 | hero icon, large feature |

> Default ของ `<Icon>` component คือ `size-4` (16 px) ทุกครั้งที่ render โดยไม่ override จะได้ขนาดนี้

### 7.4 Color

ไอคอนทุกตัวใช้ `stroke="currentColor"` → **inherit สีจาก parent text color อัตโนมัติ** ไม่ต้อง pass สีให้ component

```jsx
<div className="text-text-primary-default">
  <Icon name="Check" />  {/* ไอคอนได้สี text-primary-default ตามที่ parent กำหนด */}
</div>
```

สำหรับ semantic color tokens ดูที่ [§2.3.3 Icons](#233-icons) — มี token พร้อมใช้ทั้ง default / on-light / disabled สำหรับทุก role

### 7.5 Categories

19 หมวดของไอคอน พร้อมตัวอย่างหมวดละ 1 ตัว:

| หมวด | ใช้สำหรับ | ตัวอย่าง |
|---|---|---|
| **General** | ไอคอนทั่วไป (action, status, object พื้นฐาน) | `check` |
| **Arrows** | ลูกศร, chevron, navigation | `chevron-down` |
| **Charts** | กราฟทุกชนิด (bar / line / pie / trend) | `bar-chart-01` |
| **Users** | คน, avatar, emoji หน้า | `user-01` |
| **Communication** | message, mail, phone, annotation | `message-circle-01` |
| **Shapes** | รูปทรงเรขาคณิต (cube, dice, hexagon, star) | `star-01` |
| **Layout** | grid, layout, align, distribute | `layout-grid-01` |
| **Alerts & feedback** | alert, bell, notification, thumbs | `alert-circle` |
| **Media & devices** | camera, monitor, music, phone, speaker | `play` |
| **Development** | code, server, terminal, git, database | `terminal` |
| **Images** | image, camera, flash | `image-01` |
| **Files** | file, folder, clipboard, box | `folder` |
| **Security** | lock, shield, fingerprint, key | `lock-01` |
| **Finance & eCommerce** | bank, coin, credit-card, wallet, shopping | `credit-card-01` |
| **Editor** | bold, italic, brush, cursor, type, scissors | `pen-tool-01` |
| **Maps & travel** | car, flag, globe, map, marker-pin, train | `map-01` |
| **Time** | alarm, calendar, clock, hourglass | `clock` |
| **Weather** | cloud, sun, moon, snowflake, thermometer | `cloud-01` |
| **Education** | book, briefcase, certificate, graduation | `graduation-hat-01` |
| **Third party** | logo brand (social, tech) | `google`, `apple`, `tiktok` |

### 7.6 Naming convention

ไอคอนใช้ **3 รูปแบบชื่อ** ใน 3 บริบทที่ต่างกัน

| บริบท | รูปแบบ | ตัวอย่าง |
|---|---|---|
| **Figma component name** | kebab-case | `chevron-down` |
| **File name** ใน `icons/list/` | kebab-case + `.tsx` | `chevron-down.tsx` |
| **React component name** (export) | PascalCase | `ChevronDown` |
| **`<Icon name="..." />` prop** | PascalCase | `<Icon name="ChevronDown" />` |

#### Pattern ของชื่อไอคอน

| Pattern | ความหมาย | ตัวอย่าง |
|---|---|---|
| `name-01`, `name-02`, ... | visual variant ของไอคอนเดียวกัน | `building-01` ถึง `building-08` |
| `name-circle`, `name-square`, `name-hexagon` | ทรงนอก | `alert-circle`, `alert-square`, `alert-hexagon` |
| `name-broken` | versi ขาด/แตก | `arrow-circle-broken-down` |
| `name-add`, `name-check`, `name-minus`, `name-plus`, `name-x` | action ที่ผูกกับไอคอน | `bookmark-add`, `bookmark-check`, `bookmark-x` |
| `name-up`, `name-down`, `name-left`, `name-right`, `name-up-right` | ทิศทาง | `arrow-up`, `arrow-down-left` |
| `name-on`, `name-off` | สถานะ | `bluetooth-on`, `bluetooth-off` |

### Developer notes

#### โครงสร้างไฟล์

```
src/components/icons/
├── index.ts                  # export { Icon }
├── icon-elem.tsx             # <Icon name="..." /> wrapper component
├── icons-list.ts             # registry: map ชื่อ → component
├── icons-declare.tsx         # re-export ทุก SVG จาก list/
└── list/                     # ไฟล์ SVG รายตัว (kebab-case)
    ├── check.tsx
    ├── chevron-down.tsx
    └── ...
```

#### Icon component (icon-elem.tsx)

```tsx
"use client";

import { SVGProps, memo } from "react";
import { cn } from "@/lib/utils";
import { icons } from "./icons-list";

interface Props extends SVGProps<SVGSVGElement> {
  name: keyof typeof icons;
}

const Icon = ({ name, className, ...props }: Props) => {
  if (!icons[name]) {
    throw new Error(`Invalid icon: ${name}`);
  }

  const Component = icons[name];
  return (
    <Component
      strokeWidth={1.2}
      {...props}
      className={cn("size-4 text-current items-center", className)}
    />
  );
};

export default memo(Icon);
```

> **Note:** `name` ใช้ TypeScript `keyof typeof icons` → IDE auto-complete ครบทุกชื่อ และตรวจ typo ตอน compile

#### SVG file (list/check.tsx)

```tsx
import { SVGProps } from "react";

const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="none"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
      d="M13.3337 4L6.00033 11.3333L2.66699 8"
    />
  </svg>
);

export default SvgComponent;
```

#### Usage examples

```tsx
import { Icon } from "@/components/icons";

// ใช้แบบ default (size-4, สีตาม parent text)
<Icon name="Check" />

// ขนาดอื่น
<Icon name="ChevronDown" className="size-5" />

// บังคับสีเฉพาะ (override parent text color)
<Icon name="AlertCircle" className="text-text-danger-on-light size-6" />

// ใช้ใน button
<button className="text-text-primary-default">
  <Icon name="Plus" />
  Add item
</button>

// Icon-only button
<button aria-label="Close" className="text-text-default-default">
  <Icon name="XClose" className="size-5" />
</button>
```

#### การเพิ่มไอคอนใหม่

ต้องแก้ **3 ไฟล์** ตามลำดับ:

1. **เพิ่ม SVG file** ที่ `icons/list/{kebab-name}.tsx` (export default SVG)
2. **Declare ที่ `icons-declare.tsx`**

   ```ts
   export { default as PascalName } from "./list/kebab-name";
   ```

3. **Register ที่ `icons-list.ts`**

   ```ts
   import { ..., PascalName } from "./icons-declare";

   const list = {
     ...,
     PascalName,
   };
   ```

> หลังจาก register แล้ว TypeScript จะรู้จัก `<Icon name="PascalName" />` อัตโนมัติ — ไม่ต้อง declare type เพิ่ม

#### กฎสำคัญ

1. **ใช้ `<Icon name="..." />` เท่านั้น** ห้าม import SVG file ตรงๆ จาก `list/` — เพราะถ้า icon ถูก rename จะหาไม่เจอ ใช้ registry กลางทำให้ refactor ปลอดภัย
2. **สีไอคอนคุมผ่าน text color** ไม่ pass `stroke` หรือ `fill` prop — ใช้ Tailwind text utility (เช่น `text-text-danger-default`) แทน
3. **ขนาดผ่าน `size-*` class** — อย่าใช้ `width`/`height` prop เพราะจะหลุดจาก design system scale
4. **ไม่ใช้ไอคอนนอกชุด** — ถ้าต้องการไอคอนที่ไม่มี ขอเพิ่มเข้าระบบ (ทำตามขั้นตอน "การเพิ่มไอคอนใหม่") ห้าม inline SVG กระจัดกระจาย

---

## 8. Logo

> Source: Style guide → Icons → Logo
> Figma: [Logo](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=85-1485)

> ส่วน Appearance, Clear space, Do's & Don'ts และ Developer/Component API ดูที่ **Brand book** (อยู่นอก design system นี้)

### 8.1 Variants overview

ระบบ Logo จัดเป็น component set ที่มี **3 axes** รวมทั้งหมด **45 variants**

| Axis | Options | จำนวน |
|---|---|---|
| **Type** | Logo, Lockup + Horizontal, Lockup + Vertical | 3 |
| **Size** | Extra small, Small, Medium, Large, Extra large | 5 |
| **Appearance** | Brand, Black, White | 3 |

> รวม: 3 × 5 × 3 = **45 variants** ในไฟล์ Figma component set ชื่อ `Logo` (node `112:1621`)

### 8.2 Types

มี 3 รูปแบบหลัก แต่ละแบบใช้กับ context ต่างกัน

#### Logo (mark only)

ไอคอน mark อย่างเดียว สัดส่วน **1:1** (สี่เหลี่ยมจัตุรัส) ทุกขนาด

ใช้สำหรับ:
- App icon, favicon
- Avatar / profile placeholder
- Loading spinner
- พื้นที่แคบ ที่ wordmark จะอ่านไม่ออก

#### Lockup + Horizontal

Mark + wordmark วางแนวนอน (mark ซ้าย wordmark ขวา) สัดส่วนกว้างประมาณ **3.1:1** (เช่น 174×56 px)

ใช้สำหรับ:
- Header / nav bar
- Footer
- Email signature
- พื้นที่แนวนอน

#### Lockup + Vertical

Mark + wordmark วางแนวตั้ง (mark บน wordmark ล่าง) สัดส่วนเกือบ **1:1** (เช่น 110×113 px)

ใช้สำหรับ:
- Splash screen
- Business card
- Print material / poster
- พื้นที่สี่เหลี่ยมจัตุรัสที่ต้องการ wordmark

### 8.3 Sizes

ขนาดเพิ่มขึ้นทีละ 8 px (24 → 32 → 40 → 48 → 56) สอดคล้องกับ Space scale ของระบบ

| Size | Token | Logo (mark) | Lockup Horizontal | Lockup Vertical |
|---|---|---|---|---|
| Extra small | `xs` | 24 × 24 | 81 × 24 | 49 × 50 |
| Small | `sm` | 32 × 32 | 102 × 32 | 62 × 62 |
| Medium | `md` | 40 × 40 | 127 × 40 | 79 × 85 |
| Large | `lg` | 48 × 48 | 153 × 48 | 97 × 102 |
| Extra large | `xl` | 56 × 56 | 174 × 56 | 110 × 113 |

#### ข้อสังเกตเรื่องสัดส่วน

- **Logo (mark)** เป็นสี่เหลี่ยมจัตุรัสเป๊ะทุกขนาด (aspect ratio 1:1)
- **Lockup Horizontal** มี ratio คงที่ **≈ 3.1:1** ทุกขนาด (174÷56 = 3.107, 153÷48 = 3.188, 127÷40 = 3.175, 102÷32 = 3.188, 81÷24 = 3.375 — มีปรับเล็กน้อยตามขนาด)
- **Lockup Vertical** ratio ใกล้ 1:1 แต่สูงกว่ากว้างนิดหน่อย (110÷113 ≈ 0.97) เพราะ wordmark อยู่ใต้ mark

#### ขนาด Mark ใน Lockup

ใน Lockup ทั้งสองรูปแบบ ขนาดของ mark **เท่ากับ Logo (mark only)** ขนาดเดียวกัน:

| Lockup size | Mark ที่ฝัง |
|---|---|
| Lockup-xs | Logo 24 × 24 |
| Lockup-sm | Logo 32 × 32 |
| Lockup-md | Logo 40 × 40 |
| Lockup-lg | Logo 48 × 48 |
| Lockup-xl | Logo 56 × 56 |

> นั่นหมายความว่า "ขนาด Lockup" เรียกตามขนาดของ mark ที่อยู่ในนั้น ทำให้เลือก variant สอดคล้องกันได้ง่าย

---

## 9. Components

> Source: Components
> Figma: [Default Buttons](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=150-575)

Section นี้รวบรวม component ทั้งหมดของระบบ — กำลังขยายไปทีละ category ตอนนี้มีเฉพาะ **Actionable** components

### 9.1 Component philosophy

ทุก component ในระบบยึดหลักการเดียวกัน เพื่อให้สอดคล้องและ predictable:

1. **Token-driven** — component ไม่ hardcode สี/ขนาด/spacing ทุกค่าต้องอ้างอิง token จาก foundation (§2-§6) เพื่อให้สลับ theme และปรับขนาดทั้งระบบได้จากจุดเดียว
2. **State-aware** — component ที่ interactive ต้องมี state: `default`, `hover`, `active`, `disabled` อย่างน้อย (`focus` เพิ่มถ้าใช้กับ keyboard)
3. **Variant axes คงที่** — component ใช้ axes มาตรฐาน: **Color** (semantic role), **Variant** (visual style), **Size** (xs/sm/md/lg/xl), **State** เพื่อให้ดู spec เร็วและสร้าง permutation ครบ
4. **Composable** — component เล็ก (Icon, Text) ใช้ภายใน component ใหญ่ (Button, Card) ไม่ duplicate logic
5. **Accessible by default** — มี `aria-*`, keyboard navigation, focus visible, contrast ratio ที่ผ่าน WCAG AA

#### Naming convention ของ component variants

ทุก component ใช้ **4-axis pattern** (ไม่จำเป็นต้องครบทั้ง 4):

```
Color × Variant × Size × State
  ↓        ↓        ↓       ↓
Primary  Filled  Large  Default
```

ตัวอย่าง Figma variant name: `Color=Primary, Variant=Filled, Size=Large, State=Default`

### 9.2 Actionable

Components ที่ user "กดแล้วเกิด action" ได้:
- **Button** — ปุ่มหลัก พร้อม label
- **IconButton** — ปุ่มที่มีแค่ icon

#### 9.2.1 Button

ปุ่มหลักของระบบ ใช้สำหรับ action ที่มี label เช่น "Save", "Cancel", "Add item"

##### Anatomy

```
┌─────────────────────────────────┐
│  [iconStart?]  text  [iconEnd?] │
└─────────────────────────────────┘
       gap        text       gap
       8 px               8 px
```

| ส่วน | ขนาด | Optional |
|---|---|---|
| `iconStart` | 16 × 16 px | ✓ |
| `text` | Body-sm-Regular (14 px) | required |
| `iconEnd` | 16 × 16 px | ✓ |

> ปุ่มไม่จำเป็นต้องมี icon — มีได้ทั้งสองข้าง หรือมีข้างใดข้างหนึ่ง หรือไม่มีเลย

##### Variants

| Variant | ลักษณะ | ใช้สำหรับ |
|---|---|---|
| **Filled** | solid background + text สว่าง | Primary action ที่อยากให้เด่นที่สุด |
| **Outline** | border + text เข้ม + transparent bg | Secondary action ที่ต้องสมดุลกับ Filled |
| **Text** | ไม่มี border ไม่มี bg, text เข้มอย่างเดียว | Tertiary action, link-like, ปุ่มใน toolbar |

##### Sizes

| Size | Height | Padding (H × V) | Gap | Font | Icon |
|---|---|---|---|---|---|
| **Large** | 48 px | `space-300` × `space-400` (12 × 16) | `space-200` (8) | Body-sm (14) | 16 |
| **Medium** | 40 px | `space-300` ทุกด้าน (12) | `space-200` (8) | Body-sm (14) | 16 |
| **Small** | 32 px | `space-300` × `space-200` (12 × 8) | `space-200` (8) | Body-sm (14) | 16 |

> **ทุก size ใช้ font และ icon ขนาดเดียวกัน** (Body-sm 14 px + icon 16 px) — สิ่งที่เปลี่ยนคือแค่ padding เพื่อสร้างความสูงที่ต่างกัน

##### Border radius

ทุก size ทุก variant ใช้ `Radius-full` (999 px) → **pill button**

##### Colors

7 colors ตาม semantic role:

| Color | ใช้สำหรับ |
|---|---|
| `default` | neutral action ที่ไม่ผูกกับ semantic ใด |
| `primary` | brand primary action (เด่นที่สุด) |
| `secondary` | brand secondary action |
| `success` | confirm / complete (เช่น "Submit", "Approve") |
| `warning` | action ที่ต้องระวัง (เช่น "Continue anyway") |
| `danger` | destructive (เช่น "Delete", "Remove") |
| `info` | informational (เช่น "Learn more") |

##### States

| State | Trigger |
|---|---|
| `default` | สถานะปกติ |
| `hover` | mouse hover |
| `active` | กำลังกด (mouse down หรือ key down) |
| `disabled` | ปุ่มถูก disable |

> Figma ใช้คำว่า `Actived` (sic) ซึ่งคือ typo — ในโค้ดให้ใช้ชื่อมาตรฐาน `active`

##### Token mapping

###### Variant = Filled

| Color | Background | Text/Icon |
|---|---|---|
| Default | `background/default/light` | `text/default/on-light` |
| Primary | `background/primary/default` | `text/primary/default` |
| Secondary | `background/secondary/default` | `text/secondary/default` |
| Success | `background/success/default` | `text/success/default` |
| Warning | `background/warning/default` | `text/warning/default` |
| Danger | `background/danger/default` | `text/danger/default` |
| Info | `background/info/default` | `text/info/default` |

**State variations (Filled):**
- `hover` / `active`: `background/{role}/default-hover` (ยกเว้น `default` ใช้ `background/default/light-hover`)
- `disabled`: bg `#F5F5F5`, text/icon `#B3B3B3`

###### Variant = Outline

| Color | Background | Border | Text/Icon |
|---|---|---|---|
| Default | transparent | `border/default/on-light` | `text/default/on-light` |
| Primary | transparent | `border/primary/on-light` | `text/primary/on-light` |
| Secondary | transparent | `border/secondary/on-light` | `text/secondary/on-light` |
| Success | transparent | `border/success/on-light` | `text/success/on-light` |
| Warning | transparent | `border/warning/on-light` | `text/warning/on-light` |
| Danger | transparent | `border/danger/on-light` | `text/danger/on-light` |
| Info | transparent | `border/info/on-light` | `text/info/on-light` |

**State variations (Outline):**
- `hover` / `active`: bg เปลี่ยนเป็น `background/{role}/light-hover` (เติม tint บางๆ)
- `disabled`: bg `#F5F5F5`, border `#B3B3B3`, text/icon `#B3B3B3`

###### Variant = Text

| Color | Background | Text/Icon |
|---|---|---|
| All | transparent | `text/{role}/on-light` |

**State variations (Text):**
- `hover` / `active`: bg เปลี่ยนเป็น `background/{role}/light-hover`
- `disabled`: text/icon `#B3B3B3` (bg ยังคง transparent)

> **Pattern สำคัญ:** `Filled` ใช้ token `default` (สีเต็ม), `Outline` กับ `Text` ใช้ token `on-light` (สีเข้ม) เพราะ text/icon วางบนพื้นอ่อน

##### Border (Outline variant)

- Width: `1px` (`Stroke/Border 1`)
- Style: solid
- Color: `border/{role}/on-light`

##### Props API (suggested)

```tsx
interface ButtonProps {
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  variant?: 'filled' | 'outline' | 'text';
  size?: 'sm' | 'md' | 'lg';
  iconStart?: IconName;   // PascalCase ของชื่อไอคอนจาก icon registry
  iconEnd?: IconName;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
  children: React.ReactNode;
}
```

**Defaults:**
- `color = 'primary'`
- `variant = 'filled'`
- `size = 'md'`

##### Usage examples

```tsx
// Primary action
<Button color="primary" variant="filled" size="md">
  Save changes
</Button>

// Destructive action with icon
<Button color="danger" variant="filled" iconStart="Trash01">
  Delete
</Button>

// Secondary action (outline)
<Button color="primary" variant="outline">
  Cancel
</Button>

// Tertiary action (text)
<Button color="primary" variant="text" iconEnd="ArrowRight">
  Learn more
</Button>

// Icon-only ❌ — ใช้ IconButton component แทน (รอเขียนใน §9.2.2)
```

##### Do's and Don'ts

**Do**
- ใช้ `color="primary" variant="filled"` กับ action หลัก 1 อันต่อหน้า
- จับคู่ Filled กับ Outline เมื่อมี action คู่ (เช่น Save + Cancel)
- ใช้ `color="danger"` เฉพาะ destructive action จริงๆ ไม่ใช้พร่ำเพรื่อ
- ใช้ `size="md"` เป็น default — เลือก `lg` เฉพาะ hero CTA และ `sm` เฉพาะใน compact UI

**Don't**
- อย่าใช้ `variant="filled"` หลายปุ่มข้างกันในสีเดียวกัน — มันแย่งความสนใจ
- อย่าใช้ Button เปล่าๆ ที่ไม่มี label (ใช้ IconButton แทน)
- อย่า hardcode สี — ใช้ token เสมอ
- อย่าใช้ Button รวมกับ link styling — ถ้าเป็น link ใช้ `<a>` หรือ `variant="text"` แทน

---

#### 9.2.2 IconButton

> Source: Components → Actionable → Icon Buttons
> Figma: [Icon Buttons](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=154-394)

ปุ่มที่มี **icon อย่างเดียวไม่มี label** — ใช้สำหรับ action ที่ความหมายของไอคอนชัดเจนแล้วโดยไม่ต้องอธิบาย หรือพื้นที่จำกัดเกินกว่าจะใส่ text

##### Anatomy

```
┌─────┐
│  ●  │   ← icon อยู่กึ่งกลาง ทั้งแนวนอนและแนวตั้ง
└─────┘
```

| ส่วน | ขนาด | Optional |
|---|---|---|
| `icon` | ขึ้นกับ size (16 หรือ 12 px) | required |

> ต่างจาก Button ตรงที่ IconButton เป็นสี่เหลี่ยมจัตุรัส (กว้าง = สูง) และมี icon ตำแหน่งเดียว (ไม่มี start/end)

##### Variants

ใช้ 3 variants เหมือน Button:

| Variant | ลักษณะ | ใช้สำหรับ |
|---|---|---|
| **Filled** | solid background | Primary action |
| **Outline** | border + transparent bg | Secondary action |
| **Text** | ไม่มี border ไม่มี bg | Tertiary action, toolbar, icon ใน list item |

> ใน Figma frame ของ variant `Text` ใช้ชื่อ **"Standard"** แทน — ความหมายเดียวกันกับ Button ที่ใช้ `Text`

##### Sizes

| Size | Dimensions | Icon size | Padding |
|---|---|---|---|
| **Large** | 48 × 48 | 16 | `space-300` (12) ทุกด้าน |
| **Medium** | 40 × 40 | 16 | 12 ทุกด้าน |
| **Small** | 32 × 32 | 16 | 8 ทุกด้าน |
| **Extra Small** | **24 × 24** | **12** | 6 ทุกด้าน |

> **ข้อสังเกตสำคัญ:** Extra Small **เปลี่ยน icon เป็น 12 px** (เล็กลงจาก 16) — เพื่อให้ icon ไม่ขนาดเต็ม container ขนาดอื่นใช้ icon 16 px เหมือนกันหมด
>
> **Extra Small มีเฉพาะใน IconButton** — Button ปกติไม่มี size นี้

##### Border radius

ทุก size ใช้ `Radius-full` (999) → **วงกลม** (เพราะ container เป็นสี่เหลี่ยมจัตุรัส radius-full ทำให้กลายเป็นวงกลมพอดี)

##### Colors

ใช้ 7 colors เหมือน Button (Default, Primary, Secondary, Success, Warning, Danger, Info)

##### States

4 states เหมือน Button (Default, Hover, Active, Disabled)

##### Token mapping

ใช้ **mapping เดียวกันกับ Button ทุกประการ** (token ชุดเดียวกัน) — ดู §9.2.1 Button → Token mapping

| Variant | Background | Text/Icon | Border |
|---|---|---|---|
| Filled | `background/{role}/default` | `text/{role}/default` | — |
| Outline | transparent | `text/{role}/on-light` | `border/{role}/on-light` (1px) |
| Text | transparent | `text/{role}/on-light` | — |

**State variations** ใช้ pattern เดียวกัน (`default-hover`, `light-hover`, disabled = gray)

##### Props API (suggested)

```tsx
interface IconButtonProps {
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  variant?: 'filled' | 'outline' | 'text';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon: IconName;          // required — ต่างจาก Button ที่ optional
  'aria-label': string;    // required — icon-only ต้องมี a11y label
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
}
```

**Defaults:**
- `color = 'default'`
- `variant = 'text'`  (IconButton นิยมใช้ Text มากกว่า Filled — toolbar/icon button มักจะ subtle)
- `size = 'md'`

> **`aria-label` เป็น required** — icon-only button ไม่มี text ให้ screen reader อ่าน ต้องมี aria-label เสมอ

##### Usage examples

```tsx
// Toolbar icon button (default Text variant)
<IconButton icon="Edit01" aria-label="Edit" />

// Destructive icon button
<IconButton
  color="danger"
  variant="filled"
  icon="Trash01"
  aria-label="Delete item"
/>

// Compact (xs) icon in table row
<IconButton
  size="xs"
  variant="text"
  icon="DotsHorizontal"
  aria-label="More options"
/>

// Outline filter button
<IconButton
  color="primary"
  variant="outline"
  icon="FilterLines"
  aria-label="Filter"
/>
```

##### Do's and Don'ts

**Do**
- ใช้ icon ที่ **ความหมายชัดเจนสากล** (เช่น search, close, edit, delete, more)
- ใส่ `aria-label` ทุกครั้ง
- ใช้ Tooltip คู่กับ IconButton เพื่อบอกความหมายเมื่อ hover (ดู §9.2.3 Tooltip)
- ใช้ `size="xs"` ใน toolbar/table/list item ที่พื้นที่จำกัด

**Don't**
- อย่าใช้ icon ที่ความหมายกำกวม โดยไม่มี tooltip ประกอบ
- อย่าใช้ IconButton แทน Button ที่มี action สำคัญ — text label ชัดเจนกว่า
- อย่าใส่ icon ที่เป็น decoration อย่างเดียว — IconButton ต้องมี action จริง
- อย่าตั้ง `size="xs"` แล้วใช้ icon 16 — ระบบบังคับให้ใช้ icon 12 ใน xs เพื่อให้สัดส่วนเหมาะสม

---

### 9.3 Structural & Layout

Components ที่ใช้จัดวางและแบ่งเนื้อหาบนหน้า:
- **Card** — กล่องสำหรับจัดกลุ่มเนื้อหาที่เกี่ยวข้องกัน
- **Divider** — เส้นแบ่งระหว่างกลุ่มเนื้อหา

#### 9.3.1 Card

> Source: Components → Structural & Layout → Card
> Figma: [Card](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=186-48)

Container สำหรับจัดกลุ่มเนื้อหาที่เกี่ยวข้องกัน — มีพื้นหลังขาว, มุมโค้งใหญ่, มีเงาเล็กน้อยเพื่อยกตัวขึ้นจากพื้น

##### Anatomy

Card มี 3 ส่วนหลัก: **Visual element** (icon หรือ image), **Content** (title + body), และ **Button group** (optional)

```
Horizontal layout (Icon)         Vertical layout (Image)
┌────────────────────────┐       ┌────────────────────────┐
│ [icon]  Title          │       │  ┌─────────────────┐   │
│         Body text      │       │  │     image       │   │
│                        │       │  └─────────────────┘   │
│         [Btn] [Btn]    │       │                        │
└────────────────────────┘       │  Title                 │
                                  │  Body text             │
                                  │                        │
                                  │  [Btn] [Btn]           │
                                  └────────────────────────┘
```

| ส่วน | ขนาด | Optional |
|---|---|---|
| `icon` (Icon variant) | 24 × 24 px | ✓ ผ่าน `hasIcon` |
| `image` (Image variant) | 160 × 160 px (Horizontal) หรือ full-width (Vertical) | required |
| `title` | Body-sm-Semibold (14, weight 600) | required |
| `bodyText` | Body-sm-Regular (14, weight 400) | required |
| `buttonGroup` | 2 buttons แนวนอน (Text + Filled) | ✓ ผ่าน `hasButton` |

##### Variants

Card มี **2 axes** รวม **4 variants**:

| Axis | Options |
|---|---|
| **Type** | `Icon` (มีไอคอน) หรือ `Image` (มีรูปภาพ) |
| **Direction** | `Horizontal` (เรียงข้าง) หรือ `Vertical` (เรียงบนล่าง) |

| Variant | ใช้สำหรับ |
|---|---|
| **Icon + Horizontal** | Compact card สำหรับ feature list, info panel ที่พื้นที่จำกัด |
| **Icon + Vertical** | Feature card ที่ต้องการเน้น title และ description มากกว่า icon |
| **Image + Horizontal** | List item card (เช่น product list, article preview) |
| **Image + Vertical** | Hero card, feature spotlight ที่ image ต้องเด่น |

##### Container styling (เหมือนกันทุก variant)

| Property | Token | Value |
|---|---|---|
| Background | `background/default/default` | `#FFFFFF` |
| Padding | `space-400` | 16 px ทุกด้าน |
| Border radius | `radius-3xl` | 24 px |
| Shadow | `Dropshadow/200` | 2-layer (ดู §5.4) |
| Internal gap | `space-400` | 16 px (ระหว่าง visual element กับ content) |

##### Visual element specs

###### Icon variant

- ขนาด: 24 × 24 px
- สี: inherit จาก parent text color (currentColor)
- ใช้ `Icon` component จาก §7

###### Image variant

| Direction | Image size | Radius | Layout note |
|---|---|---|---|
| Horizontal | 160 × 160 (สี่เหลี่ยมจัตุรัส) | `radius-lg` (8) | image ซ้าย, content ขวา |
| Vertical | full-width × ratio ตาม content | `radius-lg` (8) | image บนสุด, content ล่าง |

> **Placeholder fallback:** ถ้าไม่มีรูปจริง ให้ใช้ `background/default/light` (#F5F5F5) เป็นพื้น พร้อมรูป placeholder opacity 20%

##### Content specs

| Element | Token |
|---|---|
| Title | `Body/Body-sm-Semibold` (14, weight 600) |
| Body text | `Body/Body-sm-Regular` (14, weight 400) |
| Title ↔ body gap | `space-200` (8 px) |
| Text color | `text/default/default` |

##### Button group specs (optional)

| Property | Value |
|---|---|
| Layout | row, 2 buttons เท่ากัน (flex-1) |
| Gap | `space-200` (8 px) |
| Button ซ้าย | Button — variant `text`, color `primary` |
| Button ขวา | Button — variant `filled`, color `primary` |

> ปุ่มใน Card group มักทำหน้าที่ "secondary + primary" action เสมอ ดังนั้นให้ Text + Filled คู่กัน

##### Props API (suggested)

```tsx
interface CardProps {
  type?: 'icon' | 'image';
  direction?: 'horizontal' | 'vertical';

  // Icon variant
  icon?: IconName;
  hasIcon?: boolean;     // ซ่อน icon ได้

  // Image variant
  image?: string;        // image URL
  imageAlt?: string;

  // Content
  title: string;
  bodyText: string;

  // Button group (optional)
  hasButton?: boolean;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };

  className?: string;
}
```

**Defaults:**
- `type = 'icon'`
- `direction = 'horizontal'`
- `hasIcon = true`
- `hasButton = false`

##### Usage examples

```tsx
// Icon + Horizontal — feature info
<Card
  type="icon"
  direction="horizontal"
  icon="InfoCircle"
  title="Feature available"
  bodyText="This feature is now ready to use."
/>

// Icon + Vertical with actions — feature card
<Card
  type="icon"
  direction="vertical"
  icon="Zap"
  title="Speed boost"
  bodyText="Upgrade for 2x faster processing."
  hasButton
  primaryAction={{ label: 'Upgrade', onClick: handleUpgrade }}
  secondaryAction={{ label: 'Learn more', onClick: handleLearn }}
/>

// Image + Horizontal — product list item
<Card
  type="image"
  direction="horizontal"
  image="/products/123.jpg"
  imageAlt="Product 123"
  title="Premium plan"
  bodyText="All features unlocked, priority support."
/>

// Image + Vertical — hero spotlight
<Card
  type="image"
  direction="vertical"
  image="/heroes/onboarding.jpg"
  imageAlt="Welcome"
  title="Welcome to Moldable"
  bodyText="Get started in 3 simple steps."
  hasButton
  primaryAction={{ label: 'Start now', onClick: handleStart }}
  secondaryAction={{ label: 'Skip', onClick: handleSkip }}
/>
```

##### Do's and Don'ts

**Do**
- เลือก direction ตามพื้นที่: `horizontal` สำหรับ wide layout, `vertical` สำหรับ column/grid
- ใช้ Image variant เมื่อ visual element มีความหมายเฉพาะ (ภาพสินค้า, รูป hero) — Icon variant สำหรับ generic concept
- ใช้ Button group เป็น "secondary + primary" คู่เสมอ (เช่น Cancel + Save)
- ตั้ง width ของ Card ให้ flex ตาม container ที่ใส่ลงไป (ไม่ใช่ fix 420 ตาม Figma)

**Don't**
- อย่าใส่ button มากกว่า 2 ปุ่มใน Card — ถ้ามี action เยอะ แสดงว่า content ใน Card มากเกินไป ควรย้ายไปหน้าใหม่
- อย่า override shadow ของ Card ให้เข้มกว่า `Dropshadow/200` — Card อยู่ระดับ surface ปกติ ไม่ใช่ floating (สำหรับ floating ใช้ Modal)
- อย่าใช้ Card ซ้อน Card ลึกหลายชั้น — จะดูเหมือนชั้นเปลือก
- อย่าใส่ icon ขนาดอื่นนอกจาก 24 px ใน Icon variant — ระบบกำหนดไว้คงที่

---

#### 9.3.2 Divider

> Source: Components → Structural & Layout → Divider
> Figma: [Divider](https://www.figma.com/design/n68yk8ir50rLkOe6nL7yON/Moldable-Design-system?node-id=185-850)

เส้นแบ่งบางๆ สำหรับแยกกลุ่มเนื้อหาที่เกี่ยวข้องกันแต่ต้องการสื่อ "พักสายตา" หรือ "เปลี่ยนหัวข้อ"

##### Anatomy

```
Horizontal              Vertical
──────────────────────  │
                        │
                        │
                        │
```

Divider เป็น component เรียบง่าย — มีแค่เส้น 1 พิกเซลพร้อม padding รอบเส้นเพื่อสร้าง breathing space

| ส่วน | ขนาด |
|---|---|
| Rule (เส้นจริง) | 1 px (thickness) |
| Container padding | `space-400 / space-200` (16 / 8) ตามแนว |

##### Variants

มี **2 axes** รวม **4 variants**:

| Axis | Options |
|---|---|
| **Type** | `Horizontal` (เส้นนอน) หรือ `Vertical` (เส้นตั้ง) |
| **Dashed** | `false` (solid) หรือ `true` (เส้นประ) |

| Variant | ใช้สำหรับ |
|---|---|
| **Horizontal + Solid** | แบ่ง section ระหว่างกลุ่ม content ใน column layout (ใช้บ่อยที่สุด) |
| **Horizontal + Dashed** | แบ่ง section แบบนุ่มกว่า, สื่อความสัมพันธ์ที่หลวมกว่า (เช่น optional content, draft state) |
| **Vertical + Solid** | แบ่ง column ใน toolbar / inline group (เช่น breadcrumb, button group divider) |
| **Vertical + Dashed** | แบ่ง column แบบ subtle (ใช้น้อยมาก) |

##### Specs

| Property | Token | Value |
|---|---|---|
| Color | `border/default/default` | `#D9D9D9` (Gray 300) |
| Thickness | — | 1 px |
| Length | — | `100%` ของ parent container |

##### Container padding

Divider มี padding ในตัวเองเพื่อสร้าง breathing space — **dev ไม่ต้องเพิ่ม margin ภายนอก**

| Type | Padding |
|---|---|
| Horizontal | `py-200 px-400` (8 บนล่าง / 16 ซ้ายขวา) |
| Vertical | `px-200 py-400` (8 ซ้ายขวา / 16 บนล่าง) |

> ค่า padding ใน Figma ใช้ token `sds-size-padding-lg` (16) กับ `sds-size-padding-sm` (8) ซึ่ง map กับ `space-400` และ `space-200` ตามลำดับ

##### Props API (suggested)

```tsx
interface DividerProps {
  type?: 'horizontal' | 'vertical';
  dashed?: boolean;
  className?: string;
}
```

**Defaults:**
- `type = 'horizontal'`
- `dashed = false`

##### Usage examples

```tsx
// Default — แบ่ง section ใน column layout
<Divider />

// Dashed — แบ่งแบบ subtle
<Divider dashed />

// Vertical — ใน toolbar
<div className="flex items-center gap-300">
  <Button variant="text">Edit</Button>
  <Divider type="vertical" />
  <Button variant="text">Delete</Button>
</div>
```

##### CSS implementation

```css
/* Horizontal */
.divider-horizontal {
  padding: var(--space-200) var(--space-400);
}
.divider-horizontal > .rule {
  width: 100%;
  height: 1px;
  background: var(--border-default);  /* solid */
  /* หรือใช้ border-top: 1px dashed สำหรับ dashed variant */
}

/* Vertical */
.divider-vertical {
  padding: var(--space-400) var(--space-200);
}
.divider-vertical > .rule {
  width: 1px;
  height: 100%;
  background: var(--border-default);
}
```

##### Do's and Don'ts

**Do**
- ใช้ Divider แทน `<hr>` ตรงๆ — Divider มี padding ในตัวที่ออกแบบไว้แล้ว
- ใช้ `solid` เป็น default — `dashed` เฉพาะกรณีที่ต้องการให้นุ่มลง
- ใช้ `vertical` เฉพาะ inline group ที่ element เรียงในแนวนอน

**Don't**
- อย่าเพิ่ม `margin` ภายนอก Divider — มี padding ในตัวอยู่แล้ว
- อย่าเปลี่ยนสี Divider เป็น dark/colored — ใช้ token `border/default/default` ตามมาตรฐาน (ถ้าต้องการเส้นเด่นกว่านี้แสดงว่าไม่ใช่ Divider แล้ว ลองดู Border ของ Card)
- อย่าใช้ Divider แทน whitespace — ถ้าแค่ต้องการระยะห่าง ใช้ gap/margin ปกติ Divider ต้องมี "ความหมาย" คือแบ่งเนื้อหาที่ต่างกัน

---

## 10. Do's and Don'ts

> ⏳ รอข้อมูลจาก Figma frame

---

## 11. Token reference (Schema)

> ⏳ จะรวบรวมจาก section ต่างๆ เมื่อครบทุกเฟรม

---

## 12. Implementation guide for developers

> ⏳ จะรวบรวมจาก section ต่างๆ เมื่อครบทุกเฟรม
