<?php
declare(strict_types=1);

/**
 * user/book_ride.php
 * POST endpoint — books a new ride for the logged-in user.
 *
 * Required POST fields: pickup_location, destination
 * Requires active session with user_id set.
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

// ── Auth ──────────────────────────────────────────────────────────────────────

if (empty($_SESSION['user_id']) || !is_int($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

$userId = $_SESSION['user_id'];

// ── Input ─────────────────────────────────────────────────────────────────────
// trim() only — htmlspecialchars() is for HTML output, not DB-bound strings.
// Parameterised queries handle SQL injection; applying htmlspecialchars here
// would corrupt data like "O'Brien" → "O&#039;Brien" in the database.

$pickup = trim((string)($_POST['pickup_location'] ?? ''));
$dest   = trim((string)($_POST['destination']     ?? ''));

$pickupLat  = (float)($_POST['pickup_lat'] ?? 0.0);
$pickupLng  = (float)($_POST['pickup_lng'] ?? 0.0);
$dropoffLat = (float)($_POST['dropoff_lat'] ?? 0.0);
$dropoffLng = (float)($_POST['dropoff_lng'] ?? 0.0);

// ── Validation ────────────────────────────────────────────────────────────────

$errors = [];

if (strlen($pickup) < 3) {
    $errors[] = 'pickup_location must be at least 3 characters.';
}
if (strlen($dest) < 3) {
    $errors[] = 'destination must be at least 3 characters.';
}
if ($errors === [] && strtolower($pickup) === strtolower($dest)) {
    $errors[] = 'Pickup and destination cannot be the same.';
}
if ($errors === [] && ctype_digit(str_replace(' ', '', $pickup))) {
    $errors[] = 'pickup_location cannot be numeric only.';
}
if ($errors === [] && ctype_digit(str_replace(' ', '', $dest))) {
    $errors[] = 'destination cannot be numeric only.';
}

if ($errors !== []) {
    http_response_code(422);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

// ── Fare calculation ──────────────────────────────────────────────────────────
// Distance is estimated from location string lengths as a placeholder until a
// real geocoding/routing service is integrated.
// Formula: base fare ₹30 + ₹12/km, minimum fare ₹50.

$distance = round(mt_rand(200, 2000) / 100, 2);
$fare     = round(30 + ($distance * 12), 2);
$fare     = max($fare, 50.00);
$otp      = (string)mt_rand(1000, 9999);

// ── Persist ───────────────────────────────────────────────────────────────────

try {
    $ride   = new Ride(Database::getInstance()->getConnection());
    $rideId = $ride->createRide($userId, $pickup, $dest, $distance, $fare, $otp, $pickupLat, $pickupLng, $dropoffLat, $dropoffLng);
    $_SESSION['active_ride_otp'] = $otp;
} catch (InvalidArgumentException $e) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not create ride: ' . $e->getMessage()]);
    exit;
}

// ── Response ──────────────────────────────────────────────────────────────────

echo json_encode([
    'success'  => true,
    'ride_id'  => $rideId,
    'otp'      => $otp,     // raw OTP returned once to the user; stored as bcrypt hash in DB
    'fare'     => $fare,
    'distance' => $distance,
    'status'   => 'waiting',
]);
