<?php
declare(strict_types=1);

/**
 * user/csrf.php
 * GET — returns the current session CSRF token.
 * Frontend fetches this once on load and attaches it to all POST requests.
 */

require_once __DIR__ . '/../config/bootstrap.php';
require_once __DIR__ . '/../config/db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$user = null;
$activeRide = null;
if (!empty($_SESSION['user_id'])) {
    try {
        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->prepare('SELECT id, name, mobile, email FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $_SESSION['user_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $user = [
                'user_id' => (int)$row['id'],
                'name'    => $row['name'],
                'mobile'  => $row['mobile'],
                'email'   => $row['email'] ?? ''
            ];
            
            // Check active ride for passenger
            $stmtRide = $pdo->prepare("
                SELECT r.id, r.pickup_location, r.pickup_lat, r.pickup_lng, r.destination, r.dropoff_lat, r.dropoff_lng, r.distance_km, r.fare, r.otp, r.ride_status,
                       d.name AS driver_name, d.mobile AS driver_mobile, d.vehicle_number
                FROM rides r
                LEFT JOIN drivers d ON r.driver_id = d.id
                WHERE r.user_id = :user_id AND r.ride_status NOT IN ('completed', 'cancelled')
                ORDER BY r.id DESC LIMIT 1
            ");
            $stmtRide->execute([':user_id' => $user['user_id']]);
            $rideRow = $stmtRide->fetch();
            if ($rideRow) {
                $activeRide = [
                    'id'              => (int)$rideRow['id'],
                    'pickup_location' => $rideRow['pickup_location'],
                    'pickup_lat'      => $rideRow['pickup_lat'] !== null ? (float)$rideRow['pickup_lat'] : null,
                    'pickup_lng'      => $rideRow['pickup_lng'] !== null ? (float)$rideRow['pickup_lng'] : null,
                    'destination'     => $rideRow['destination'],
                    'dropoff_lat'     => $rideRow['dropoff_lat'] !== null ? (float)$rideRow['dropoff_lat'] : null,
                    'dropoff_lng'     => $rideRow['dropoff_lng'] !== null ? (float)$rideRow['dropoff_lng'] : null,
                    'distance_km'     => (float)$rideRow['distance_km'],
                    'fare'            => (float)$rideRow['fare'],
                    'otp'             => $_SESSION['active_ride_otp'] ?? '',
                    'ride_status'     => $rideRow['ride_status'],
                    'driver_name'     => $rideRow['driver_name'],
                    'vehicle_number'  => $rideRow['vehicle_number']
                ];
            }
        }
    } catch (Throwable) {
        // Ignore DB error during session checks; just default user to null
    }
}

$driver = null;
if (!empty($_SESSION['driver_id'])) {
    try {
        $pdo = Database::getInstance()->getConnection();
        $stmt = $pdo->prepare('SELECT id, name, mobile, vehicle_number, vehicle_type, is_available FROM drivers WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $_SESSION['driver_id']]);
        $row = $stmt->fetch();
        if ($row) {
            $driver = [
                'driver_id'      => (int)$row['id'],
                'name'           => $row['name'],
                'mobile'         => $row['mobile'],
                'vehicle_number' => $row['vehicle_number'],
                'vehicle_type'   => $row['vehicle_type'],
                'is_available'   => (bool)$row['is_available']
            ];
            
            // Check active ride for driver
            $stmtRide = $pdo->prepare("
                SELECT r.id, r.pickup_location, r.pickup_lat, r.pickup_lng, r.destination, r.dropoff_lat, r.dropoff_lng, r.distance_km, r.fare, r.otp, r.ride_status,
                       u.name AS user_name, u.mobile AS user_mobile
                FROM rides r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE r.driver_id = :driver_id AND r.ride_status NOT IN ('completed', 'cancelled')
                ORDER BY r.id DESC LIMIT 1
            ");
            $stmtRide->execute([':driver_id' => $driver['driver_id']]);
            $rideRow = $stmtRide->fetch();
            if ($rideRow) {
                $activeRide = [
                    'id'              => (int)$rideRow['id'],
                    'pickup_location' => $rideRow['pickup_location'],
                    'pickup_lat'      => $rideRow['pickup_lat'] !== null ? (float)$rideRow['pickup_lat'] : null,
                    'pickup_lng'      => $rideRow['pickup_lng'] !== null ? (float)$rideRow['pickup_lng'] : null,
                    'destination'     => $rideRow['destination'],
                    'dropoff_lat'     => $rideRow['dropoff_lat'] !== null ? (float)$rideRow['dropoff_lat'] : null,
                    'dropoff_lng'     => $rideRow['dropoff_lng'] !== null ? (float)$rideRow['dropoff_lng'] : null,
                    'distance_km'     => (float)$rideRow['distance_km'],
                    'fare'            => (float)$rideRow['fare'],
                    'otp'             => $rideRow['otp'],
                    'ride_status'     => $rideRow['ride_status'],
                    'user_name'       => $rideRow['user_name'],
                    'user_mobile'     => $rideRow['user_mobile']
                ];
            }
        }
    } catch (Throwable) {
        // Ignore
    }
}

echo json_encode([
    'success'     => true,
    'csrf_token'  => $_SESSION['csrf_token'],
    'user'        => $user,
    'driver'      => $driver,
    'active_ride' => $activeRide
]);
