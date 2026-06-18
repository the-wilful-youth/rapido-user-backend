-- tests/test_schema.sql
-- Run this script to verify your database schema.

SHOW TABLES;

DESCRIBE users;
DESCRIBE drivers;
DESCRIBE rides;
DESCRIBE payments;

-- Insert basic dummy data to verify structure
INSERT INTO users (name, mobile, password_hash) VALUES ('John Doe', '9876543210', 'hashedpassword123');
INSERT INTO drivers (name, mobile, vehicle_number) VALUES ('Mike Smith', '1234567890', 'KA-01-AB-1234');

-- Test ride creation
INSERT INTO rides (user_id, driver_id, pickup_location, destination, distance_km, fare, otp) 
VALUES (1, 1, 'Koramangala', 'Indiranagar', 5.5, 85.00, '4832');

-- Test payment creation
INSERT INTO payments (ride_id, user_id, amount, payment_method) 
VALUES (1, 1, 85.00, 'CASH');

-- Verify insertion
SELECT * FROM rides;
SELECT * FROM payments;