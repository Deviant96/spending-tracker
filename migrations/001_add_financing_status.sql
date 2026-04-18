-- Migration: Add financing_status field to transactions
-- Date: 2025-12-17
-- Purpose: Support proper installment tracking and prevent double counting

-- Add financing_status column to transactions table
ALTER TABLE transactions 
ADD COLUMN financing_status ENUM('one_time', 'converted', 'subscription') 
DEFAULT 'one_time' 
AFTER subscription_interval;

-- Update existing installment transactions to 'converted' status
-- This identifies transactions that have been converted to installment plans
UPDATE transactions t
INNER JOIN installment_plans p ON t.id = p.transaction_id
SET t.financing_status = 'converted';

-- Update subscription transactions
UPDATE transactions
SET financing_status = 'subscription'
WHERE is_subscription = 1;

-- Add index for better query performance
CREATE INDEX idx_financing_status ON transactions(financing_status);

-- Ensure installment_plans table exists with correct structure
CREATE TABLE IF NOT EXISTS installment_plans (
  plan_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id CHAR(36) NOT NULL,
  principal INT NOT NULL,
  months INT NOT NULL,
  interest_total INT DEFAULT 0,
  fees_total INT DEFAULT 0,
  start_month VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
  status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ensure installment_schedule table exists with correct structure
CREATE TABLE IF NOT EXISTS installment_schedule (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NOT NULL,
  due_month VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
  amount_principal INT NOT NULL,
  amount_interest INT DEFAULT 0,
  amount_fee INT DEFAULT 0,
  status ENUM('pending', 'paid', 'overdue') DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES installment_plans(plan_id) ON DELETE CASCADE,
  INDEX idx_plan_id (plan_id),
  INDEX idx_due_month (due_month),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migration complete
-- Note: installment_total and installment_current columns are kept for backward compatibility
-- but should no longer be used in new code. They can be removed in a future migration after
-- confirming all legacy data has been migrated.
