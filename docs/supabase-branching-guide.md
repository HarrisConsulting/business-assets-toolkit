# 🌿 Supabase Branching Without Git — A Novice's Guide
### *Default feature as of 2025 — [supabase.com/blog/branching-without-git-is-now-the-default](https://supabase.com/blog/branching-without-git-is-now-the-default)*

---

## 🤔 What Is This Feature?

Supabase **Branching** lets you create a fully isolated copy of your database — a "branch" — where you can safely make schema changes (add tables, columns, policies, etc.) without touching your live production database. When you're happy with the changes, you merge them back.

What's new: **you no longer need GitHub or any version control system to use it.** It works entirely inside the Supabase Dashboard. No Git setup. No terminal. No pull requests.

> Think of it like a "sandbox" version of your database that you can experiment on freely — and then apply those changes to production with one click when you're ready.

---

## ✅ Why Should a Novice Care? — The Use Case

Here's the core problem it solves:

**Without branching**, if you want to try a new database change (e.g., add a `profiles` table or change a column), you edit your **live production database directly**. If something breaks, your app breaks — for real users, right now.

**With branching**, you:
1. Create a branch (an isolated copy of your DB)
2. Make and test changes safely on the branch
3. Review exactly what will change before it goes live
4. Merge to production only when you're confident

### 📋 When Should You Use It?

| Situation | Use Branching? |
|:---|:---|
| Adding a new table or column for a new feature | ✅ Yes |
| Experimenting with a schema you're unsure about | ✅ Yes |
| Tweaking RLS (Row Level Security) policies | ✅ Yes |
| Working with a teammate on separate features at the same time | ✅ Yes |
| Fixing a tiny typo in a table description | ⚠️ Optional |
| Quick one-off data inserts (not schema changes) | ❌ Not necessary |

---

## 🔄 How It Works — The Basic Flow

```
┌─────────────────────────────────────────────────────────┐
│              YOUR PRODUCTION DATABASE                   │
│                        │                                │
│           Click "Create Branch"                         │
│                        │                                │
│              ┌─────────▼──────────┐                    │
│              │   BRANCH (copy)    │                    │
│              │  Safe sandbox DB   │                    │
│              └─────────┬──────────┘                    │
│                        │                                │
│         Make changes (add tables, columns, etc.)        │
│                        │                                │
│              ┌─────────▼──────────┐                    │
│              │  Review Schema     │                    │
│              │  Diff (what changed│                    │
│              └─────────┬──────────┘                    │
│                        │                                │
│               Click "Merge to Production"               │
│                        │                                │
│              ┌─────────▼──────────┐                    │
│              │  PRODUCTION UPDATED│                    │
│              │  safely & cleanly  │                    │
│              └────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step-by-Step: Using Branching in the Dashboard

### Step 1 — Create a Branch
1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard)
2. Click the **branch selector** at the top of the left sidebar (it shows `main` by default)
3. Click **"New Branch"**
4. Give it a descriptive name (e.g., `add-user-profiles` or `feature/notifications`)
5. Supabase instantly creates a fully isolated copy of your database — separate URL, separate API keys

### Step 2 — Make Your Changes
- Use the **Table Editor**, **SQL Editor**, or **Auth / Storage** settings to make changes
- Your production database is completely untouched during this step
- You can share the branch URL/keys with a teammate or use it in your dev environment

### Step 3 — Review the Diff
- When ready, click **"Merge"** from the branch selector
- Supabase shows you a **schema diff** — a precise summary of every change that will be applied to production
- Review it carefully before confirming

### Step 4 — Merge
- Click **"Merge to Production"**
- Supabase applies the migration to your live database
- The branch is deleted automatically (or you can keep it)

---

## 💡 Workflow Optimization Tips

- **Name branches by feature**, not by date (e.g., `add-comments-table` not `branch-may-8`). This makes the diff review much clearer.
- **One branch per feature.** Don't pile multiple unrelated changes into one branch — it makes the diff hard to review and debug.
- **Test your app against the branch.** Supabase gives each branch its own URL and anon key. Point your dev build at the branch credentials while you work.
- **Review the diff before every merge** — even if you think you know what changed. The diff is the safety net.
- **Delete branches after merging.** Keep things clean; stale branches cause confusion.
- **Use branching even if you're solo.** It's not just for teams — it protects you from yourself.

---

## 📱 Example 1: React Native Mobile App

### Scenario
You're building a React Native app with Expo. You currently have a `users` table. You want to add a `notifications` table and a new `push_token` column to `users` — without breaking the live app while you work.

---

### Step 1 — Create a Branch
In the Dashboard, create a branch called `feature/notifications`.

Supabase gives you a new set of credentials for this branch, e.g.:
```
Branch URL:  https://xyzbranchid.supabase.co
Branch Anon Key: eyJhbGc...branch_key
```

---

### Step 2 — Point Your Dev App at the Branch

In your React Native project, use environment variables to switch between production and branch:

```bash name=.env.development
EXPO_PUBLIC_SUPABASE_URL=https://xyzbranchid.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...branch_key
```

```bash name=.env.production
EXPO_PUBLIC_SUPABASE_URL=https://xyzprodid.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...prod_key
```

Your Supabase client picks up the right config automatically:

```typescript name=lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Running `expo start` in dev mode now hits your **branch database**, not production.

