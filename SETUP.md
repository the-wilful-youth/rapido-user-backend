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
    -- Seeds a driver with mobile number '+919999999999' and password 'password123'
    INSERT INTO drivers (name, mobile, vehicle_number, vehicle_type, password_hash, is_available)
    VALUES ('Test Driver', '+919999999999', 'JH 05 AB 0001', 'bike', '$2y$10$D2BqfV9M/9iK0r19YV7O9.v2c5uLh3wDkG6vX8Wd4x8y7m2Z2n4xO', TRUE);
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

The SPA communicates with the backend via relative paths (`../user/*.php` and `../driver/*.php`), so it must be served through Apache/Nginx — **do not open `index.html` directly as a `file://` URL**.

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

## 8. Role-Based Flows (Passenger vs Captain)

The platform provides dedicated, separated dashboard experiences based on the selected role during authentication:

### Passenger Flow
1. Navigate to the signup/login screen, select **Passenger** tab.
2. Register or sign in. Set pickup and destination addresses.
3. Select vehicle type and click **Confirm Booking**. The app pings searching for nearby captains.
4. Once accepted, track the captain's status (Arrived &rarr; Started &rarr; Completed) on the map and view the OTP.

### Captain Flow
1. Navigate to the Sign In screen, select the **Captain (Rider)** tab.
2. Log in using Captain credentials (e.g. `9999999999` and `password123`).
3. Land directly in the slate-dark Captain Console. Passenger actions are completely hidden.
4. Toggle availability to **Online** to fetch nearby pending passenger requests.
5. Accept a request, mark arrival, verify the passenger's OTP, start the ride, and complete it.

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

| File / Folder | Purpose |
|---|---|
| `config/bootstrap.php` | Starts session with secure cookie flags, initialises CSRF token |
| `config/db.php` | PDO singleton — one connection per request |
| `config/env.php` | Local DB credentials (git-ignored) |
| `config/env.sample.php` | Credentials template — commit this, not `env.php` |
| `driver/` | Dedicated Captain API endpoints (login, status, toggle duty, accept & advance rides) |
| `user/` | Dedicated Passenger and shared endpoints (register, login, CSRF, booking, history) |
| `sql/schema.sql` | Full DB schema — re-run to reset the database |
| `logs/db_errors.log` | PDO error log — never exposed over HTTP |
