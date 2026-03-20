const fs = require('fs');

const files = [
  'src/app/api/ai/blog/route.ts',
  'src/app/api/expenses/[id]/route.ts',
  'src/app/api/trips/[id]/days/route.ts',
  'src/app/api/trips/[id]/days/[dayId]/accommodations/route.ts',
  'src/app/api/trips/[id]/days/[dayId]/accommodations/[accId]/route.ts',
  'src/app/api/trips/[id]/days/[dayId]/legs/route.ts',
  'src/app/api/trips/[id]/days/[dayId]/legs/[legId]/boarding-pass/route.ts',
  'src/app/api/trips/[id]/days/[dayId]/legs/[legId]/route.ts',
  'src/app/api/trips/[id]/days/[dayId]/route.ts',
  'src/app/api/trips/[id]/expenses/route.ts',
  'src/app/api/trips/[id]/expenses/[expenseId]/route.ts',
  'src/app/api/trips/[id]/media/route.ts',
  'src/app/api/trips/[id]/media/[mediaId]/route.ts',
  'src/app/api/trips/[id]/posts/route.ts',
  'src/app/api/trips/[id]/posts/[postId]/route.ts',
  'src/app/api/trips/[id]/route.ts',
  'src/app/api/trips/[id]/stats/route.ts',
];

const IMPORT_TRIGGER = "import { createClient } from '@/lib/supabase/server';";
const IMPORT_ADD = "import { getAuthUser } from '@/lib/auth/get-user';";
const NEW_LINE = '    const user = await getAuthUser(supabase);';

// Patterns: [lineA, lineB_trimmed]
const PATTERNS = [
  [
    "    const { data: { user } } = await supabase.auth.getUser();",
    "if (!user) throw Errors.unauthorized();",
  ],
  [
    "    const { data: { user } } = await supabase.auth.getUser();",
    "if (!user) return Response.json({ error: 'Non autenticato' }, { status: 401 });",
  ],
];

let patched = 0;

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  let changed = false;

  for (const [lineA, lineBTrimmed] of PATTERNS) {
    let searchFrom = 0;
    while (true) {
      const idx = c.indexOf(lineA, searchFrom);
      if (idx === -1) break;
      const afterA = c.indexOf('\n', idx) + 1;
      const endOfB = c.indexOf('\n', afterA);
      const segmentTrimmed = c.slice(afterA, endOfB).trim();
      if (segmentTrimmed === lineBTrimmed) {
        c = c.slice(0, idx) + NEW_LINE + c.slice(endOfB);
        changed = true;
        // don't advance searchFrom — new content starts at same idx
      } else {
        searchFrom = afterA; // skip past this occurrence
      }
    }
  }

  if (changed && !c.includes(IMPORT_ADD)) {
    c = c.replace(IMPORT_TRIGGER, IMPORT_TRIGGER + '\n' + IMPORT_ADD);
  }

  if (changed) {
    fs.writeFileSync(f, c, 'utf8');
    patched++;
    console.log('PATCHED:', f);
  } else {
    console.log('SKIP:', f);
  }
}

console.log('\nTotal patched:', patched);
