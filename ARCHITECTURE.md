# System Architecture & Rules

## Folder Structure

```text
rapido-user-backend/
├── config/             # Database and environment configs
│   ├── db.php          # Singleton PDO Database class
│   ├── env.sample.php  # Template for local environment vars
│   └── env.php         # Local credentials (ignored by Git)
├── logs/               # Application error logs (ignored by Git)
├── models/             # Database models handling business logic
│   └── Ride.php        # (Upcoming Phase 3)
├── sql/                # SQL definitions
│   └── schema.sql      # Core tables and enums
├── tests/              # Sandbox to test endpoints and DB connectivity
└── user/               # API endpoint files (book_ride, payment, etc.)
```

## Strict Coding Rules
To maintain consistency and security across the team, adhere to the following rules:

1. **PDO ONLY**: All database interactions must use PHP Data Objects (PDO). Do not use `mysqli_`.
2. **Prepared Statements**: Prevent SQL injection using prepared statements for *all* queries containing user input. No variable interpolation (`$var`) in SQL strings.
3. **JSON Responses**: All endpoints must return standard JSON format and use appropriate HTTP headers (`Content-Type: application/json`).
4. **Error Handling**: Use `try/catch` blocks. Do not expose SQL errors directly to the user; log them to `logs/db_errors.log` instead.
5. **PHPDoc**: Document all classes, methods, parameters, and return types.
6. **No Inline HTML**: Endpoint files (`user/*.php`) must strictly be APIs. No HTML should be printed from these files.
7. **Character Encoding**: Ensure all database interactions use `utf8mb4`.