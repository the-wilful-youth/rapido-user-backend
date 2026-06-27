<?php
declare(strict_types=1);

/**
 * driver/cancel_ride.php
 * POST endpoint — cancels a ride after arriving at pickup and frees the assigned driver.
 *
 * Driver-only endpoint.
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

// Only driver sessions may cancel
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

if ($row['ride_status'] !== 'driver_arrived') {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => "Cannot cancel a ride with status '{$row['ride_status']}'. Status must be 'driver_arrived'.",
    ]);
    exit;
}

try {
    $pdo->beginTransaction();

    $ride->updateStatus($rideId, 'cancelled');

    // Free the driver so they can accept new rides
    $pdo->prepare('UPDATE drivers SET is_available = TRUE WHERE id = :did')
        ->execute([':did' => $sessionDriverId]);

    $pdo->commit();
} catch (Throwable) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not cancel ride.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Ride successfully cancelled.']);
