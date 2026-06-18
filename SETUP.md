# Team Setup Instructions

Follow these steps to get the project running seamlessly on your local machine without overriding your teammates' settings.

## 1. Database Setup
1. Start your local web server (XAMPP, MAMP, Herd, Valet, etc.) so MySQL is running.
2. Open your preferred database manager (phpMyAdmin, TablePlus, DataGrip) or terminal.
3. Create a new database named `rapido_clone`:
   ```sql
   CREATE DATABASE rapido_clone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. Import the schema by running the `sql/schema.sql` file against your new database.

## 2. Environment Configuration
To keep everyone's local database passwords secure, we do not commit `config/env.php` to Git.

1. Go to the `config/` directory.
2. Copy `env.sample.php` and paste it.
3. Rename the copied file to `env.php`.
4. Update the credentials inside `env.php` to match your local setup:
   ```php
   // config/env.php
   define('DB_HOST', '127.0.0.1');
   define('DB_NAME', 'rapido_clone');
   define('DB_USER', 'root'); // Your local DB username
   define('DB_PASS', '');     // Your local DB password
   ```

## 3. Verify Setup (Testing)
To confirm everything is working:
1. Ensure this project folder is being served by your local server.
2. Open your browser and navigate to the connection test script:
   ```text
   http://localhost/rapido-user-backend/tests/test_connection.php
   ```
   *(Note: Adjust `localhost/rapido-user-backend/` based on your specific local server routing).*
3. If you see this output, your setup is complete and working perfectly:
   ```json
   {"success":true,"message":"Connected successfully to the database."}
   ```
4. You can also test the failure log by intentionally messing up your password in `env.php` and navigating to `tests/test_bad_connection.php` (it will log an error in `logs/db_errors.log`).