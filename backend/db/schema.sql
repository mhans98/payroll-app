-- =====================================================
-- PAYROLL APP DATABASE SCHEMA (PostgreSQL)
-- CV. Kreasi Indah Jaya
-- =====================================================

-- -----------------------------------------------------
-- TABLE: employees
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    gaji_per_hari INTEGER DEFAULT 0,
    lembur_per_jam INTEGER DEFAULT 0,
    transport_per_hari INTEGER DEFAULT 0,
    makan_per_hari INTEGER DEFAULT 0,
     kerajinan_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- TABLE: payroll_weeks
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_weeks (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    week_label VARCHAR(100),
    is_finalized INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(week_start, week_end)
);

-- -----------------------------------------------------
-- TABLE: payroll_entries
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_entries (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    week_id INTEGER NOT NULL REFERENCES payroll_weeks(id),
    hari_hadir INTEGER DEFAULT 0,
    lembur_per_hari TEXT DEFAULT '[0,0,0,0,0,0,0]',
    kerajinan INTEGER DEFAULT 0,
    tambahan_lainnya TEXT DEFAULT '[]',
    potongan_pinjaman INTEGER DEFAULT 0,
    override_gaji_per_hari INTEGER,
    override_lembur_per_jam INTEGER,
    override_transport_per_hari INTEGER,
    override_makan_per_hari INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, week_id)
);

-- -----------------------------------------------------
-- TABLE: loans
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    loan_id VARCHAR(50) UNIQUE NOT NULL,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    principal INTEGER NOT NULL,
    remaining INTEGER NOT NULL,
    start_date DATE NOT NULL,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- TABLE: loan_payments
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_payments (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL REFERENCES loans(id),
    week_id INTEGER REFERENCES payroll_weeks(id),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- TABLE: audit_log
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values TEXT,
    new_values TEXT,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee ON payroll_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_week ON payroll_entries(week_id);
CREATE INDEX IF NOT EXISTS idx_loans_employee ON loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_active ON loans(is_active);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);
