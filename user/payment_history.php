<?php
declare(strict_types=1);

/**
 * user/payment_history.php
 * GET — returns all payments for the logged-in user, newest first.
 *
 * Optional GET params:
 *   page  (int, default 1)
 *   limit (int, default 20, max 50)
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

require_once __DIR__ . '/../config/db.php';

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

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM payments WHERE user_id = :uid');
    $countStmt->execute([':uid' => $userId]);
    $total = (int) $countStmt->fetchColumn();

    $totalSpentStmt = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM payments WHERE user_id = :uid');
    $totalSpentStmt->execute([':uid' => $userId]);
    $totalSpent = (float) $totalSpentStmt->fetchColumn();

    $stmt = $pdo->prepare(
        'SELECT p.id, p.amount, p.payment_method, p.paid_at,
                r.pickup_location, r.destination
         FROM payments p
         JOIN rides r ON r.id = p.ride_id
         WHERE p.user_id = :uid
         ORDER BY p.paid_at DESC
         LIMIT :lim OFFSET :off'
    );
    $stmt->bindValue(':uid', $userId, PDO::PARAM_INT);
    $stmt->bindValue(':lim', $limit,  PDO::PARAM_INT);
    $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $payments = $stmt->fetchAll();

    echo json_encode([
        'success'      => true,
        'total'        => $total,
        'total_spent'  => $totalSpent,
        'page'         => $page,
        'limit'        => $limit,
        'payments'     => $payments,
    ]);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not fetch payment history.']);
}
