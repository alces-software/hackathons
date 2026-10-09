DROP DATABASE IF EXISTS bank;
CREATE DATABASE bank CHARACTER
SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bank;
CREATE TABLE Accounts(
   username VARCHAR(255) PRIMARY KEY,
   password VARCHAR(255) NOT NULL,
   balance INT NOT NULL DEFAULT 500
);
CREATE TABLE Services(
   id INT AUTO_INCREMENT PRIMARY KEY,
   name VARCHAR(255) UNIQUE,
   token VARCHAR(255) NOT NULL
);
CREATE TABLE Ledger(
   id INT AUTO_INCREMENT PRIMARY KEY,
   username VARCHAR(255) NOT NULL,
   service INT NOT NULL,
   beforeBalance INT NOT NULL,
   afterBalance INT NOT NULL,
   timestamp DATE NOT NULL,
   CONSTRAINT fk_ledger_username_username FOREIGN KEY (username) REFERENCES Accounts(username),
   CONSTRAINT fk_ledger_service_id FOREIGN KEY (service) REFERENCES Services(id)
);