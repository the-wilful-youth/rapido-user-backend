<?php
declare(strict_types=1);

/**
 * user/register.php
 * POST — register a new user.
 *
 * Required POST fields: name, mobile, password
 * Optional POST fields: email
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$name     = trim((string)($_POST['name']     ?? ''));
$mobile   = trim((string)($_POST['mobile']   ?? ''));
$password = (string)($_POST['password']      ?? '');
$email    = trim((string)($_POST['email']    ?? '')) ?: null;

$errors = [];

if (strlen($name) < 2) {
    $errors[] = 'name must be at least 2 characters.';
}
if (strlen($name) > 100) {
    $errors[] = 'Name must be 100 characters or fewer';
}
if (!preg_match('/^\+?[0-9]{7,15}$/', $mobile)) {
    $errors[] = 'mobile must be a valid phone number.';
}
if (strlen($password) < 8) {
    $errors[] = 'password must be at least 8 characters.';
}
if (strlen($password) > 72) {
    $errors[] = 'Password must be 72 characters or fewer';
}
if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'email is invalid.';
}
if ($email !== null && strlen($email) > 255) {
    $errors[] = 'Email must be 255 characters or fewer';
}

if ($errors !== []) {
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

try {
    $pdo  = Database::getInstance()->getConnection();

    // Check for duplicate mobile
    $chkMobile = $pdo->prepare('SELECT id FROM users WHERE mobile = :mobile LIMIT 1');
    $chkMobile->execute([':mobile' => $mobile]);
    if ($chkMobile->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Mobile number is already registered.']);
        exit;
    }

    // Check for duplicate email (if provided)
    if ($email !== null) {
        $chkEmail = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $chkEmail->execute([':email' => $email]);
        if ($chkEmail->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Email is already registered.']);
            exit;
        }
    }

    $stmt = $pdo->prepare(
        'INSERT INTO users (name, mobile, email, password_hash) VALUES (:name, :mobile, :email, :hash)'
    );
    $stmt->execute([
        ':name'   => $name,
        ':mobile' => $mobile,
        ':email'  => $email,
        ':hash'   => password_hash($password, PASSWORD_BCRYPT),
    ]);

    echo json_encode(['success' => true, 'user_id' => (int) $pdo->lastInsertId()]);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Registration failed.']);
}
