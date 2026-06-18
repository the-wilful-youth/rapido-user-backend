<?php
// tests/test_connection.php
require_once __DIR__ . '/../config/db.php';

header('Content-Type: application/json');

$db = Database::getInstance();
$conn = $db->getConnection();

if ($conn) {
    echo json_encode(["success" => true, "message" => "Connected successfully to the database."]);
} else {
    echo json_encode(["success" => false, "message" => "Failed to connect."]);
}
