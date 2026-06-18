# Rapido Clone — User Backend Module

## Module Purpose
This module handles all backend logic for the user-facing side of the Rapido Clone platform. It provides a set of secure REST APIs built in pure PHP 8 to manage user authentication (registration and login), ride lifecycle (booking, polling status, tracking), and payments. It uses MySQL 8 with PDO for robust data persistence and enforces strict state transitions for rides.

## Prerequisites
- **PHP 8+**
- **MySQL 8**
- **Local Web Server** (e.g., XAMPP, WAMP, or MAMP)

## Setup Steps
1. **Clone the repository** and place it in your local server's document root (e.g., `C:\xampp\htdocs\rapido-user-backend`).
2. **Database Setup**: Open phpMyAdmin, create a database named `rapido_clone`, and import the schema from `sql/schema.sql`.
3. **Configure Environment**: 
   - Copy `config/env.sample.php` and rename it to `config/env.php`.
   - Update `DB_PASS` with your local MySQL password (leave blank for default XAMPP).
4. **Start Server**: Ensure both Apache and MySQL are running in your control panel.

## API Endpoint Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `user/register.php` | Register a new user | No |
| POST | `user/login.php` | Authenticate and start a session | No |
| POST | `user/book_ride.php` | Create a new ride booking | Yes |
| GET | `user/ride_status.php` | Poll the current status of a specific ride | Yes |
| POST | `user/assign_driver.php` | Assign an available driver to a waiting ride | Yes |
| POST | `user/complete_ride.php` | Manually complete a ride (temporary driver mock) | Yes |
| POST | `user/pay_ride.php` | Record payment for a completed ride | Yes |

*Note: Endpoints requiring auth expect a valid `PHPSESSID` cookie representing the logged-in user.*

## Ride Status Lifecycle (ENUM)
Rides enforce strict state transitions and must follow this flow:
1. `waiting` — Ride is booked, waiting for a driver to accept.
2. `accepted` — A driver has been assigned.
3. `driver_arrived` — The driver has reached the pickup location.
4. `started` — The ride is in progress.
5. `completed` — The ride is finished. Payments can only be processed in this state.

## Standard Error Response Format
All errors return an appropriate HTTP status code (e.g., 401, 403, 404, 409, 422, 500) along with a JSON payload:

```json
{
  "success": false,
  "message": "A human-readable error description."
}
```
*Validation errors (422) may omit `message` and provide an `errors` array instead with specific field violations.*

## Security Notes
- **SQL Injection**: All database queries use PDO prepared statements with named parameters. No manual string concatenation.
- **XSS / Input Validation**: All user inputs are trimmed, type-checked, and length-validated (e.g., bounds checking to match database constraints).
- **Passwords**: Hashed securely using `bcrypt` via `password_hash()`. Verified safely against timing attacks using `password_verify()`.
- **Session Fixation**: Fixed by regenerating the session ID explicitly upon a successful login.
- **Error Leaks**: Raw stack traces and PDO errors are masked behind generic JSON error messages in production execution paths.
