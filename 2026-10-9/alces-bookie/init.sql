DROP DATABASE IF EXISTS bank;

CREATE DATABASE bank
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE bank;

-- Accounts
CREATE TABLE Accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    balance DECIMAL(20, 2) NOT NULL DEFAULT 0
);

-- Users
CREATE TABLE Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    winnings DECIMAL(20, 2) NOT NULL DEFAULT 0,
    losses DECIMAL(20, 2) NOT NULL DEFAULT 0,
    debt DECIMAL(20, 2) NOT NULL DEFAULT 0,
    account_id INT NOT NULL UNIQUE,

    CONSTRAINT fk_user_account
        FOREIGN KEY (account_id)
        REFERENCES Accounts(id)
        ON DELETE RESTRICT
);

-- Services
CREATE TABLE Services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    type ENUM("bank", "other") NOT NULL DEFAULT "other",
    account_id INT UNIQUE,

    CONSTRAINT fk_service_account
        FOREIGN KEY (account_id)
        REFERENCES Accounts(id)
        ON DELETE RESTRICT
);

-- Transaction history
CREATE TABLE Ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_account_id INT,
    receiver_account_id INT NOT NULL,
    service_id INT,
    amount DECIMAL(20, 2) NOT NULL,
    type ENUM("transfer", "win", "return", "loss", "hold") NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    CONSTRAINT chk_ledger_amount
        CHECK (amount > 0),

    CONSTRAINT fk_ledger_sender
        FOREIGN KEY (sender_account_id)
        REFERENCES Accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_ledger_receiver
        FOREIGN KEY (receiver_account_id)
        REFERENCES Accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_ledger_service
        FOREIGN KEY (service_id)
        REFERENCES Services(id)
        ON DELETE RESTRICT
);

-- Initial data
START TRANSACTION;

-- Create bank account
INSERT INTO Accounts (balance)
VALUES (10000.00);
SET @bank_account_id = LAST_INSERT_ID();

-- Create services
INSERT INTO Services (name, token, account_id, type)
VALUES
    ('Bank', '1', @bank_account_id, 'bank'),
    ('Transfer', '2', null, 'bank'),
    ('Loan', '3', null, 'bank');

COMMIT;