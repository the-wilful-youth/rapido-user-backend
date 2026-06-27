<?php
declare(strict_types=1);

/**
 * driver/status.php
 * GET — fetch driver details and active ride status.
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

if (empty($_SESSION['driver_id']) || !is_int($_SESSION['driver_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Driver access only.']);
    exit;
}

$driverId = $_SESSION['driver_id'];

try {
    $pdo = Database::getInstance()->getConnection();
    
    // Fetch driver details
    $driverStmt = $pdo->prepare('SELECT id, name, vehicle_number, vehicle_type, is_available FROM drivers WHERE id = :did LIMIT 1');
    $driverStmt->execute([':did' => $driverId]);
    $driver = $driverStmt->fetch();
    
    if (!$driver) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Driver not found.']);
        exit;
    }
    
    // Fetch active assigned ride if any
    $rideStmt = $pdo->prepare(
        'SELECT r.id, r.user_id, r.pickup_location, r.destination, r.distance_km, r.fare, r.otp, r.ride_status, u.name AS user_name, u.mobile AS user_mobile
         FROM rides r
         JOIN users u ON r.user_id = u.id
         WHERE r.driver_id = :did AND r.ride_status IN ("accepted", "driver_arrived", "started")
         LIMIT 1'
    );
    $rideStmt->execute([':did' => $driverId]);
    $activeRide = $rideStmt->fetch() ?: null;
    
    echo json_encode([
        'success' => true,
        'driver' => [
            'id' => (int)$driver['id'],
            'name' => $driver['name'],
            'vehicle_number' => $driver['vehicle_number'],
            'vehicle_type' => $driver['vehicle_type'],
            'is_available' => (bool)$driver['is_available']
        ],
        'active_ride' => $activeRide
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch driver status.']);
}
