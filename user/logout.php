<?php
declare(strict_types=1);

/**
 * user/logout.php
 * POST — destroy the server-side session and clear the session cookie.
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

validate_csrf();

$_SESSION = [];

// Expire the session cookie in the browser
$params = session_get_cookie_params();
setcookie(session_name(), '', time() - 3600, $params['path'], $params['domain'], $params['secure'], $params['httponly']);

session_destroy();

echo json_encode(['success' => true]);
