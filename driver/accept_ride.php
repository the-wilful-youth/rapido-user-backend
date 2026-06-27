<?php
declare(strict_types=1);

/**
 * driver/accept_ride.php
 * POST — atomically accept a passenger ride request.
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

if (empty($_SESSION['driver_id']) || !is_int($_SESSION['driver_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Driver access only.']);
    exit;
}

$driverId = $_SESSION['driver_id'];
$rawRideId = $_POST['ride_id'] ?? '';
$rideId = filter_var($rawRideId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

if ($rideId === false || $rideId === null) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'ride_id must be a positive integer.']);
    exit;
}

try {
    $pdo = Database::getInstance()->getConnection();
    $pdo->beginTransaction();
    
    // Check if driver exists and lock the row
    $driverStmt = $pdo->prepare('SELECT id, is_available FROM drivers WHERE id = :did FOR UPDATE');
    $driverStmt->execute([':did' => $driverId]);
    $driver = $driverStmt->fetch();
    
    if (!$driver) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Driver not found.']);
        exit;
    }
    
    // Check if ride is still waiting and lock the row
    $rideStmt = $pdo->prepare('SELECT id, ride_status, driver_id FROM rides WHERE id = :rid FOR UPDATE');
    $rideStmt->execute([':rid' => $rideId]);
    $ride = $rideStmt->fetch();
    
    if (!$ride) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Ride not found.']);
        exit;
    }
    
    if ($ride['ride_status'] !== 'waiting' || $ride['driver_id'] !== null) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Ride has already been accepted or is unavailable.']);
        exit;
    }
    
    // Update ride to accepted with driver_id
    $updateRide = $pdo->prepare('UPDATE rides SET driver_id = :did, ride_status = "accepted" WHERE id = :rid');
    $updateRide->execute([':did' => $driverId, ':rid' => $rideId]);
    
    // Mark driver unavailable
    $updateDriver = $pdo->prepare('UPDATE drivers SET is_available = FALSE WHERE id = :did');
    $updateDriver->execute([':did' => $driverId]);
    
    $pdo->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Ride accepted successfully.',
        'ride_status' => 'accepted'
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to accept ride.']);
}
