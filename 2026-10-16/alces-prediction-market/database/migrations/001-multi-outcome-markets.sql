USE alces;

ALTER TABLE markets ADD COLUMN outcomes JSON NULL AFTER title;
UPDATE markets SET outcomes = JSON_ARRAY('Yes', 'No') WHERE outcomes IS NULL;
ALTER TABLE markets MODIFY outcomes JSON NOT NULL;
ALTER TABLE positions MODIFY outcome VARCHAR(255) NOT NULL;
