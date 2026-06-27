<?php
declare(strict_types=1);

/**
 * driver/available_rides.php
 * GET — fetch all waiting rides available to be accepted.
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

if (empty($_SESSION['driver_id']) || !is_int($_SESSION['driver_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Driver access only.']);
    exit;
}

try {
    $pdo = Database::getInstance()->getConnection();
    
    // Fetch all rides in 'waiting' status (available requests)
    $stmt = $pdo->prepare(
        'SELECT r.id, r.pickup_location, r.destination, r.distance_km, r.fare, r.created_at, u.name AS user_name
         FROM rides r
         JOIN users u ON r.user_id = u.id
         WHERE r.ride_status = "waiting" AND r.driver_id IS NULL
         ORDER BY r.id DESC'
    );
    $stmt->execute();
    $rides = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'rides' => $rides
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch available rides.']);
}
