# ✍️ Agent: Content & AI Assistant

## Role
You are the **Content Agent** for *motonui*. You build the AI-powered writing assistant, blog SEO features, and all content-generation capabilities of the app. You use the Claude API (via the Anthropic SDK) as the underlying AI engine.

---

## Your Tasks

### 1. Trip Blog AI Assistant (`src/lib/ai/blog-assistant.ts`)

Build a streaming AI writing assistant integrated into the Tiptap blog editor.

**Triggers in the editor**:
- Select text → "Improve this" button appears
- Press `/` → command menu with AI options:
  - `/write-intro` — generate trip introduction from trip metadata
  - `/describe-place` — expand selected place name into a paragraph
  - `/add-transition` — smooth transition between two paragraphs
  - `/travel-tips` — add a "Tips for travelers" section for the destination
  - `/finish` — complete the current sentence/paragraph

**Implementation**:

```typescript
// src/lib/ai/blog-assistant.ts

export async function streamBlogCompletion(options: {
  command: BlogCommand
  context: {
    selectedText?: string
    surroundingText?: string
    tripMetadata: TripContext
    editorContent: string
  }
  onChunk: (text: string) => void
  onComplete: () => void
}): Promise<void>
```

Use `@anthropic-ai/sdk` with streaming:
```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-opus-4-5',
  max_tokens: 800,
  system: buildBlogSystemPrompt(options.context.tripMetadata),
  messages: [{ role: 'user', content: buildUserPrompt(options) }]
})
```

System prompt template:
```
You are a travel writer helping {{names}} write about their trip to {{destination}}.
The trip was from {{start_date}} to {{end_date}}.
Write in a warm, personal, first-person (plural "we") style.
Be specific and evocative. Mention real places, sensory details, moments.
Output only the prose to insert — no introductions, no "here's your text", no markdown.
Language: {{language}}
```

**API Route**: `POST /api/ai/blog` — streams response using Next.js streaming response.

### 2. Trip Summary Generator (`src/lib/ai/trip-summary.ts`)

Generate a complete blog post draft from trip data alone (no writing required from user).

Input: full trip object (itinerary, expenses summary, media count, legs)
Output: a full Tiptap JSON document with:
- Introduction paragraph
- Day-by-day narrative sections (H2 per day)
- Expense summary section ("How much does X cost?")
- Tips section
- Closing paragraph

```typescript
export async function generateTripPost(trip: TripWithDetails): Promise<TiptapDoc>
```

This is a non-streaming call (complete generation). Prompt the model to output structured JSON matching Tiptap's document schema.

**API Route**: `POST /api/ai/generate-post` — body: `{ tripId: string }`

### 3. SEO Optimizer (`src/lib/ai/seo.ts`)

For each blog post, generate:
- SEO title (max 60 chars)
- Meta description (max 160 chars)
- Open Graph description
- Suggested URL slug
- Focus keyphrase suggestion

```typescript
export async function generateSEOMetadata(post: {
  title: string
  content: string // plain text extraction
  destination: string
}): Promise<SEOMetadata>
```

Store results in `posts` table columns: `seo_title`, `seo_description`, `og_description`.

### 4. Smart Expense Categorizer (`src/lib/ai/expenses.ts`)

When user types an expense description, auto-suggest the category:

```typescript
export async function suggestExpenseCategory(description: string): Promise<ExpenseCategory>
// "Aperol spritz al tramonto" → 'food'
// "Taxi dall'aeroporto" → 'transport'
// "Museo Picasso" → 'activity'
```

Use a lightweight approach: first try a local keyword matcher (no API call), fall back to Claude for ambiguous cases.

Local matcher (`src/lib/ai/expense-keywords.ts`):
```typescript
const CATEGORY_KEYWORDS = {
  food: ['ristorante', 'bar', 'caffè', 'pizza', 'colazione', 'cena', 'pranzo', 'restaurant', 'cafe', 'dinner', 'lunch', 'breakfast', 'gelato', 'aperitivo'],
  transport: ['taxi', 'uber', 'bus', 'metro', 'treno', 'volo', 'ferry', 'autobus', 'train', 'flight', 'transfer', 'navetta'],
  accommodation: ['hotel', 'airbnb', 'ostello', 'hostel', 'b&b', 'appartamento'],
  activity: ['museo', 'tour', 'biglietto', 'ticket', 'escursione', 'museo', 'ingresso'],
  shopping: ['negozio', 'souvenirs', 'farmacia', 'supermercato', 'mercato'],
}
```

### 5. Destination Research Assistant (`src/lib/ai/destination.ts`)

When creating a new trip, offer an AI research assistant:

```typescript
export async function getDestinationBriefing(destination: string): Promise<DestinationBriefing>
// Returns: { overview, bestTimeToVisit, currencyTip, languageTips, mustSee: string[], budgetTip }
```

This is used to pre-fill the trip planning view with useful context.

**API Route**: `POST /api/ai/destination` — body: `{ destination: string }`

### 6. Frontend AI Components

Build these React components that use the AI routes:

**`<BlogAIToolbar />`** — floating toolbar in Tiptap editor with AI commands
**`<AISuggestionToast />`** — non-blocking suggestion notification
**`<CategoryAutocomplete />`** — expense category suggestion with icon
**`<GeneratePostButton />`** — one-click full post generation in blog tab
**`<DestinationBriefingPanel />`** — shows AI briefing during trip creation

---

## API Cost Management

- Cache destination briefings in Supabase for 30 days (same destination → no new API call)
- Limit blog AI calls: max 20/day per user (track in `ai_usage` table)
- Use `claude-haiku-4-5` for categorization and short tasks, `claude-sonnet-4-6` for full post generation
- Always show the user a spinner + estimated cost before long generations

---

## Constraints
- All AI calls happen server-side (API routes) — never expose API keys to the browser
- Use streaming for all long-form text generation (better UX)
- Always allow the user to reject/edit AI output — never auto-apply
- Language awareness: detect user's language from browser and match output language
