<?php
declare(strict_types=1);

/**
 * driver/complete_ride.php
 * POST endpoint — marks a ride as 'completed' and frees the assigned driver.
 *
 * This endpoint is intentionally driver-only: only sessions with a valid
 * driver_id set (by the driver login flow) may call it.
 * A plain user session is rejected with 403.
 *
 * Required POST field: ride_id
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../models/Ride.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

validate_csrf();

// Only driver sessions may complete a ride
if (empty($_SESSION['driver_id']) || !is_int($_SESSION['driver_id'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden. Driver access only.']);
    exit;
}

$sessionDriverId = $_SESSION['driver_id'];

$rawRideId = $_POST['ride_id'] ?? '';
$rideId    = filter_var($rawRideId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($rideId === false || $rideId === null) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'ride_id must be a positive integer.']);
    exit;
}

try {
    $pdo  = Database::getInstance()->getConnection();
    $ride = new Ride($pdo);
    $row  = $ride->getRideById($rideId);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not fetch ride.']);
    exit;
}

if ($row === null) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Ride not found.']);
    exit;
}

// Ensure this driver is the one assigned to the ride
if ((int) $row['driver_id'] !== $sessionDriverId) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied.']);
    exit;
}

if ($row['ride_status'] !== 'started') {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => "Cannot complete a ride with status '{$row['ride_status']}'. Ride must be 'started'.",
    ]);
    exit;
}

try {
    $pdo->beginTransaction();

    $ride->updateStatus($rideId, 'completed');

    // Free the driver so they can accept new rides
    $pdo->prepare('UPDATE drivers SET is_available = TRUE WHERE id = :did')
        ->execute([':did' => $sessionDriverId]);

    $pdo->commit();
} catch (Throwable) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not complete ride.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Ride marked complete.']);
