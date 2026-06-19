<?php
declare(strict_types=1);

/**
 * config/bootstrap.php
 * Call this instead of session_start() in every endpoint.
 * Sets secure cookie flags and initialises the CSRF token.
 */

// Secure session cookie flags
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '',
    'secure'   => isset($_SERVER['HTTPS']),   // Secure only over HTTPS
    'httponly' => true,                        // Not accessible via JS
    'samesite' => 'Strict',                    // CSRF mitigation
]);

session_start();

// Generate CSRF token once per session
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

/**
 * Validate the CSRF token on state-mutating requests.
 * Call at the top of every POST endpoint after bootstrap.
 */
function validate_csrf(): void
{
    $token = $_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!hash_equals((string)($_SESSION['csrf_token'] ?? ''), (string)$token)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token.']);
        exit;
    }
}
