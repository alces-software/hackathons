-- =========================
-- USERS
-- =========================
CREATE TABLE users (
   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
   username VARCHAR(64) NOT NULL,
   xp INT UNSIGNED NOT NULL DEFAULT 0,
   last_logged_in DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
   login_streak SMALLINT UNSIGNED NOT NULL DEFAULT 0,
   longest_streak SMALLINT UNSIGNED NOT NULL DEFAULT 0,
   UNIQUE KEY uk_username (username),
   INDEX idx_last_logged_in (last_logged_in)
) ENGINE = InnoDB;
-- =========================
-- ACHIEVEMENTS (static data)
-- =========================
CREATE TABLE achievements (
   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
   title VARCHAR(128) NOT NULL,
   description TEXT
) ENGINE = InnoDB;
-- =========================
-- USER ACHIEVEMENTS (hot table)
-- =========================
CREATE TABLE user_achievements (
   user_id BIGINT UNSIGNED NOT NULL,
   achievement_id BIGINT UNSIGNED NOT NULL,
   unlocked_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
   PRIMARY KEY (user_id, achievement_id),
   INDEX idx_achievement_user (achievement_id, user_id),
   CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
   CONSTRAINT fk_achievement FOREIGN KEY (achievement_id) REFERENCES achievements (id) ON DELETE CASCADE
) ENGINE = InnoDB;