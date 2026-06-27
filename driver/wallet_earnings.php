<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

if (empty($_SESSION['driver_id']) || !is_int($_SESSION['driver_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Driver access only.']);
    exit;
}

$driverId = $_SESSION['driver_id'];

try {
    $pdo = Database::getInstance()->getConnection();
    
    // Total Earnings
    $earnedStmt = $pdo->prepare('SELECT COALESCE(SUM(fare), 0) FROM rides WHERE driver_id = :did AND ride_status = "completed"');
    $earnedStmt->execute([':did' => $driverId]);
    $totalEarned = (float)$earnedStmt->fetchColumn();
    
    // Earnings history
    $stmt = $pdo->prepare(
        'SELECT r.id, r.pickup_location, r.destination, r.fare, r.created_at, u.name AS passenger_name
         FROM rides r
         JOIN users u ON u.id = r.user_id
         WHERE r.driver_id = :did AND r.ride_status = "completed"
         ORDER BY r.created_at DESC'
    );
    $stmt->execute([':did' => $driverId]);
    $earnings = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'total_earned' => $totalEarned,
        'earnings' => $earnings
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to fetch earnings history.']);
}
