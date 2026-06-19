<?php
declare(strict_types=1);

/**
 * user/ride_history.php
 * GET — returns all rides for the logged-in user, newest first.
 *
 * Optional GET params:
 *   page  (int, default 1)
 *   limit (int, default 20, max 50)
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../models/Ride.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

if (empty($_SESSION['user_id']) || !is_int($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

$userId = $_SESSION['user_id'];
$limit  = min(50, max(1, (int)($_GET['limit'] ?? 20)));
$page   = max(1, (int)($_GET['page'] ?? 1));
$offset = ($page - 1) * $limit;

try {
    $pdo = Database::getInstance()->getConnection();

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM rides WHERE user_id = :uid');
    $countStmt->execute([':uid' => $userId]);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare(
        'SELECT r.id, r.pickup_location, r.destination, r.distance_km, r.fare,
                r.ride_status, r.payment_status, r.created_at,
                d.name AS driver_name, d.vehicle_number
         FROM rides r
         LEFT JOIN drivers d ON d.id = r.driver_id
         WHERE r.user_id = :uid
         ORDER BY r.created_at DESC
         LIMIT :lim OFFSET :off'
    );
    $stmt->bindValue(':uid', $userId, PDO::PARAM_INT);
    $stmt->bindValue(':lim', $limit,  PDO::PARAM_INT);
    $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rides = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'total'   => $total,
        'page'    => $page,
        'limit'   => $limit,
        'rides'   => $rides,
    ]);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not fetch ride history.']);
}
