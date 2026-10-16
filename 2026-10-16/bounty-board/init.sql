DROP DATABASE IF EXISTS testdb;
CREATE DATABASE testdb CHARACTER
SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE testdb;
CREATE TABLE Bounty (
   id INT AUTO_INCREMENT PRIMARY KEY,
   patron VARCHAR(255) NOT NULL,
   claiment VARCHAR(255),
   price DECIMAL(10, 2) NOT NULL,
   title VARCHAR(255) NOT NULL,
   description TEXT,
   startTime DATETIME NOT NULL,
   endTime DATETIME
);