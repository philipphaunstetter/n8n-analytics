-- Migration: Add cron_schedules column to workflows table
-- This migration adds support for storing cron schedule information from workflow nodes

-- Check if column exists and add it if it doesn't
-- SQLite doesn't have IF NOT EXISTS for ALTER TABLE, so this needs to be run carefully

ALTER TABLE workflows ADD COLUMN cron_schedules TEXT DEFAULT '[]';

-- Update all existing workflows to have an empty array
UPDATE workflows SET cron_schedules = '[]' WHERE cron_schedules IS NULL;
