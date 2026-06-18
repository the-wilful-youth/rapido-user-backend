<?php
declare(strict_types=1);

/**
 * tests/test_bad_connection.php
 * Verifies that wrong DB credentials produce a JSON error and a log entry.
 *
 * Run: php tests/test_bad_connection.php
 * Expected output: {"success":false,"message":"Database connection failed."}
 */

// Override constants BEFORE loading db.php
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'wrong_db');
define('DB_USER', 'invalid_user');
define('DB_PASS', 'wrong_pass');

// db.php reads the constants above — no class duplication needed
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');

// This will trigger the catch block in Database::__construct and exit with JSON error
Database::getInstance();
