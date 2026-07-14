-- Budgets: monthly category spending targets
CREATE TABLE IF NOT EXISTS budgets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  month VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
  amount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_budget_category_month (category_id, month),
  INDEX idx_budget_month (month),
  CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Cached digests (optional persistence for weekly/monthly summaries)
CREATE TABLE IF NOT EXISTS financial_digests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period_type ENUM('weekly', 'monthly') NOT NULL,
  period_key VARCHAR(16) NOT NULL COMMENT 'e.g. 2026-W28 or 2026-07',
  content_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_digest_period (period_type, period_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
