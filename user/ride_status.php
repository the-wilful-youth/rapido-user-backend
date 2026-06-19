<?php
declare(strict_types=1);

/**
 * user/ride_status.php
 * GET endpoint — returns the current state of a ride for the logged-in user.
 *
 * Required GET parameter: ride_id (positive integer)
 * Requires active session with user_id set.
 *
 * Guard Rails covered:
 *   • Status reflects live DB value on every poll.
 *   • Returns 403 Access denied for rides owned by another user.
 *   • driver_name / vehicle_number are null (not an error) when no driver assigned yet.
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../models/Ride.php';

// ── Method check ──────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

if (empty($_SESSION['user_id']) || !is_int($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

$sessionUserId = $_SESSION['user_id'];

// ── Input validation ──────────────────────────────────────────────────────────
// Accept only a string of digits that maps to a positive integer.
// filter_input returns null (param missing) or false (fails filter).

$rawRideId = $_GET['ride_id'] ?? '';
$rideId    = filter_var($rawRideId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($rideId === false || $rideId === null) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'ride_id must be a positive integer.']);
    exit;
}

// ── Fetch ride with driver details ────────────────────────────────────────────

try {
    $ride = new Ride(Database::getInstance()->getConnection());
    $row  = $ride->getRideWithDriver($rideId);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not fetch ride.']);
    exit;
}

// ── Not found ─────────────────────────────────────────────────────────────────

if ($row === null) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Ride not found.']);
    exit;
}

// ── Ownership check ───────────────────────────────────────────────────────────
// Prevents one user from polling another user's ride details.

if ((int) $row['user_id'] !== $sessionUserId) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied.']);
    exit;
}

// ── Response ──────────────────────────────────────────────────────────────────
// driver_name and vehicle_number are null when no driver has been assigned yet
// (LEFT JOIN returns NULL columns) — this is expected, not an error.

echo json_encode([
    'success'        => true,
    'ride_id'        => (int) $row['id'],
    'ride_status'    => $row['ride_status'],
    'payment_status' => $row['payment_status'],
    'fare'           => (float) $row['fare'],
    'distance'       => (float) $row['distance_km'],
    'driver_name'    => $row['driver_name'],       // null until driver assigned
    'vehicle_number' => $row['vehicle_number'],    // null until driver assigned
]);
