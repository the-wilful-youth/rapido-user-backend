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

echo json_encode([
    'success'    => true,
    'csrf_token' => $_SESSION['csrf_token'],
    'user'       => $user
]);
