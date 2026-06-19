# Setup Guide

Follow these steps to run the project locally from scratch.

---

## Prerequisites

| Requirement | Version |
|---|---|
| PHP | 8.0+ |
| MySQL | 8.0+ |
| Local web server | Apache (XAMPP / MAMP / Laragon) or Nginx |

---

## 1. Clone & Place the Project

Clone the repo into your web server's document root so PHP can serve it:

```bash
# XAMPP (Windows)
C:\xampp\htdocs\rapido-user-backend

# MAMP (macOS)
/Applications/MAMP/htdocs/rapido-user-backend

# Laragon
C:\laragon\www\rapido-user-backend
```

---

## 2. Database Setup

1. Start MySQL via your control panel (XAMPP / MAMP / Laragon).
2. Create the database:
   ```sql
   CREATE DATABASE rapido_clone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Import the schema:
   ```bash
   mysql -u root -p rapido_clone < sql/schema.sql
   ```
   Or open `sql/schema.sql` in phpMyAdmin and click **Import**.

4. Seed at least one driver row so ride assignment works:
   ```sql
   INSERT INTO drivers (name, mobile, vehicle_number, is_available)
   VALUES ('Test Driver', '+919999999999', 'JH 05 AB 0001', TRUE);
   ```

---

## 3. Environment Config

```bash
cp config/env.sample.php config/env.php
```

Edit `config/env.php` with your local credentials:

```php
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'rapido_clone');
define('DB_USER', 'root');
define('DB_PASS', '');   // your MySQL password; blank for default XAMPP
```

`config/env.php` is git-ignored — never commit it.

---

## 4. Country Code (Optional)

The frontend reads the dialling prefix from a `<meta>` tag in `public/index.html`:

```html
<meta name="country-code" content="+91">
```

Change `+91` to your country code if needed. This is the only place it needs to change.

---

## 5. Run the Frontend

Start Apache, then open:

```
http://localhost/rapido-user-backend/public/index.html
```

The SPA communicates with the backend via relative paths (`../user/*.php`), so it must be served through Apache/Nginx — **do not open `index.html` directly as a `file://` URL**.

---

## 6. Verify the Setup

Visit the connection test:

```
http://localhost/rapido-user-backend/tests/test_connection.php
```

Expected response:
```json
{"success": true, "message": "Connected successfully to the database."}
```

To test error logging, temporarily break your DB password in `env.php` and visit `tests/test_bad_connection.php`. Check `logs/db_errors.log` for the logged error code.

---

## 7. CSRF Token Flow

Every POST request requires a `csrf_token` field. The frontend handles this automatically:

1. On page load, `app.js` fetches `user/csrf.php` and caches the token in memory.
2. The token is also returned in the `login.php` response and refreshed in the cache.
3. `apiPost()` in `app.js` injects the token into every POST body automatically.

If you are calling the API manually (e.g., with Postman), first `GET user/csrf.php` with your session cookie, then include the returned `csrf_token` in subsequent POST bodies.

---

## 8. Running the Simulation (Demo Mode)

The frontend includes a ride simulation that drives the full lifecycle without requiring a real driver app:

1. Register or log in.
2. Select a pickup and destination from the autocomplete.
3. Choose a vehicle type and click **Confirm Booking**.
4. The frontend calls `book_ride.php`, then `assign_driver.php`, then steps through `simulation_advance.php` automatically — advancing the DB ride status in sync with the map animation.
5. After the ride completes, pay and rate from the completion screen.

> **Note:** The simulation requires at least one driver record in the `drivers` table with `is_available = TRUE` (see step 2.4 above).

---

## 9. Nginx Config (if not using Apache)

Apache `.htaccess` blocks web access to `logs/`. For Nginx, add this to your server block:

```nginx
location /rapido-user-backend/logs/ {
    deny all;
    return 404;
}
```

---

## File Summary

| File | Purpose |
|---|---|
| `config/bootstrap.php` | Starts session with secure cookie flags, initialises CSRF token |
| `config/db.php` | PDO singleton — one connection per request |
| `config/env.php` | Local DB credentials (git-ignored) |
| `config/env.sample.php` | Credentials template — commit this, not `env.php` |
| `sql/schema.sql` | Full DB schema — re-run to reset the database |
| `user/csrf.php` | Returns current session CSRF token |
| `user/simulation_advance.php` | Demo-only lifecycle advancer for the frontend simulation |
| `logs/db_errors.log` | PDO error log — never exposed over HTTP |
