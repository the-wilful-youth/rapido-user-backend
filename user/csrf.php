<?php
declare(strict_types=1);

/**
 * user/csrf.php
 * GET — returns the current session CSRF token.
 * Frontend fetches this once on load and attaches it to all POST requests.
 */

require_once __DIR__ . '/../config/bootstrap.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

echo json_encode(['success' => true, 'csrf_token' => $_SESSION['csrf_token']]);
