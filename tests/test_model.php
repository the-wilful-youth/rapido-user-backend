<?php
declare(strict_types=1);

/**
 * tests/test_model.php
 * Phase 3 — Ride model test suite.
 *
 * Run: php tests/test_model.php
 * Cleans up all inserted test data after each run.
 */

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../models/Ride.php';

header('Content-Type: application/json');

$results = [];
$pdo     = Database::getInstance()->getConnection();
$ride    = new Ride($pdo);

// ── Helpers ──────────────────────────────────────────────────────────────────

function pass(string $label): array { return ['test' => $label, 'result' => 'PASS']; }
function fail(string $label, string $reason): array { return ['test' => $label, 'result' => 'FAIL', 'reason' => $reason]; }

/** Create an isolated test user; returns its ID. */
function createTestUser(PDO $pdo): int
{
    $pdo->prepare(
        'INSERT INTO users (name, mobile, password_hash) VALUES (:n, :m, :p)'
    )->execute([':n' => '__test_user__', ':m' => '00TEST' . time(), ':p' => password_hash('x', PASSWORD_BCRYPT)]);
    return (int) $pdo->lastInsertId();
}

/** Delete all test data created during this run. */
function cleanup(PDO $pdo, int $userId): void
{
    // Rides deleted via CASCADE when user is deleted
    $pdo->prepare('DELETE FROM users WHERE id = :id')->execute([':id' => $userId]);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

$userId = createTestUser($pdo);
$rideId = 0;
$rawOtp = '4832';

// ── Tests ─────────────────────────────────────────────────────────────────────

// TEST 1 — createRide()
try {
    $rideId = $ride->createRide($userId, 'Koramangala', 'Indiranagar', 5.5, 85.00, $rawOtp);
    $results[] = $rideId > 0
        ? pass('1. createRide — inserts ride')
        : fail('1. createRide — inserts ride', 'Returned ID <= 0');
} catch (Throwable $e) {
    $results[] = fail('1. createRide — inserts ride', $e->getMessage());
}

// TEST 2 — getRideById()
try {
    $row = $ride->getRideById($rideId);
    $results[] = ($row && (int) $row['id'] === $rideId)
        ? pass('2. getRideById — fetches correct row')
        : fail('2. getRideById — fetches correct row', 'Row not found or wrong ID');
} catch (Throwable $e) {
    $results[] = fail('2. getRideById — fetches correct row', $e->getMessage());
}

// TEST 3 — OTP stored as hash, not plaintext
try {
    $row = $ride->getRideById($rideId);
    $results[] = ($row && $row['otp'] !== $rawOtp && str_starts_with($row['otp'], '$2y$'))
        ? pass('3. OTP stored as bcrypt hash, not plaintext')
        : fail('3. OTP stored as bcrypt hash, not plaintext', 'OTP appears to be plaintext');
} catch (Throwable $e) {
    $results[] = fail('3. OTP stored as bcrypt hash, not plaintext', $e->getMessage());
}

// TEST 4 — verifyOtp() correct
try {
    $ok = $ride->verifyOtp($rideId, $rawOtp);
    $results[] = $ok
        ? pass('4. verifyOtp — correct OTP accepted')
        : fail('4. verifyOtp — correct OTP accepted', 'Correct OTP rejected');
} catch (Throwable $e) {
    $results[] = fail('4. verifyOtp — correct OTP accepted', $e->getMessage());
}

// TEST 5 — verifyOtp() wrong
try {
    $ok = $ride->verifyOtp($rideId, '0000');
    $results[] = !$ok
        ? pass('5. verifyOtp — wrong OTP rejected')
        : fail('5. verifyOtp — wrong OTP rejected', 'Wrong OTP was accepted');
} catch (Throwable $e) {
    $results[] = fail('5. verifyOtp — wrong OTP rejected', $e->getMessage());
}

// TEST 6 — getRidesByUser()
try {
    $rows = $ride->getRidesByUser($userId);
    $results[] = count($rows) > 0
        ? pass('6. getRidesByUser — returns rides')
        : fail('6. getRidesByUser — returns rides', 'No rides returned');
} catch (Throwable $e) {
    $results[] = fail('6. getRidesByUser — returns rides', $e->getMessage());
}

// TEST 7 — updateStatus() valid
try {
    $ok  = $ride->updateStatus($rideId, 'accepted');
    $row = $ride->getRideById($rideId);
    $results[] = ($ok && $row['ride_status'] === 'accepted')
        ? pass('7. updateStatus — sets accepted')
        : fail('7. updateStatus — sets accepted', 'Status not updated');
} catch (Throwable $e) {
    $results[] = fail('7. updateStatus — sets accepted', $e->getMessage());
}

// TEST 8 — updateStatus() invalid
try {
    $ride->updateStatus($rideId, 'flying');
    $results[] = fail('8. updateStatus — rejects invalid status', 'No exception thrown');
} catch (InvalidArgumentException) {
    $results[] = pass('8. updateStatus — rejects invalid status');
} catch (Throwable $e) {
    $results[] = fail('8. updateStatus — rejects invalid status', $e->getMessage());
}

// TEST 9 — markPaid()
try {
    $ok  = $ride->markPaid($rideId);
    $row = $ride->getRideById($rideId);
    $results[] = ($ok && $row['payment_status'] === 'paid')
        ? pass('9. markPaid — sets payment_status to paid')
        : fail('9. markPaid — sets payment_status to paid', 'payment_status not updated');
} catch (Throwable $e) {
    $results[] = fail('9. markPaid — sets payment_status to paid', $e->getMessage());
}

// TEST 10 — getRideWithDriver() (no driver assigned)
try {
    $row = $ride->getRideWithDriver($rideId);
    $results[] = ($row && (int) $row['id'] === $rideId)
        ? pass('10. getRideWithDriver — returns ride with LEFT JOIN')
        : fail('10. getRideWithDriver — returns ride with LEFT JOIN', 'Row not returned');
} catch (Throwable $e) {
    $results[] = fail('10. getRideWithDriver — returns ride with LEFT JOIN', $e->getMessage());
}

// TEST 11 — createRide() rejects empty pickup
try {
    $ride->createRide($userId, '', 'Destination', 3.0, 60.00, '1234');
    $results[] = fail('11. createRide — rejects empty pickup', 'No exception thrown');
} catch (InvalidArgumentException) {
    $results[] = pass('11. createRide — rejects empty pickup');
} catch (Throwable $e) {
    $results[] = fail('11. createRide — rejects empty pickup', $e->getMessage());
}

// TEST 12 — createRide() rejects oversized location string
try {
    $ride->createRide($userId, str_repeat('A', 256), 'Dest', 3.0, 60.00, '1234');
    $results[] = fail('12. createRide — rejects oversized location', 'No exception thrown');
} catch (InvalidArgumentException) {
    $results[] = pass('12. createRide — rejects oversized location');
} catch (Throwable $e) {
    $results[] = fail('12. createRide — rejects oversized location', $e->getMessage());
}

// ── Teardown ──────────────────────────────────────────────────────────────────

cleanup($pdo, $userId);

// ── Summary ───────────────────────────────────────────────────────────────────

$passed = count(array_filter($results, fn($r) => $r['result'] === 'PASS'));
$total  = count($results);

echo json_encode([
    'summary' => "{$passed}/{$total} tests passed",
    'tests'   => $results,
], JSON_PRETTY_PRINT);
