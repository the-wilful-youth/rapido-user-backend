<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

validate_csrf();

if (empty($_SESSION['driver_id']) || !is_int($_SESSION['driver_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Driver access only.']);
    exit;
}

$driverId = $_SESSION['driver_id'];
$name          = isset($_POST['name'])           ? trim((string)$_POST['name'])           : null;
$vehicleNumber = isset($_POST['vehicle_number']) ? trim((string)$_POST['vehicle_number']) : null;
$vehicleType   = isset($_POST['vehicle_type'])   ? trim((string)$_POST['vehicle_type'])   : null;

$errors = [];
if ($name !== null && strlen($name) < 2) {
    $errors[] = 'Name must be at least 2 characters.';
}
if ($name !== null && strlen($name) > 100) {
    $errors[] = 'Name must be 100 characters or fewer.';
}
if ($vehicleNumber !== null && strlen($vehicleNumber) < 3) {
    $errors[] = 'Vehicle number must be at least 3 characters.';
}
if ($vehicleType !== null && !in_array($vehicleType, ['bike','scooty','auto','bike-pink','cab-economy','cab-premium'], true)) {
    $errors[] = 'Invalid vehicle type.';
}
if ($name === null && $vehicleNumber === null && $vehicleType === null) {
    $errors[] = 'Provide at least one field to update.';
}

if ($errors !== []) {
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

try {
    $pdo    = Database::getInstance()->getConnection();
    $sets   = [];
    $params = [':did' => $driverId];

    if ($name !== null)           { $sets[] = 'name = :name';                     $params[':name'] = $name; }
    if ($vehicleNumber !== null)  { $sets[] = 'vehicle_number = :vehicle_number'; $params[':vehicle_number'] = $vehicleNumber; }
    if ($vehicleType !== null)    { $sets[] = 'vehicle_type = :vehicle_type';     $params[':vehicle_type'] = $vehicleType; }

    $pdo->prepare('UPDATE drivers SET ' . implode(', ', $sets) . ' WHERE id = :did')
        ->execute($params);

    // Fetch updated driver details
    $row = $pdo->prepare('SELECT name, vehicle_number, vehicle_type FROM drivers WHERE id = :did LIMIT 1');
    $row->execute([':did' => $driverId]);
    $driver = $row->fetch();

    echo json_encode([
        'success'        => true,
        'name'           => $driver['name'],
        'vehicle_number' => $driver['vehicle_number'],
        'vehicle_type'   => $driver['vehicle_type']
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Profile update failed.']);
}
