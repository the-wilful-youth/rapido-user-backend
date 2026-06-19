<?php
declare(strict_types=1);

/**
 * user/assign_driver.php
 * POST — assign an available driver to a waiting ride.
 *
 * Required POST fields: ride_id
 * Requires active session with user_id set.
 *
 * Picks the first available driver and marks them unavailable atomically.
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

$rawRideId = $_POST['ride_id'] ?? '';
$rideId    = filter_var($rawRideId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($rideId === false || $rideId === null) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'ride_id must be a positive integer.']);
    exit;
}

try {
    $pdo = Database::getInstance()->getConnection();
    $pdo->beginTransaction();

    // Verify ride belongs to this user and is in 'waiting' state — locked to prevent concurrent assignment
    $rideStmt = $pdo->prepare(
        'SELECT id, driver_id, ride_status FROM rides WHERE id = :rid AND user_id = :uid LIMIT 1 FOR UPDATE'
    );
    $rideStmt->execute([':rid' => $rideId, ':uid' => $userId]);
    $ride = $rideStmt->fetch();

    if (!$ride) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Ride not found.']);
        exit;
    }

    // Ride must be in 'waiting' state — blocks re-assignment on completed/started rides
    if ($ride['ride_status'] !== 'waiting') {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => "Ride is not in 'waiting' state."]);
        exit;
    }

    if ($ride['driver_id'] !== null) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Driver already assigned.']);
        exit;
    }

    // Lock the first available driver row to prevent race conditions
    $driverStmt = $pdo->prepare(
        'SELECT id, name, vehicle_number FROM drivers WHERE is_available = TRUE LIMIT 1 FOR UPDATE'
    );
    $driverStmt->execute();
    $driver = $driverStmt->fetch();

    if (!$driver) {
        $pdo->rollBack();
        http_response_code(503);
        echo json_encode(['success' => false, 'message' => 'No drivers available.']);
        exit;
    }

    // Assign driver to ride and update ride status
    $pdo->prepare(
        "UPDATE rides SET driver_id = :did, ride_status = 'accepted' WHERE id = :rid"
    )->execute([':did' => $driver['id'], ':rid' => $rideId]);

    // Mark driver as unavailable
    $pdo->prepare(
        'UPDATE drivers SET is_available = FALSE WHERE id = :did'
    )->execute([':did' => $driver['id']]);

    $pdo->commit();

    echo json_encode([
        'success'        => true,
        'driver_id'      => $driver['id'],
        'driver_name'    => $driver['name'],
        'vehicle_number' => $driver['vehicle_number'],
        'ride_status'    => 'accepted',
    ]);
} catch (Throwable) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Driver assignment failed.']);
}
