DROP DATABASE IF EXISTS bank;
CREATE DATABASE bank CHARACTER
SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bank;
CREATE TABLE Users(
   id INT AUTO_INCREMENT PRIMARY KEY,
   username VARCHAR(255) UNIQUE NOT NULL,
   password VARCHAR(255) NOT NULL,
   winnings DECIMAL(65, 2) NOT NULL DEFAULT 0,
   loses DECIMAL(65, 2) NOT NULL DEFAULT 0,
   balance DECIMAL(65, 2) NOT NULL DEFAULT 500,
   debt DECIMAL(65, 2) NOT NULL DEFAULT 0
);

CREATE TABLE Services(
   id INT AUTO_INCREMENT PRIMARY KEY,
   name VARCHAR(255) UNIQUE NOT NULL,
   token VARCHAR(255) UNIQUE NOT NULL,
   balance DECIMAL(65, 2) NOT NULL DEFAULT 4000
);

CREATE TABLE Ledger(
   id INT AUTO_INCREMENT PRIMARY KEY,
   username VARCHAR(255) NOT NULL,
   service INT NOT NULL,
   beforeBalance DECIMAL(65, 2) NOT NULL,
   afterBalance DECIMAL(65, 2) NOT NULL,
   timestamp DATETIME NOT NULL,
   CONSTRAINT fk_ledger_username_username FOREIGN KEY (username) REFERENCES Users(username),
   CONSTRAINT fk_ledger_service_id FOREIGN KEY (service) REFERENCES Services(id)
);

INSERT INTO Users (username, password, balance)
VALUES ('bank', 'password', 10000);

INSERT INTO Services (name, token)
VALUES ('Transfer', '1')