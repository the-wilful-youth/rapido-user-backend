<?php
declare(strict_types=1);

/**
 * user/simulation_advance.php
 * POST — advances a ride through the full lifecycle for demo/simulation purposes.
 *
 * This is a USER-accessible endpoint (no driver session required) that exists
 * solely to support the frontend simulation. It bypasses the driver-only
 * restriction on advance_ride.php and complete_ride.php.
 *
 * Allowed transitions (same state machine):
 *   waiting        → accepted      (also assigns a driver if none assigned)
 *   accepted       → driver_arrived
 *   driver_arrived → started
 *   started        → completed     (also frees the assigned driver)
 *
 * Required POST fields: ride_id, to_status
 * Requires active user session.
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

if (empty($_SESSION['user_id']) || !is_int($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

$userId = $_SESSION['user_id'];

$rideId   = filter_var($_POST['ride_id']   ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$toStatus = trim((string)($_POST['to_status'] ?? ''));

if ($rideId === false || $rideId === null) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'ride_id must be a positive integer.']);
    exit;
}

// Valid simulation transitions
const SIM_TRANSITIONS = [
    'waiting'        => 'accepted',
    'accepted'       => 'driver_arrived',
    'driver_arrived' => 'started',
    'started'        => 'completed',
];

if (!in_array($toStatus, SIM_TRANSITIONS, true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid to_status value.']);
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

// Ownership — user can only advance their own ride
if ((int) $row['user_id'] !== $userId) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied.']);
    exit;
}

$currentStatus = $row['ride_status'];
if (!isset(SIM_TRANSITIONS[$currentStatus]) || SIM_TRANSITIONS[$currentStatus] !== $toStatus) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => "Cannot advance from '{$currentStatus}' to '{$toStatus}'.",
    ]);
    exit;
}

try {
    $pdo->beginTransaction();

    // If moving to 'accepted' and no driver assigned yet, grab one
    if ($toStatus === 'accepted' && $row['driver_id'] === null) {
        $driverStmt = $pdo->prepare(
            'SELECT id FROM drivers WHERE is_available = TRUE LIMIT 1 FOR UPDATE'
        );
        $driverStmt->execute();
        $driver = $driverStmt->fetch();

        if ($driver) {
            $pdo->prepare(
                'UPDATE rides SET driver_id = :did WHERE id = :rid'
            )->execute([':did' => $driver['id'], ':rid' => $rideId]);
            $pdo->prepare(
                'UPDATE drivers SET is_available = FALSE WHERE id = :did'
            )->execute([':did' => $driver['id']]);
        }
    }

    // If completing ride, free the driver
    if ($toStatus === 'completed' && $row['driver_id'] !== null) {
        $pdo->prepare(
            'UPDATE drivers SET is_available = TRUE WHERE id = :did'
        )->execute([':did' => (int) $row['driver_id']]);
    }

    $ride->updateStatus($rideId, $toStatus);

    $pdo->commit();
} catch (Throwable) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not advance ride.']);
    exit;
}

echo json_encode(['success' => true, 'ride_status' => $toStatus]);
