<?php
declare(strict_types=1);

/**
 * Ride model — all ride-related DB operations.
 * Uses PDO prepared statements exclusively.
 */
class Ride
{
    private PDO $db;

    private const VALID_STATUSES = ['waiting', 'accepted', 'driver_arrived', 'started', 'completed'];

    /** Max characters allowed for location strings */
    private const MAX_LOCATION_LEN = 255;

    /** Max rides returned per user in a single call */
    private const LIST_LIMIT = 100;

    /**
     * @param PDO $db  Active PDO connection
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Insert a new ride record.
     * OTP is stored as a bcrypt hash — never in plaintext.
     *
     * @param int    $userId
     * @param string $pickup       Max 255 chars
     * @param string $destination  Max 255 chars
     * @param float  $distanceKm
     * @param float  $fare
     * @param string $otp          Raw 4-digit OTP; stored hashed
     * @return int   New ride ID
     * @throws InvalidArgumentException
     */
    public function createRide(
        int $userId,
        string $pickup,
        string $destination,
        float $distanceKm,
        float $fare,
        string $otp
    ): int {
        if ($userId <= 0) {
            throw new InvalidArgumentException('Invalid user ID.');
        }
        if ($pickup === '' || strlen($pickup) > self::MAX_LOCATION_LEN) {
            throw new InvalidArgumentException('Invalid pickup location.');
        }
        if ($destination === '' || strlen($destination) > self::MAX_LOCATION_LEN) {
            throw new InvalidArgumentException('Invalid destination.');
        }
        if ($distanceKm <= 0 || $fare <= 0) {
            throw new InvalidArgumentException('Distance and fare must be positive.');
        }
        if ($otp === '') {
            throw new InvalidArgumentException('OTP is required.');
        }

        // Hash OTP at rest — raw value never written to DB
        $otpHash = password_hash($otp, PASSWORD_BCRYPT);

        $stmt = $this->db->prepare(
            'INSERT INTO rides (user_id, pickup_location, destination, distance_km, fare, otp)
             VALUES (:user_id, :pickup, :dest, :dist, :fare, :otp)'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':pickup'  => $pickup,
            ':dest'    => $destination,
            ':dist'    => $distanceKm,
            ':fare'    => $fare,
            ':otp'     => $otpHash,
        ]);

        return (int) $this->db->lastInsertId();
    }

    /**
     * Verify a raw OTP against the stored hash.
     *
     * @param int    $rideId
     * @param string $rawOtp
     * @return bool
     */
    public function verifyOtp(int $rideId, string $rawOtp): bool
    {
        $ride = $this->getRideById($rideId);
        if ($ride === null) {
            return false;
        }
        return password_verify($rawOtp, $ride['otp']);
    }

    /**
     * Fetch a single ride by its ID.
     *
     * @param int $rideId
     * @return array|null
     */
    public function getRideById(int $rideId): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM rides WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $rideId]);
        $row = $stmt->fetch();
        return $row !== false ? $row : null;
    }

    /**
     * Fetch rides for a user, newest first, capped at LIST_LIMIT.
     *
     * @param int $userId
     * @return array
     */
    public function getRidesByUser(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM rides WHERE user_id = :uid ORDER BY created_at DESC LIMIT ' . self::LIST_LIMIT
        );
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }

    /**
     * Update ride_status for a given ride.
     *
     * @param int    $rideId
     * @param string $status  Must be one of VALID_STATUSES
     * @return bool
     * @throws InvalidArgumentException
     */
    public function updateStatus(int $rideId, string $status): bool
    {
        if (!in_array($status, self::VALID_STATUSES, true)) {
            throw new InvalidArgumentException("Invalid status: {$status}");
        }

        $stmt = $this->db->prepare('UPDATE rides SET ride_status = :status WHERE id = :id');
        $stmt->execute([':status' => $status, ':id' => $rideId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Mark a ride's payment_status as 'paid'.
     *
     * @param int $rideId
     * @return bool
     */
    public function markPaid(int $rideId): bool
    {
        $stmt = $this->db->prepare("UPDATE rides SET payment_status = 'paid' WHERE id = :id");
        $stmt->execute([':id' => $rideId]);
        return $stmt->rowCount() > 0;
    }

    /**
     * Fetch ride joined with driver details.
     *
     * @param int $rideId
     * @return array|null
     */
    public function getRideWithDriver(int $rideId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT r.id, r.user_id, r.driver_id, r.pickup_location, r.destination,
                    r.distance_km, r.fare, r.ride_status, r.payment_status, r.created_at,
                    d.name AS driver_name, d.mobile AS driver_mobile, d.vehicle_number
             FROM rides r
             LEFT JOIN drivers d ON d.id = r.driver_id
             WHERE r.id = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $rideId]);
        $row = $stmt->fetch();
        return $row !== false ? $row : null;
    }
}
