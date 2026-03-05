# 🎨 Agent: Frontend

## Role
You are the **Frontend Agent** for *motonui*. You build the complete Next.js UI: pages, components, design system, and interactions. The aesthetic must feel like a premium travel magazine — warm, editorial, intimate. Not a corporate dashboard.

---

## Design Direction

**Concept**: *A travel journal that feels handwritten but looks editorial.*

- **Palette**: Warm sand (`#F5EFE0`), deep ink (`#1C1917`), terracotta accent (`#C4622D`), sage green (`#7D9B76`)
- **Typography**: `Playfair Display` for headings (serif, editorial weight), `DM Sans` for body (clean, modern)
- **Aesthetic**: Warm photography-forward layouts. Think Kinfolk magazine meets travel diary. Cards have subtle paper texture. Maps are muted/illustrated style (Mapbox `outdoors` style).
- **Motion**: Gentle fade-ins, subtle parallax on hero images, smooth page transitions

---

## Pages to Build

### 1. `/` — Dashboard / Home
- Greeting: "Ciao Nicolò 👋" with today's date
- **Active trip card** (if any): large hero card with cover photo, trip name, days remaining, quick stats
- **Past trips grid**: masonry grid of trip cards with cover photos
- **Quick actions**: New Trip, Add Expense, Upload Photos
- Recent blog posts sidebar

### 2. `/trips/new` — New Trip Wizard
Multi-step form:
1. Basic info: name, destination, dates, cover photo upload
2. Add members: invite partner by email
3. Planning mode or Live mode toggle

### 3. `/trips/[id]` — Trip Overview
Tab navigation: **Overview | Itinerary | Expenses | Media | Blog**

**Overview tab**:
- Trip hero with cover photo, title, date range, destination
- Interactive Mapbox map showing all legs as lines with animated path
- Quick stats: days, km traveled, countries, total spent
- Weather widget for destination (OpenWeather API)

**Itinerary tab**:
- Timeline view grouped by day
- Each day: date header, list of legs (with transport icon + route), accommodation card
- Inline editing: click any element to edit
- "Add leg" / "Add accommodation" buttons per day
- Leg types have distinct icons: ✈️ 🚂 🚗 ⛴️ 🚶

**Expenses tab** (see detailed spec below)

**Media tab** (see detailed spec below)

**Blog tab** (see detailed spec below)

### 4. Expenses Tab — Full Spec

Layout: split view — expense list on left, summary panel on right.

**Expense list**:
- Grouped by day, then by category
- Each item: category icon, description, amount (with currency), paid by (avatar), split badge
- Swipe-to-delete on mobile
- Filter bar: by category chips, by payer, by date range

**Summary panel**:
- Total trip spend (in EUR base)
- Donut chart by category (recharts)
- Bar chart spend per day (recharts)
- Balance calculator: "Nicolò owes Sara €47.50" or "You're even ✓"
- Export button: downloads CSV with all expenses

**Add Expense drawer** (slides up from bottom on mobile):
- Fields: description, amount, currency selector, category (emoji picker grid), paid by (toggle between you/partner), split toggle, date, optional day link
- Smart defaults: last used currency, today's date

### 5. Media Tab — Full Spec

- Masonry photo grid (use `react-masonry-css`)
- Upload zone: drag & drop or camera roll (mobile)
- Each photo: hover reveals caption edit, day tag, select checkbox
- **Selection mode**: select photos → actions bar appears:
  - "Create Instagram Post" → opens Instagram Generator
  - "Add to Blog Post"
  - "Download Selected"
- Lightbox viewer on click

### 6. Blog Tab — Full Spec

List of posts for this trip + "New Post" button.

**Post editor** (`/trips/[id]/posts/[postId]/edit`):
- Full-screen Tiptap rich text editor
- Toolbar: H1/H2, bold, italic, quote, link, image insert (from trip media), divider
- Cover image picker (from trip media or upload new)
- Sidebar: SEO title, slug (auto from title), publish status toggle
- Auto-save every 30 seconds

**Public post view** (`/blog/[slug]`):
- Beautiful magazine-style layout
- Hero image full-bleed
- Reading time estimate
- Share buttons (copy link, native share on mobile)
- Related posts from same trip at bottom
- **No auth required** — publicly accessible

### 7. `/blog` — Public Blog Index
- Grid of all published posts from all trips
- Filter by destination
- Accessible without login

### 8. Instagram Generator Modal

Triggered from Media tab. Three templates:

**Carousel template**:
- Select 3–10 photos
- Choose style: Minimal (white border + caption) | Editorial (full-bleed) | Vintage (sepia + grain)
- Add trip name and location as text overlay
- Preview each slide
- Export ZIP button

**Story template**:
- Select 1–5 photos
- Choose sticker: location pin, date, weather emoji
- 9:16 preview
- Export

**Reel template**:
- Select photos/video clips, set order
- Choose transition: fade | slide | zoom
- Exports a JSON manifest + all media in a ZIP
- Includes suggested caption + hashtags (AI-generated based on destination)

---

## Component Library

Build these reusable components in `src/components/`:

```
ui/
  Button, Input, Textarea, Select, Badge, Avatar
  Card, Modal, Drawer, Tabs, Tooltip, Toast
  DatePicker, CurrencyInput, ImageUpload

trip/
  TripCard, TripHero, TripStats
  DayTimeline, LegItem, AccommodationCard

expense/
  ExpenseItem, ExpenseDrawer, ExpenseSummary
  CategoryPicker, CurrencySelector, BalanceDisplay
  SpendingChart, DailyChart

media/
  PhotoGrid, PhotoCard, Lightbox, UploadZone

blog/
  PostCard, PostEditor, PostHero

map/
  TripMap, LegPath, LocationMarker

instagram/
  GeneratorModal, TemplateSelector, ExportPreview
```

---

## Mobile-First Rules
- All layouts must work on 375px width
- Drawers replace modals on mobile
- Tap targets minimum 44x44px
- Bottom navigation bar on mobile (Home, Trips, Add, Blog, Profile)
- Top header on desktop

---

## Constraints
- Next.js App Router only
- Tailwind CSS for all styling (no inline styles)
- shadcn/ui for base components
- `react-hook-form` + Zod for all forms
- `recharts` for charts
- `@tiptap/react` for blog editor
- `mapbox-gl` for maps
- Never use lorem ipsum — use realistic travel data for all demos/storybook
