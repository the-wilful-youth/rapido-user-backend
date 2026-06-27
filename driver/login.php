<?php
declare(strict_types=1);

/**
 * driver/login.php
 * POST — authenticate a driver and start a driver session.
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
        'SELECT id, name, vehicle_number, vehicle_type, password_hash, is_available FROM drivers WHERE mobile = :mobile LIMIT 1'
    );
    $stmt->execute([':mobile' => $mobile]);
    $driver = $stmt->fetch();

    // Constant-time check — always call password_verify to prevent timing attacks
    $hash = ($driver && !empty($driver['password_hash'])) ? $driver['password_hash'] : '$2y$10$invalidhashinvalidhashinvalidhas';
    if (!$driver || empty($driver['password_hash']) || !password_verify($password, $hash)) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']);
        exit;
    }

    // Regenerate session ID on privilege escalation (login) to prevent session fixation
    session_regenerate_id(true);

    $_SESSION['driver_id'] = (int) $driver['id'];

    echo json_encode([
        'success'        => true,
        'driver_id'      => (int) $driver['id'],
        'name'           => $driver['name'],
        'vehicle_number' => $driver['vehicle_number'],
        'vehicle_type'   => $driver['vehicle_type'],
        'is_available'   => (bool) $driver['is_available'],
        'csrf_token'     => $_SESSION['csrf_token'],
    ]);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Driver login failed.']);
}
