<?php
declare(strict_types=1);

/**
 * user/csrf.php
 * GET — returns the current session CSRF token.
 * Frontend fetches this once on load and attaches it to all POST requests.
 */

require_once __DIR__ . '/../config/bootstrap.php';
require_once __DIR__ . '/../config/db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$user = null;
if (!empty($_SESSION['user_id'])) {
    try {
        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->prepare('SELECT id, name, mobile, email FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $_SESSION['user_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $user = [
                'user_id' => (int)$row['id'],
                'name'    => $row['name'],
                'mobile'  => $row['mobile'],
                'email'   => $row['email'] ?? ''
            ];
        }
    } catch (Throwable) {
        // Ignore DB error during session checks; just default user to null
    }
}

$driver = null;
if (!empty($_SESSION['driver_id'])) {
    try {
        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->prepare('SELECT id, name, mobile, vehicle_number, vehicle_type, is_available FROM drivers WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $_SESSION['driver_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $driver = [
                'driver_id'      => (int)$row['id'],
                'name'           => $row['name'],
                'mobile'         => $row['mobile'],
                'vehicle_number' => $row['vehicle_number'],
                'vehicle_type'   => $row['vehicle_type'],
                'is_available'   => (bool)$row['is_available']
            ];
        }
    } catch (Throwable) {
        // Ignore
    }
}

echo json_encode([
    'success'    => true,
    'csrf_token' => $_SESSION['csrf_token'],
    'user'       => $user,
    'driver'     => $driver
]);
