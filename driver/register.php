<?php
declare(strict_types=1);

/**
 * driver/register.php
 * POST — register a new driver.
 *
 * Required POST fields: name, mobile, vehicle_number, vehicle_type, password
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$name          = trim((string)($_POST['name']           ?? ''));
$mobile        = trim((string)($_POST['mobile']         ?? ''));
$vehicleNumber = trim((string)($_POST['vehicle_number'] ?? ''));
$vehicleType   = trim((string)($_POST['vehicle_type']   ?? ''));
$password      = (string)($_POST['password']            ?? '');

$errors = [];

if (strlen($name) < 2) {
    $errors[] = 'Name must be at least 2 characters.';
}
if (strlen($name) > 100) {
    $errors[] = 'Name must be 100 characters or fewer.';
}
if (!preg_match('/^\+?[0-9]{7,15}$/', $mobile)) {
    $errors[] = 'Mobile must be a valid phone number.';
}
if (strlen($vehicleNumber) < 3 || strlen($vehicleNumber) > 50) {
    $errors[] = 'Vehicle number must be between 3 and 50 characters.';
}
$validTypes = ['bike', 'scooty', 'auto', 'bike-pink', 'cab-economy', 'cab-premium'];
if (!in_array($vehicleType, $validTypes, true)) {
    $errors[] = 'Invalid vehicle type selected.';
}
if (strlen($password) < 8) {
    $errors[] = 'Password must be at least 8 characters.';
}
if (strlen($password) > 72) {
    $errors[] = 'Password must be 72 characters or fewer.';
}

if ($errors !== []) {
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

try {
    $pdo = Database::getInstance()->getConnection();

    // Check for duplicate mobile
    $chkMobile = $pdo->prepare('SELECT id FROM drivers WHERE mobile = :mobile LIMIT 1');
    $chkMobile->execute([':mobile' => $mobile]);
    if ($chkMobile->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Mobile number is already registered for a Captain.']);
        exit;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO drivers (name, mobile, vehicle_number, vehicle_type, password_hash, is_available) 
         VALUES (:name, :mobile, :vehicle_number, :vehicle_type, :hash, TRUE)'
    );
    $stmt->execute([
        ':name'           => $name,
        ':mobile'         => $mobile,
        ':vehicle_number' => $vehicleNumber,
        ':vehicle_type'   => $vehicleType,
        ':hash'           => password_hash($password, PASSWORD_BCRYPT),
    ]);

    echo json_encode(['success' => true, 'driver_id' => (int) $pdo->lastInsertId()]);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Captain registration failed.']);
}
