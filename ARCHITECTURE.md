# Architecture

## Folder Structure

```
rapido-user-backend/
├── config/
│   ├── bootstrap.php       # Required by every endpoint instead of session_start().
│   │                       # Sets HttpOnly/Secure/SameSite cookie flags and
│   │                       # initialises the per-session CSRF token.
│   ├── db.php              # PDO singleton. Call Database::getInstance()->getConnection().
│   ├── env.sample.php      # Committed credentials template.
│   └── env.php             # Local credentials — git-ignored, never committed.
├── models/
│   └── Ride.php            # All ride-related DB operations. No raw SQL outside this file
│                           # for ride data.
├── public/
│   ├── index.html          # Single-page app shell. All screens are hidden/shown by JS.
│   ├── app.js              # State management, API calls, ride simulation orchestration.
│   ├── simulation.js       # Pure helpers: location presets, Haversine distance,
│   │                       # pricing, route generation, nearby driver generation.
│   └── style.css
├── sql/
│   └── schema.sql          # Authoritative schema. Re-import to reset the database.
├── tests/
│   ├── test_connection.php # Verifies DB connection is healthy.
│   └── test_bad_connection.php  # Verifies error logging on bad credentials.
├── user/                   # One file = one API endpoint.
│   ├── csrf.php            # GET — returns session CSRF token.
│   ├── register.php        # POST — create user account.
│   ├── login.php           # POST — authenticate, start session, return csrf_token.
│   ├── logout.php          # POST — destroy session + expire cookie.
│   ├── book_ride.php       # POST — create ride record, return ride_id + OTP.
│   ├── assign_driver.php   # POST — assign available driver (SELECT FOR UPDATE).
│   ├── ride_status.php     # GET  — poll ride + driver details.
│   ├── advance_ride.php    # POST — driver only: accepted→driver_arrived→started.
│   ├── complete_ride.php   # POST — driver only: started→completed, frees driver.
│   ├── simulation_advance.php  # POST — user: full lifecycle advancer for demo mode.
│   ├── pay_ride.php        # POST — record payment, mark ride paid (transaction).
│   ├── submit_feedback.php # POST — rating + comments for a completed ride.
│   ├── ride_history.php    # GET  — paginated ride history.
│   ├── payment_history.php # GET  — paginated payments + total spent.
│   └── update_profile.php  # POST — update name and/or email.
└── logs/
    ├── .htaccess           # Denies all HTTP access to log files (Apache).
    └── db_errors.log       # PDO error codes only — never raw messages or credentials.
```

---

## Request Lifecycle

```
Browser
  └─ GET  public/index.html          served by Apache/Nginx
  └─ GET  user/csrf.php              fetch CSRF token on page load
  └─ POST user/login.php             login; response includes refreshed csrf_token
  └─ POST user/*.php                 every POST includes csrf_token in body
         │
         ▼
  config/bootstrap.php               session_set_cookie_params + session_start + CSRF init
  validate_csrf()                    hash_equals check on every POST
  config/db.php                      PDO singleton
  models/Ride.php                    (ride endpoints only)
         │
         ▼
  MySQL 8 — rapido_clone
```

---

## Session & Auth Model

- **User session**: `$_SESSION['user_id']` (int) set on login.
- **Driver session**: `$_SESSION['driver_id']` (int) — set by the driver login flow (Phase 9, not yet built). Required by `advance_ride.php` and `complete_ride.php`.
- Session cookie flags: `HttpOnly=true`, `Secure=true` (HTTPS only), `SameSite=Strict`, `lifetime=0` (expires on browser close).
- `session_regenerate_id(true)` called on every login to prevent session fixation.

---

## CSRF Protection

Every POST endpoint calls `validate_csrf()` from `bootstrap.php`. The token is:

1. Generated once per session via `bin2hex(random_bytes(32))`.
2. Served to the frontend via `GET user/csrf.php`.
3. Also returned in the `login.php` response body as `csrf_token`.
4. Expected in POST body as `csrf_token` **or** in the `X-CSRF-Token` request header.
5. Compared with `hash_equals()` to prevent timing attacks.

---

## Ride State Machine

```
waiting → accepted → driver_arrived → started → completed
```

| Transition | Endpoint | Who |
|---|---|---|
| (new) → waiting | `book_ride.php` | User |
| waiting → accepted | `assign_driver.php` | User |
| accepted → driver_arrived | `advance_ride.php` | Driver |
| driver_arrived → started | `advance_ride.php` | Driver |
| started → completed | `complete_ride.php` | Driver |
| Any → any (demo) | `simulation_advance.php` | User (simulation only) |

Out-of-order transitions return `409 Conflict` or `422 Unprocessable`.

---

## Database Schema Summary

| Table | Key Constraints |
|---|---|
| `users` | `UNIQUE(mobile)` |
| `drivers` | `UNIQUE(mobile)`, `is_available BOOLEAN` |
| `rides` | FK → users, FK → drivers; `ENUM` for `ride_status` and `payment_status` |
| `payments` | FK → rides, FK → users; `UNIQUE(ride_id)` — one payment per ride |
| `user_feedback` | FK → rides, FK → users, FK → drivers; `UNIQUE(ride_id)` — one review per ride |

`UNIQUE(ride_id)` on both `payments` and `user_feedback` enforces the one-per-ride rule at the database level, not just in PHP.

---

## Coding Rules

1. **PDO only** — no `mysqli_`. All queries use named prepared statement parameters.
2. **No raw SQL outside models** — ride queries belong in `Ride.php`; ad-hoc queries in endpoints are acceptable only when no model method fits.
3. **Every endpoint requires `bootstrap.php`** — never call `session_start()` directly.
4. **Every POST validates CSRF** — call `validate_csrf()` immediately after the method check.
5. **JSON responses only** — `Content-Type: application/json`, no HTML from `user/*.php`.
6. **Never log raw exception messages** — they may contain DSN or credentials. Log only error codes.
7. **Never expose internal errors to clients** — catch `Throwable`, return a generic `500` message.
8. **`filter_var` for integer inputs** — use `FILTER_VALIDATE_INT` with `min_range`, not `(int)` casting (which silently converts `"1abc"` to `1`).
9. **Transactions for multi-step writes** — any operation touching more than one table must use `beginTransaction` / `commit` / `rollBack`.
10. **`SELECT FOR UPDATE`** inside transactions when a row must not change between read and write (e.g., driver assignment, ride status transitions).
