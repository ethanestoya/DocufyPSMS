# Collaboration Guide — Merging Changes

This guide explains how to keep your local work in sync with the shared repository and how to merge **your changes with other collaborators' changes** (for example, you push today, your teammate sleeps and pushes tomorrow).

The team works on the **`testbranch2`** branch.

---

## 1. The Basic Flow (pull → commit → push)

A great habit for every session:

```bash
# 1. Always pull the latest from the repo BEFORE you start working
git pull origin testbranch2

# 2. ... do your work, then stage and commit

git add -A
git commit -m "Describe your change"

# 3. Push your changes
git push origin testbranch2
```

> **Key habit:** **Pull before you start, and pull again before you push.** This avoids most merge headaches.

---

## 2. First Time Setting Up on a New Machine

If you haven't cloned the repo yet:

```bash
git clone https://github.com/pranswg/DocuFy-prot.git
cd DocuFy-prot

# Switch to the branch everyone works on
git checkout testbranch2

# Install dependencies
npm install
```

---

## 3. What happens when your teammate pushes while you're working

This is the exact scenario you described:

1. You pushed changes yesterday.
2. Your teammate (asleep at the time) works today and pushes her changes.
3. Tomorrow you open your project, which is now **behind** the remote.

You have **two choices**: merge or rebase. Both are explained below.

---

## 4. Option A — Merge (simpler, recommended for beginners)

When someone else has pushed and you have local changes, `git pull` will try to combine everything.

```bash
# Fetch and merge the remote changes into your branch
git pull origin testbranch2
```

**If there are no conflicts**, Git combines the changes automatically and you're done. Just keep working or push.

**If there IS a conflict** — git will tell you which file(s) conflict, for example:

```
CONFLICT (content): Merge conflict in src/app/App.tsx
```

### Resolving a conflict step by step

1. Open the conflicted file. Git marks the two versions with markers:

   ```
   <<<<<<< HEAD
   (your version of the code)
   =======
   (their version / the remote's code)
   >>>>>>> branch-name
   ```

2. Decide what the final code should be. Delete the markers and keep the correct combination.

3. After fixing each conflicted file, mark it as resolved and finish the merge:

   ```bash
   git add -A
   git commit            # completes the merge — message is pre-filled
   ```

4. Push the merged result:

   ```bash
   git push origin testbranch2
   ```

> **Tip:** If you're unsure what's yours vs. theirs, ask the teammate. In most conflicts, you want to keep *both* sets of changes if they affect different parts of the file.

---

## 5. Option B — Rebase (cleaner history, slightly more advanced)

Rebase makes your local commits appear **on top of** the latest remote commits, keeping history linear.

```bash
git pull --rebase origin testbranch2
```

- If there are **no conflicts**, your commits are replayed on top — done.
- If there **is a conflict**: fix the marked file(s), then:

  ```bash
  git add -A
  git rebase --continue
  ```

  Then push:

  ```bash
  git push --force-with-lease origin testbranch2
  ```

> ⚠️ Only use `--force-with-lease` (never plain `--force`) on a shared branch when rebasing, and make sure nobody else is mid-work on that branch at that moment.

---

## 6. Safeguarding your work before pulling (stashing)

If you have **uncommitted** changes and want to pull first, stash them, pull, then restore:

```bash
git stash                    # temporarily put aside your uncommitted changes
git pull origin testbranch2  # get the latest
git stash pop                # bring your changes back
```

If `git stash pop` reports a conflict, resolve it like a normal conflict (see section 4).

> **Alternative that keeps things simple:** commit your work first (a small commit is fine), then pull. You can always rewrite or squash commit history later. Committing first is usually safer than stashing.

---

## 7. Common Commands Cheat Sheet

| Action | Command |
|--------|---------|
| See what branch you're on & repo state | `git status` |
| Download latest but don't apply | `git fetch origin` |
| Apply remote changes to your branch | `git pull origin testbranch2` |
| Replay your commits on top of remote | `git pull --rebase origin testbranch2` |
| Stage all changes | `git add -A` |
| Commit staged changes | `git commit -m "message"` |
| Push to the shared branch | `git push origin testbranch2` |
| Push after a rebase | `git push --force-with-lease origin testbranch2` |
| Save uncommitted work temporarily | `git stash` |
| Restore stashed work | `git stash pop` |
| See recent history | `git log --oneline -10` |

---

## 8. Golden Rules for the Team

1. **Pull before you start** and **pull again before pushing**.
2. **Commit small, commit often** — smaller commits are easier to merge.
3. **Don't touch `node_modules/` or `dist/`** — they're in `.gitignore` and shouldn't be committed.
4. **Communicate** — if two people will edit the same file, coordinate to avoid the same-code conflicts.
5. **Write meaningful commit messages** so others can tell what changed.
6. **When in doubt, ask** — a teammate can clarify whether to keep "your version" or "their version" in a conflict.
