<?php
declare(strict_types=1);

/**
 * user/login.php
 * POST — authenticate a user and start a session.
 *
 * Required POST fields: mobile, password
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$mobile   = trim((string)($_POST['mobile']   ?? ''));
$password = (string)($_POST['password']      ?? '');

if ($mobile === '' || $password === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'mobile and password are required.']);
    exit;
}

try {
    $pdo  = Database::getInstance()->getConnection();
    $stmt = $pdo->prepare(
        'SELECT id, name, email, password_hash FROM users WHERE mobile = :mobile LIMIT 1'
    );
    $stmt->execute([':mobile' => $mobile]);
    $user = $stmt->fetch();

    // Constant-time check — always call password_verify to prevent timing attacks
    $hash = $user ? $user['password_hash'] : '$2y$10$invalidhashinvalidhashinvalidhas';
    if (!$user || !password_verify($password, $hash)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']);
        exit;
    }

    // Regenerate session ID on privilege escalation (login) to prevent session fixation
    session_regenerate_id(true);

    $_SESSION['user_id'] = (int) $user['id'];

    echo json_encode([
        'success'    => true,
        'user_id'    => (int) $user['id'],
        'name'       => $user['name'],
        'email'      => $user['email'] ?? '',
        'csrf_token' => $_SESSION['csrf_token'],
    ]);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Login failed.']);
}
