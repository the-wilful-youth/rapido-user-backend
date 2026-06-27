<?php
declare(strict_types=1);

/**
 * driver/toggle_availability.php
 * POST — toggle driver availability.
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

try {
    $pdo = Database::getInstance()->getConnection();
    
    // Check if the driver exists
    $stmt = $pdo->prepare('SELECT is_available FROM drivers WHERE id = :did LIMIT 1');
    $stmt->execute([':did' => $driverId]);
    $driver = $stmt->fetch();
    
    if (!$driver) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Driver not found.']);
        exit;
    }
    
    $newStatus = $driver['is_available'] ? 0 : 1;
    
    $updateStmt = $pdo->prepare('UPDATE drivers SET is_available = :status WHERE id = :did');
    $updateStmt->execute([':status' => $newStatus, ':did' => $driverId]);
    
    echo json_encode([
        'success' => true,
        'is_available' => (bool)$newStatus
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to toggle availability.']);
}
