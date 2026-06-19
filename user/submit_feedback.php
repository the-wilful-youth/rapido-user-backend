<?php
declare(strict_types=1);

/**
 * user/submit_feedback.php
 * POST — submit rating and written feedback for a completed ride.
 *
 * Required POST fields: ride_id, rating
 * Optional POST fields: comments
 * Requires active session with user_id set.
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

if (empty($_SESSION['user_id']) || !is_int($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized.']);
    exit;
}

$userId   = $_SESSION['user_id'];

$rideId  = filter_var($_POST['ride_id'] ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$rating  = filter_var($_POST['rating']  ?? '', FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 5]]);
$comments = isset($_POST['comments']) ? trim((string)$_POST['comments']) : null;

if ($rideId === false || $rideId === null || $rating === false || $rating === null) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Valid ride_id and rating (1-5) are required.']);
    exit;
}

if ($comments !== null && strlen($comments) > 1000) {
    http_response_code(422);
    echo json_encode(['success' => false, 'message' => 'Comments must be 1000 characters or fewer.']);
    exit;
}

try {
    $pdo = Database::getInstance()->getConnection();
    $pdo->beginTransaction();

    // Verify ride belongs to this user and is completed
    $rideStmt = $pdo->prepare(
        "SELECT id, driver_id FROM rides WHERE id = :rid AND user_id = :uid AND ride_status = 'completed' LIMIT 1"
    );
    $rideStmt->execute([':rid' => $rideId, ':uid' => $userId]);
    $ride = $rideStmt->fetch();

    if (!$ride) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Completed ride not found.']);
        exit;
    }

    // Prevent duplicate feedback submissions for the same ride
    $checkStmt = $pdo->prepare('SELECT id FROM user_feedback WHERE ride_id = :rid LIMIT 1');
    $checkStmt->execute([':rid' => $rideId]);
    
    if ($checkStmt->fetch()) {
        $pdo->rollBack();
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Feedback already submitted for this ride.']);
        exit;
    }

    $pdo->prepare(
        'INSERT INTO user_feedback (ride_id, user_id, driver_id, rating, comments) 
         VALUES (:rid, :uid, :did, :rate, :comm)'
    )->execute([
        ':rid'  => $rideId,
        ':uid'  => $userId,
        ':did'  => $ride['driver_id'],
        ':rate' => $rating,
        ':comm' => $comments
    ]);

    $pdo->commit();

    echo json_encode(['success' => true, 'message' => 'Feedback submitted successfully.']);
} catch (Throwable) {
    // Safely check and rollback if transaction was initiated to clear Intelephense warnings
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Feedback submission failed.']);
}