---

### Step 3 — Make Schema Changes on the Branch

In the Supabase Dashboard (on the `feature/notifications` branch), open the **SQL Editor** and run:

```sql
-- Add push token column to users
ALTER TABLE users ADD COLUMN push_token TEXT;

-- Create notifications table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);
```

---

### Step 4 — Build and Test in the App

Now write your React Native feature code against the branch:

```typescript name=hooks/useNotifications.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotifications(data ?? []));
  }, [userId]);

  return notifications;
}
```

Test on a device or simulator. Because you're pointing at the branch, your production users are completely unaffected.

---

### Step 5 — Review Diff and Merge

When everything works:
1. Go back to the Dashboard → branch selector → **Merge**
2. Review the diff — you'll see the `push_token` column addition and the full `notifications` table creation
3. Click **Merge to Production**
4. Switch `.env.development` back to your production credentials (or use the prod env for your release build)

✅ Your live app now has the new schema. No downtime, no risk.

---

## 🌐 Example 2: Standalone Web App

### Scenario
You're building a simple web app (plain HTML/JS or a framework like Next.js). You have a `posts` table and want to add a `tags` system — a new `tags` table and a `post_tags` join table — without disrupting users currently reading posts.

---

### Step 1 — Create a Branch
In the Dashboard, create a branch called `feature/post-tags`.

You get branch-specific credentials:
```
Branch URL:  https://abcbranchid.supabase.co
Branch Anon Key: eyJhbGc...branch_key
```

---

### Step 2 — Point Your Dev Environment at the Branch

For a Next.js app, update your local `.env.local`:

```bash name=.env.local
NEXT_PUBLIC_SUPABASE_URL=https://abcbranchid.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...branch_key
```

For a plain HTML/JS app, just swap the credentials in your config temporarily:

```javascript name=supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Switch this URL/key to your branch while developing
const SUPABASE_URL = 'https://abcbranchid.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...branch_key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

---

### Step 3 — Make Schema Changes on the Branch

In the SQL Editor on the `feature/post-tags` branch:

```sql
-- Create tags table
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

-- Create join table linking posts to tags
CREATE TABLE post_tags (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Allow anyone to read tags (public blog)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tags" ON tags FOR SELECT USING (true);

ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read post_tags" ON post_tags FOR SELECT USING (true);
```

---

### Step 4 — Build and Test the Feature

Query posts with their tags in your app:

```javascript name=posts.js
import { supabase } from './supabase-client.js';

async function getPostsWithTags() {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      title,
      content,
      post_tags (
        tags ( id, name, slug )
      )
    `);

  if (error) console.error(error);
  return data;
}
```

Build your tag filter UI, test all the edge cases — production is never touched.

---

### Step 5 — Review Diff and Merge

1. Dashboard → branch selector → **Merge**
2. Review: you'll see `tags` table, `post_tags` table, and both RLS policies in the diff
3. Click **Merge to Production**
4. Update `.env.local` (or your production deploy config) back to your production Supabase credentials
5. Redeploy your app

✅ Tags are live. Existing posts and users were never disrupted.

---

## ⚡ Quick-Reference Cheatsheet

```
1. Dashboard → Branch Selector → "New Branch"
2. Name it after the feature (e.g., feature/add-comments)
3. Copy the branch URL + Anon Key
4. Point your dev app at branch credentials (.env / config)
5. Make schema changes in the SQL Editor or Table Editor
6. Build and test your feature locally
7. Dashboard → Branch Selector → "Merge" → Review Diff → Confirm
8. Restore production credentials in your app config
9. Deploy / release
```

---

## 🔑 Key Takeaways for Novices

| Concept | Plain English |
|:---|:---|
| **Branch** | A safe copy of your database to experiment on |
| **Schema diff** | A preview of exactly what will change before it goes live |
| **Merge** | Applying your branch changes to production |
| **Branch credentials** | A separate URL + API key just for that branch — use in your dev config |
| **No Git required** | Everything lives in the Supabase Dashboard |

> 🛡️ **The golden rule:** If you're changing the *structure* of your database (adding/removing tables, columns, or policies), always do it on a branch first. It takes 30 seconds and can save hours of debugging a broken production app.

---

*Reference: [Supabase — Branching Without Git Is Now The Default](https://supabase.com/blog/branching-without-git-is-now-the-default)*
