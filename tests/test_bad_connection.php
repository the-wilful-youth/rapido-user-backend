<?php
// tests/test_bad_connection.php

// Temporarily override credentials with bad ones
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'wrong_db_name');
define('DB_USER', 'invalid_user');
define('DB_PASS', 'wrong_pass');

class BadDatabase {
    private static $instance = null;
    private $conn;

    private function __construct() {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $this->conn = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            $this->logError($e->getMessage());
            header('Content-Type: application/json');
            echo json_encode([
                "success" => false,
                "message" => "Database connection failed."
            ]);
            exit;
        }
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new BadDatabase();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->conn;
    }

    private function logError($message) {
        $logFile = __DIR__ . '/../logs/db_errors.log';
        $timestamp = date("Y-m-d H:i:s");
        error_log("[$timestamp] DB Error: $message" . PHP_EOL, 3, $logFile);
    }
}

// Attempt connection
$db = BadDatabase::getInstance();
$conn = $db->getConnection();
