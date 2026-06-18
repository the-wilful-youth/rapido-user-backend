<?php
declare(strict_types=1);

/**
 * user/pay_ride.php
 * POST endpoint — records payment for a completed ride.
 *
 * Required POST fields: ride_id
 * Optional POST field:  payment_method (default: 'cash')
 * Requires active session with user_id set.
 *
 * Guard Rails:
 *   • Double-payment  → "Payment already recorded."
 *   • Pre-completion  → "Ride is not yet completed."
 *   • Transaction wraps INSERT + markPaid — rolls back on failure.
 */

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../models/Ride.php';

// ── Method check ──────────────────────────────────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

// ── Input ─────────────────────────────────────────────────────────────────────

$rawRideId = $_POST['ride_id'] ?? '';
$rideId    = filter_var($rawRideId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($rideId === false || $rideId === null) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'ride_id must be a positive integer.']);
    exit;
}

$paymentMethod = trim(strip_tags((string)($_POST['payment_method'] ?? 'cash')));
if ($paymentMethod === '') {
    $paymentMethod = 'cash';
}
if (!in_array($paymentMethod, ['cash', 'upi', 'card'], true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Invalid payment method']);
    exit;
}

// ── Fetch ride ────────────────────────────────────────────────────────────────

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

// ── Ownership ─────────────────────────────────────────────────────────────────

if ((int) $row['user_id'] !== $sessionUserId) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied.']);
    exit;
}

// ── Completion guard ──────────────────────────────────────────────────────────

if ($row['ride_status'] !== 'completed') {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Ride is not yet completed.']);
    exit;
}

// ── Double-payment guard ──────────────────────────────────────────────────────

if ($row['payment_status'] === 'paid') {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Payment already recorded.']);
    exit;
}

$amount = (float) $row['fare'];

// ── Transaction ───────────────────────────────────────────────────────────────

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare(
        'INSERT INTO payments (ride_id, user_id, amount, payment_method)
         VALUES (:ride_id, :user_id, :amount, :method)'
    );
    $stmt->execute([
        ':ride_id' => $rideId,
        ':user_id' => $sessionUserId,
        ':amount'  => $amount,
        ':method'  => $paymentMethod,
    ]);
    $paymentId = (int) $pdo->lastInsertId();

    $ride->markPaid($rideId);

    $pdo->commit();
} catch (Throwable) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Payment could not be recorded.']);
    exit;
}

// ── Response ──────────────────────────────────────────────────────────────────

echo json_encode([
    'success'    => true,
    'message'    => 'Payment recorded.',
    'amount'     => $amount,
    'payment_id' => $paymentId,
]);
