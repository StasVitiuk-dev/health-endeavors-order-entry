# Security incident runbook (EXT18)

Status: **CURRENT.** For the owner (Stas). Each step says who does it. Claude never touches production, secrets or settings. Claude can prepare text, read-only SQL and pull requests.

## 0. First five minutes (any incident)

1. **Stop and write down** what you saw, when, on which device. Take a screenshot, but do **not** share screenshots showing e-mail addresses or tokens.
2. **Do not delete anything** (data, logs, PRs, commits). Deleting loses evidence.
3. **Do not paste passwords, keys or tokens into any chat**, including with Claude.
4. Decide which section below fits, then follow it.

## 1. A secret may have leaked (a key, password or token was seen somewhere it should not be)

| Step | Who | What |
|---|---|---|
| 1 | Stas | Supabase dashboard → Project Settings → API: if the **service-role / secret key** leaked, rotate it immediately. The public (anon/publishable) key in the pages is public by design and needs no rotation. |
| 2 | Stas | Anything else that used the leaked key (backups workflow, agents) must get the new key. This is in the private backups repository, which Claude does not access. |
| 3 | Stas | GitHub → Settings → Developer settings: revoke any leaked GitHub token. |
| 4 | Claude | If the secret is in this public repository: prepare a PR that removes it, and say plainly that **removing it does not un-leak it**. Rotation (step 1) is what fixes it. |
| 5 | Stas | Note the date and what was rotated in `docs/PROJECT_RECORD.md` (no secret values). |

## 2. Someone may be signed in who should not be (session revocation)

| Step | Who | What |
|---|---|---|
| 1 | Stas | Supabase → Authentication → Users: find the person and **sign them out of all sessions** / remove or disable the user. Existing access tokens stay valid until they expire (usually under an hour); refresh is stopped at once. |
| 2 | Stas | Change your own password if your account is the concern (change-password page). |
| 3 | Stas | Check the dashboard's Activity / audit view for changes by that person since the suspected time. |
| 4 | Claude | Prepare a read-only SQL listing that person's audit lines for a time window, for Stas to run. |

## 3. Emergency: turn features off

| Step | Who | What |
|---|---|---|
| 1 | Stas | Dashboard → System status → System mode → **Emergency / read-only**, if available (MU-06 explains what it does and does not stop). |
| 2 | Stas | Agents: switch the agent off in the dashboard's agent switches (`agent_controls`). |
| 3 | Stas | Last resort: GitHub → this repository → revert the last merged PR (Revert → Create PR → merge). The site goes back to the previous version in 1–5 minutes. |

## 4. The live page looks wrong or behaves unexpectedly after a merge

1. Stas: hard refresh (Cmd+Shift+R) or a Private Window, to rule out an old cached file.
2. Stas: if still wrong, revert the merged PR (section 3, step 3).
3. Send Claude a screenshot. Claude compares with the tested behaviour and the release review. **Nothing else changes until the cause is known.**

## 5. Preserve evidence

- Keep: screenshots, the time, the device, the copied diagnostic summary (it holds no secrets or e-mail addresses, by test).
- In Supabase: do not delete `audit_log` rows. Note the time window.
- In GitHub: do not force-push or delete branches (also blocked by `protect-main`).
- Record what happened in `docs/PROJECT_RECORD.md`, with no secrets and no customer data.

## 6. Security check after any change

`npm run security:quick` (about a minute) and `npm run security:deep` (about 8 minutes). Both print the commit they checked.
