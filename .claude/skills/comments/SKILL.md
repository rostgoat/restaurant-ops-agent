---
name: comments
description: How this repo comments code. Read before writing or editing any comment, docstring, or file header. Applies to Python, TypeScript, and SQL.
---

# Comments

The default is no comment. The code says what it does; a comment is for what
the code cannot say.

## Names first

A comment that restates a good name is noise. A comment that props up a bad
name is a bug report. Rename instead.

```python
# bad
def proc(d):          # processes the order data

# good
def normalize_order(raw):
```

**No file header or function docstring is required.** Write one only when the
name and signature genuinely do not convey the thing: a module with a job that
is not obvious from its filename, or a function whose contract has a catch a
caller would otherwise miss. Most functions need neither.

## When a comment earns its place

Four cases. If it isn't one of these, delete it.

1. **A why that looks wrong without it.** A decision a reader would otherwise
   try to "fix".
2. **A constraint from outside the file.** An API quirk, a platform
   workaround, a limit someone else imposed.
3. **A value that is ambiguous on inspection.** A nullable money column, two
   booleans that sound alike, a unit that isn't stated in the name.
4. **A consequence somewhere else.** Changing this breaks that, and that is
   not nearby.

```python
# earns it: the reader would otherwise simplify this away
keys.append(key)          # bound here; closing over the loop variable gives
                          # every column the last key's values
```

```sql
-- earns it: a nullable money column looks like an oversight
tip_cents integer,        -- null, not zero: marketplaces pass no tip at all
```

## Never

- **Restating the code.** `i += 1  # increment i`
- **Change history.** No `added`, `removed`, `changed`, `previously`, `now
  handles`, `used to`. A reader does not know the old behaviour and does not
  need to. Git knows.
- **Perishable words.** No `currently`, `for now`, `recently`, `today`,
  `new`. All false within months, and nobody comes back to fix them.
- **Commented-out code.** Delete it.
- **`TODO`.** Open an issue or do it.
- **Section headers that repeat structure.** `# imports`, `# helpers`.
- **Narration of your own process.** How you arrived at the code is not the
  code.

## Shape

- **Two lines maximum for an inline comment.** If it needs a paragraph, the
  code needs restructuring. A file header or docstring may run longer when it
  has earned the right to exist at all, but it should still be short enough
  that someone reads it rather than skips it.
- **Above the code**, not trailing it. One exception: a single annotation on a
  field or column declaration, where trailing is the convention and putting it
  above would break up the block. SQL DDL and struct definitions qualify;
  statements do not.
- **Plain words.** A reader who does not know the codebase should follow it.
  No jargon that the comment does not itself define.

## Checking your own work

Read the comment and ask: if I delete this, what does a reader lose? If the
answer is nothing, or is "they'd have to read the next two lines", delete it.
