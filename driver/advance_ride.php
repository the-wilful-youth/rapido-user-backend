<?php
declare(strict_types=1);

/**
 * driver/advance_ride.php
 * POST — advance a ride to the next lifecycle state.
 *
 * Driver-only endpoint. Allowed transitions:
 *   accepted       → driver_arrived
 *   driver_arrived → started
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

// Allowed state machine transitions for this endpoint
const TRANSITIONS = [
    'accepted'       => 'driver_arrived',
    'driver_arrived' => 'started',
];

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

if ((int) $row['driver_id'] !== $sessionDriverId) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied.']);
    exit;
}

$currentStatus = $row['ride_status'];
if (!array_key_exists($currentStatus, TRANSITIONS)) {
    http_response_code(422);
    echo json_encode([
        'success' => false,
        'message' => "Cannot advance ride from status '{$currentStatus}'.",
    ]);
    exit;
}

$nextStatus = TRANSITIONS[$currentStatus];

try {
    $ride->updateStatus($rideId, $nextStatus);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not advance ride status.']);
    exit;
}

echo json_encode(['success' => true, 'ride_status' => $nextStatus]);
