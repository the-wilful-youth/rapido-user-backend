<?php
declare(strict_types=1);

/**
 * user/update_profile.php
 * POST — update the logged-in user's name and/or email.
 *
 * Optional POST fields: name, email
 * At least one field must be provided.
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

validate_csrf();

if (empty($_SESSION['user_id']) || !is_int($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

$userId = $_SESSION['user_id'];
$name   = isset($_POST['name'])  ? trim((string)$_POST['name'])  : null;
$email  = isset($_POST['email']) ? trim((string)$_POST['email']) : null;

$errors = [];
if ($name !== null && strlen($name) < 2) {
    $errors[] = 'name must be at least 2 characters.';
}
if ($name !== null && strlen($name) > 100) {
    $errors[] = 'name must be 100 characters or fewer.';
}
if ($email !== null && $email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'email is invalid.';
}
if ($email !== null && strlen($email) > 255) {
    $errors[] = 'email must be 255 characters or fewer.';
}
if ($name === null && $email === null) {
    $errors[] = 'Provide at least one field to update (name or email).';
}

if ($errors !== []) {
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

try {
    $pdo    = Database::getInstance()->getConnection();
    $sets   = [];
    $params = [':uid' => $userId];

    if ($name !== null)  { $sets[] = 'name = :name';   $params[':name']  = $name; }
    if ($email !== null) { $sets[] = 'email = :email';  $params[':email'] = $email ?: null; }

    $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :uid')
        ->execute($params);

    // Return updated values so the frontend can sync
    $row = $pdo->prepare('SELECT name, email FROM users WHERE id = :uid LIMIT 1');
    $row->execute([':uid' => $userId]);
    $user = $row->fetch();

    echo json_encode(['success' => true, 'name' => $user['name'], 'email' => $user['email']]);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Profile update failed.']);
}
