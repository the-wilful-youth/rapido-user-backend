# Rapido Clone — User Backend

A Rapido-style ride-booking platform built with pure PHP 8, MySQL 8, and vanilla JS. No frameworks, no ORMs.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | PHP 8+ (strict types, PDO) |
| Database | MySQL 8 (InnoDB, utf8mb4) |
| Frontend | Vanilla JS, HTML5, CSS3 |
| Map | Leaflet.js + OpenStreetMap |
| Icons | Lucide |

---

## Quick Start

See [SETUP.md](SETUP.md) for the full step-by-step guide.

**TL;DR:**
1. Place the project in your web server's document root
2. Create database `rapido_clone` and import `sql/schema.sql`
3. Copy `config/env.sample.php` → `config/env.php` and set your DB password
4. Open `http://localhost/rapido-user-backend/public/index.html`

---

## Project Structure

```
rapido-user-backend/
├── config/
│   ├── bootstrap.php       # Session security flags + CSRF token init
│   ├── db.php              # PDO singleton
│   ├── env.sample.php      # Credentials template (commit this)
│   └── env.php             # Local credentials (git-ignored)
├── models/
│   └── Ride.php            # All ride DB operations
├── public/
│   ├── index.html          # Single-page frontend app
│   ├── app.js              # All UI logic, API calls, ride simulation
│   ├── simulation.js       # Map helpers, location presets, pricing
│   └── style.css
├── sql/
│   └── schema.sql          # Full DB schema (users, drivers, rides, payments, feedback)
├── tests/
│   ├── test_connection.php
│   └── test_bad_connection.php
├── user/                   # API endpoints
│   ├── csrf.php
│   ├── register.php
│   ├── login.php
│   ├── logout.php
│   ├── book_ride.php
│   ├── assign_driver.php
│   ├── ride_status.php
│   ├── advance_ride.php
│   ├── complete_ride.php
│   ├── simulation_advance.php
│   ├── pay_ride.php
│   ├── submit_feedback.php
│   ├── ride_history.php
│   ├── payment_history.php
│   └── update_profile.php
└── logs/
    └── db_errors.log       # PDO errors (git-ignored)
```

---

## API Reference

All endpoints return `Content-Type: application/json`. Auth endpoints require a valid `PHPSESSID` cookie. Every POST request must include a `csrf_token` field (fetched from `user/csrf.php`).

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `user/csrf.php` | No | Get CSRF token for the current session |
| POST | `user/register.php` | No | Register a new user |
| POST | `user/login.php` | No | Login, start session |
| POST | `user/logout.php` | Yes | Destroy session server-side |

### Ride Lifecycle (User)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `user/book_ride.php` | User | Create a ride, returns `ride_id` and `otp` |
| POST | `user/assign_driver.php` | User | Assign an available driver to a waiting ride |
| GET | `user/ride_status.php?ride_id=` | User | Poll live ride status + driver info |
| POST | `user/pay_ride.php` | User | Record payment for a completed ride |
| POST | `user/submit_feedback.php` | User | Submit rating and comments for a completed ride |
| GET | `user/ride_history.php` | User | Paginated ride history |
| GET | `user/payment_history.php` | User | Paginated payment history + total spent |
| POST | `user/update_profile.php` | User | Update name and/or email |

### Ride Lifecycle (Driver)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `user/advance_ride.php` | Driver | `accepted→driver_arrived` or `driver_arrived→started` |
| POST | `user/complete_ride.php` | Driver | `started→completed`, frees the driver atomically |

### Simulation (Demo Only)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `user/simulation_advance.php` | User | Advances ride through the full lifecycle for the frontend simulation. Not for production driver use. |

> **Driver auth**: driver endpoints require `$_SESSION['driver_id']` (set by the driver login flow, not yet built in this module).

---

## Ride Status Lifecycle

```
waiting → accepted → driver_arrived → started → completed
```

- `waiting` — booked, no driver yet
- `accepted` — driver assigned
- `driver_arrived` — driver at pickup
- `started` — ride in progress
- `completed` — ride finished; payment can now be recorded

State transitions are enforced server-side. Out-of-order calls return `409` or `422`.

---

## Standard Response Format

**Success:**
```json
{ "success": true, "...": "..." }
```

**Error:**
```json
{ "success": false, "message": "Human-readable description." }
```

**Validation error (422):**
```json
{ "success": false, "errors": ["field error 1", "field error 2"] }
```

---

## Security

| Concern | Implementation |
|---|---|
| SQL injection | PDO prepared statements with named parameters everywhere |
| CSRF | Per-session token (`bootstrap.php`), validated on every POST |
| Session fixation | `session_regenerate_id(true)` on login |
| Session cookies | `HttpOnly`, `Secure` (over HTTPS), `SameSite=Strict` |
| Password storage | `bcrypt` via `password_hash()` |
| Timing attacks | `password_verify()` used unconditionally (dummy hash path) |
| OTP storage | bcrypt hash at rest; raw value returned once to user only |
| Error leaks | Raw PDO exceptions never exposed; logged to `logs/db_errors.log` |
| Log access | `logs/.htaccess` blocks direct HTTP access (Apache) |
| DB unique constraints | `UNIQUE KEY` on `payments.ride_id` and `user_feedback.ride_id` |

---

## Current Progress

- [x] Phase 1 — Database schema
- [x] Phase 2 — PDO singleton + environment config
- [x] Phase 3 — Ride model
- [x] Phase 4 — Booking endpoint
- [x] Phase 5 — Full ride lifecycle endpoints
- [x] Phase 6 — Payment + feedback endpoints
- [x] Phase 7 — Frontend SPA (map, booking flow, history, wallet, profile)
- [x] Phase 8 — Security hardening (CSRF, session flags, race condition fixes)
- [ ] Phase 9 — Driver module (login, session, accept/advance rides)
