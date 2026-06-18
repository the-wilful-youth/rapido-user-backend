SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS rides;
DROP TABLE IF EXISTS drivers;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    mobile        VARCHAR(20)   UNIQUE NOT NULL,
    email         VARCHAR(255)  DEFAULT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE drivers (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    mobile         VARCHAR(20)  UNIQUE NOT NULL,
    vehicle_number VARCHAR(50)  NOT NULL,
    is_available   BOOLEAN      DEFAULT TRUE,
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rides (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT          NOT NULL,
    driver_id        INT          DEFAULT NULL,
    pickup_location  VARCHAR(255) NOT NULL,
    destination      VARCHAR(255) NOT NULL,
    distance_km      DECIMAL(5,2) NOT NULL,
    fare             DECIMAL(8,2) NOT NULL,
    -- Stored as bcrypt hash (60 chars), never plaintext
    otp              VARCHAR(60)  NOT NULL,
    ride_status      ENUM('waiting','accepted','driver_arrived','started','completed') DEFAULT 'waiting',
    payment_status   ENUM('pending','paid') DEFAULT 'pending',
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ride_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    CONSTRAINT fk_ride_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
    -- Indexes for the two most common query patterns
    INDEX idx_rides_user_id    (user_id),
    INDEX idx_rides_ride_status (ride_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payments (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    ride_id        INT          NOT NULL,
    user_id        INT          NOT NULL,
    amount         DECIMAL(8,2) NOT NULL,
    payment_method VARCHAR(50)  NOT NULL,
    paid_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_ride FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
