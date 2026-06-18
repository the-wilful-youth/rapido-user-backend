<?php
declare(strict_types=1);

/**
 * Database — PDO Singleton.
 * Sealed against cloning and unserialization.
 */

require_once __DIR__ . '/env.php';

class Database
{
    private static ?Database $instance = null;
    private PDO $conn;

    private function __construct()
    {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $this->conn = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            // Log sanitized error — never log DSN, credentials, or raw exception message
            $this->logError('PDO connection failed: ' . $e->getCode());
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
            exit;
        }
    }

    /** Prevent cloning — enforces single instance */
    private function __clone(): void {}

    /** Prevent unserialization — would bypass constructor and create a second instance */
    public function __wakeup(): never
    {
        throw new \RuntimeException('Cannot unserialize a singleton.');
    }

    public static function getInstance(): static
    {
        if (static::$instance === null) {
            static::$instance = new static();
        }
        return static::$instance;
    }

    public function getConnection(): PDO
    {
        return $this->conn;
    }

    /**
     * Write a sanitized message to the error log.
     * Never pass raw exception messages — they may contain DSN or credentials.
     */
    private function logError(string $message): void
    {
        $logFile   = __DIR__ . '/../logs/db_errors.log';
        $timestamp = date('Y-m-d H:i:s');
        error_log("[{$timestamp}] {$message}" . PHP_EOL, 3, $logFile);
    }
}
