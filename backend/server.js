// =====================================================
// PAYROLL APP - BACKEND SERVER (PostgreSQL Version)
// CV. Kreasi Indah Jaya
// =====================================================

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create the Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// =====================================================
// DATABASE SETUP
// =====================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
     try {
      await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS kerajinan_default INTEGER DEFAULT 0`);
    } catch (e) { /* column might already exist */ }
  } catch (error) {
    console.error('Database initialization error:', error.message);
    // Tables might already exist, continue anyway
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function roundUp1000(num) {
  return Math.ceil(num / 1000) * 1000;
}

function calculatePayroll(employee, entry) {
  const gajiPerHari = entry.override_gaji_per_hari || employee.gaji_per_hari || 0;
  const lemburPerJam = entry.override_lembur_per_jam || employee.lembur_per_jam || 0;
  const transportPerHari = entry.override_transport_per_hari || employee.transport_per_hari || 0;
  const makanPerHari = entry.override_makan_per_hari || employee.makan_per_hari || 0;

  const lemburArray = JSON.parse(entry.lembur_per_hari || '[0,0,0,0,0,0,0]');
  const totalLembur = lemburArray.reduce((a, b) => a + b, 0);

  const tambahan = JSON.parse(entry.tambahan_lainnya || '[]');
  const totalTambahan = tambahan.reduce((sum, t) => sum + roundUp1000(t.nominal || 0), 0);

  const gaji = roundUp1000(gajiPerHari * (entry.hari_hadir || 0));
  const lembur = roundUp1000(lemburPerJam * totalLembur);
  const transport = roundUp1000(transportPerHari * (entry.hari_hadir || 0));
  const makan = roundUp1000(makanPerHari * (entry.hari_hadir || 0));
  const kerajinan = roundUp1000(entry.kerajinan || 0);
  const potonganPinjaman = roundUp1000(entry.potongan_pinjaman || 0);

  const totalPendapatan = gaji + lembur + transport + makan + kerajinan + totalTambahan;
  const gajiBersih = totalPendapatan - potonganPinjaman;

  return {
    gaji, lembur, totalLembur, transport, makan, kerajinan,
    tambahan: totalTambahan, totalPendapatan, potonganPinjaman, gajiBersih,
    rates: { gajiPerHari, lemburPerJam, transportPerHari, makanPerHari }
  };
}

async function logAudit(tableName, recordId, action, oldValues, newValues) {
  try {
    await pool.query(`
      INSERT INTO audit_log (table_name, record_id, action, old_values, new_values)
      VALUES ($1, $2, $3, $4, $5)
    `, [tableName, recordId, action, 
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null]);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

// =====================================================
// API ROUTES - EMPLOYEES
// =====================================================

app.get('/api/employees', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM employees WHERE is_active = 1 ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/employees/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { employee_id, name, gaji_per_hari, lembur_per_jam, transport_per_hari, makan_per_hari } = req.body;
    
 const result = await pool.query(`
      INSERT INTO employees (employee_id, name, gaji_per_hari, lembur_per_jam, transport_per_hari, makan_per_hari, kerajinan_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [employee_id, name, gaji_per_hari || 0, lembur_per_jam || 0, transport_per_hari || 0, makan_per_hari || 0, req.body.kerajinan_default || 0]);
    
    await logAudit('employees', result.rows[0].id, 'INSERT', null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const oldResult = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const oldEmployee = oldResult.rows[0];

    const { employee_id, name, gaji_per_hari, lembur_per_jam, transport_per_hari, makan_per_hari, is_active } = req.body;
    
   const result = await pool.query(`
      UPDATE employees 
      SET employee_id = $1, name = $2, gaji_per_hari = $3, lembur_per_jam = $4, 
          transport_per_hari = $5, makan_per_hari = $6, kerajinan_default = $7, is_active = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
      employee_id || oldEmployee.employee_id,
      name || oldEmployee.name,
      gaji_per_hari ?? oldEmployee.gaji_per_hari,
      lembur_per_jam ?? oldEmployee.lembur_per_jam,
      transport_per_hari ?? oldEmployee.transport_per_hari,
      makan_per_hari ?? oldEmployee.makan_per_hari,
      req.body.kerajinan_default ?? oldEmployee.kerajinan_default ?? 0,
      is_active ?? oldEmployee.is_active,
      req.params.id
    ]);
    
    await logAudit('employees', req.params.id, 'UPDATE', oldEmployee, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const oldResult = await pool.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await pool.query('UPDATE employees SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    await logAudit('employees', req.params.id, 'DELETE', oldResult.rows[0], { ...oldResult.rows[0], is_active: 0 });
    
    res.json({ message: 'Employee deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// API ROUTES - PAYROLL WEEKS
// =====================================================

app.get('/api/weeks', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM payroll_weeks ORDER BY week_start DESC LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/weeks', async (req, res) => {
  try {
    const { week_start, week_end, week_label } = req.body;
    
    // Check if exists
    let result = await pool.query(
      'SELECT * FROM payroll_weeks WHERE week_start = $1 AND week_end = $2',
      [week_start, week_end]
    );
    
    if (result.rows.length === 0) {
      result = await pool.query(`
        INSERT INTO payroll_weeks (week_start, week_end, week_label)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [week_start, week_end, week_label]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// API ROUTES - PAYROLL ENTRIES
// =====================================================

app.get('/api/payroll/:weekId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pe.*,
        e.employee_id as emp_code,
        e.name,
        e.gaji_per_hari,
        e.lembur_per_jam,
        e.transport_per_hari,
        e.makan_per_hari
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      WHERE pe.week_id = $1 AND e.is_active = 1
      ORDER BY e.name
    `, [req.params.weekId]);

    const entriesWithCalc = result.rows.map(entry => {
      const calc = calculatePayroll(entry, entry);
      return { ...entry, calculated: calc };
    });

    res.json(entriesWithCalc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payroll', async (req, res) => {
  try {
    const { employee_id, week_id } = req.body;
    
    let result = await pool.query(
      'SELECT * FROM payroll_entries WHERE employee_id = $1 AND week_id = $2',
      [employee_id, week_id]
    );
    
    if (result.rows.length === 0) {
      result = await pool.query(`
        INSERT INTO payroll_entries (employee_id, week_id)
        VALUES ($1, $2)
        RETURNING *
      `, [employee_id, week_id]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/payroll/:id', async (req, res) => {
  try {
    const oldResult = await pool.query('SELECT * FROM payroll_entries WHERE id = $1', [req.params.id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payroll entry not found' });
    }
    const oldEntry = oldResult.rows[0];

    const { 
      hari_hadir, lembur_per_hari, kerajinan, tambahan_lainnya, potongan_pinjaman,
      override_gaji_per_hari, override_lembur_per_jam, override_transport_per_hari, override_makan_per_hari
    } = req.body;
    
    const result = await pool.query(`
      UPDATE payroll_entries 
      SET hari_hadir = $1, lembur_per_hari = $2, kerajinan = $3, tambahan_lainnya = $4,
          potongan_pinjaman = $5, override_gaji_per_hari = $6, override_lembur_per_jam = $7,
          override_transport_per_hari = $8, override_makan_per_hari = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      hari_hadir ?? oldEntry.hari_hadir,
      lembur_per_hari ? JSON.stringify(lembur_per_hari) : oldEntry.lembur_per_hari,
      kerajinan ?? oldEntry.kerajinan,
      tambahan_lainnya ? JSON.stringify(tambahan_lainnya) : oldEntry.tambahan_lainnya,
      potongan_pinjaman ?? oldEntry.potongan_pinjaman,
      override_gaji_per_hari || null,
      override_lembur_per_jam || null,
      override_transport_per_hari || null,
      override_makan_per_hari || null,
      req.params.id
    ]);
    
    await logAudit('payroll_entries', req.params.id, 'UPDATE', oldEntry, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payroll/initialize/:weekId', async (req, res) => {
  try {
    const employees = await pool.query('SELECT id FROM employees WHERE is_active = 1');
    const weekId = req.params.weekId;
    
        for (const emp of employees.rows) {
      const existing = await pool.query(
        'SELECT id FROM payroll_entries WHERE employee_id = $1 AND week_id = $2',
        [emp.id, weekId]
      );
      if (existing.rows.length === 0) {
        const empData = await pool.query('SELECT kerajinan_default FROM employees WHERE id = $1', [emp.id]);
        const kerajinanDefault = empData.rows[0]?.kerajinan_default || 0;
        
        await pool.query(
          'INSERT INTO payroll_entries (employee_id, week_id, kerajinan) VALUES ($1, $2, $3)',
          [emp.id, weekId, kerajinanDefault]
        );
      }
    }
    
    res.json({ message: `Initialized payroll for ${employees.rows.length} employees` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// API ROUTES - LOANS
// =====================================================

app.get('/api/loans', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, e.employee_id as emp_code, e.name
      FROM loans l
      JOIN employees e ON l.employee_id = e.id
      WHERE l.is_active = 1
      ORDER BY l.start_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/loans/employee/:employeeId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM loans WHERE employee_id = $1 AND is_active = 1 ORDER BY start_date ASC
    `, [req.params.employeeId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/loans', async (req, res) => {
  try {
    const { loan_id, employee_id, principal, start_date, notes } = req.body;
    
    const result = await pool.query(`
      INSERT INTO loans (loan_id, employee_id, principal, remaining, start_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [loan_id, employee_id, principal, principal, start_date, notes || null]);
    
    await logAudit('loans', result.rows[0].id, 'INSERT', null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/loans/payment', async (req, res) => {
  try {
    const { employee_id, week_id, amount } = req.body;
    
    if (amount <= 0) {
      return res.json({ message: 'No payment to process' });
    }
    
    const loansResult = await pool.query(`
      SELECT * FROM loans 
      WHERE employee_id = $1 AND is_active = 1 AND remaining > 0
      ORDER BY start_date ASC
    `, [employee_id]);
    
    let remainingPayment = amount;
    const payments = [];
    
    for (const loan of loansResult.rows) {
      if (remainingPayment <= 0) break;
      
      const paymentAmount = Math.min(remainingPayment, loan.remaining);
      const newRemaining = loan.remaining - paymentAmount;
      
      await pool.query(
        'UPDATE loans SET remaining = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [newRemaining, newRemaining > 0 ? 1 : 0, loan.id]
      );
      
      await pool.query(`
        INSERT INTO loan_payments (loan_id, week_id, amount, balance_after, payment_date)
        VALUES ($1, $2, $3, $4, CURRENT_DATE)
      `, [loan.id, week_id, paymentAmount, newRemaining]);
      
      payments.push({ loan_id: loan.id, amount: paymentAmount, remaining: newRemaining });
      remainingPayment -= paymentAmount;
    }
    
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/loans/:loanId/payments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lp.*, pw.week_label, pw.week_start, pw.week_end
      FROM loan_payments lp
      LEFT JOIN payroll_weeks pw ON lp.week_id = pw.id
      WHERE lp.loan_id = $1
      ORDER BY lp.payment_date DESC
    `, [req.params.loanId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// API ROUTES - REPORTS
// =====================================================

app.get('/api/reports/weekly/:weekId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pe.*, e.employee_id as emp_code, e.name,
        e.gaji_per_hari, e.lembur_per_jam, e.transport_per_hari, e.makan_per_hari
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      WHERE pe.week_id = $1 AND e.is_active = 1
    `, [req.params.weekId]);

    const totals = {
      gaji: 0, lembur: 0, transport: 0, makan: 0, kerajinan: 0,
      tambahan: 0, totalPendapatan: 0, potonganPinjaman: 0, gajiBersih: 0
    };

    result.rows.forEach(entry => {
      const calc = calculatePayroll(entry, entry);
      totals.gaji += calc.gaji;
      totals.lembur += calc.lembur;
      totals.transport += calc.transport;
      totals.makan += calc.makan;
      totals.kerajinan += calc.kerajinan;
      totals.tambahan += calc.tambahan;
      totals.totalPendapatan += calc.totalPendapatan;
      totals.potonganPinjaman += calc.potonganPinjaman;
      totals.gajiBersih += calc.gajiBersih;
    });

    res.json({ totals, employeeCount: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// API ROUTES - EXPORT
// =====================================================

app.get('/api/export/weekly/:weekId', async (req, res) => {
  try {
    const weekResult = await pool.query('SELECT * FROM payroll_weeks WHERE id = $1', [req.params.weekId]);
    const week = weekResult.rows[0];
    
    const result = await pool.query(`
      SELECT 
        e.employee_id as emp_code, e.name, pe.hari_hadir, pe.lembur_per_hari,
        pe.kerajinan, pe.potongan_pinjaman, e.gaji_per_hari, e.lembur_per_jam,
        e.transport_per_hari, e.makan_per_hari
      FROM payroll_entries pe
      JOIN employees e ON pe.employee_id = e.id
      WHERE pe.week_id = $1 AND e.is_active = 1
      ORDER BY e.name
    `, [req.params.weekId]);

    const headers = ['ID', 'Nama', 'Hari Hadir', 'Total Lembur', 'Gaji Pokok', 'Upah Lembur', 'Transport', 'Uang Makan', 'Kerajinan', 'Tambahan', 'Total Pendapatan', 'Pot. Pinjaman', 'Gaji Bersih'];
    
    const rows = result.rows.map(entry => {
      const calc = calculatePayroll(entry, entry);
      return [
        entry.emp_code, entry.name, entry.hari_hadir, calc.totalLembur,
        calc.gaji, calc.lembur, calc.transport, calc.makan, calc.kerajinan,
        calc.tambahan, calc.totalPendapatan, calc.potonganPinjaman, calc.gajiBersih
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payroll-${week?.week_start || 'export'}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// HEALTH CHECK (for Render)
// =====================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Edit loan
app.put('/api/loans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { principal, remaining, notes } = req.body;
    await pool.query(
      'UPDATE loans SET principal = $1, remaining = $2, notes = $3 WHERE id = $4',
      [principal, remaining, notes, id]
    );
    res.json({ message: 'Loan updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete loan
app.delete('/api/loans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Delete related payments first
    await pool.query('DELETE FROM loan_payments WHERE loan_id = $1', [id]);
    await pool.query('DELETE FROM loans WHERE id = $1', [id]);
    res.json({ message: 'Loan deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Get employee payment history (all loans)
app.get('/api/employees/:id/loan-history', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT lp.*, l.loan_id, l.principal, pw.week_label, pw.week_start, pw.week_end 
      FROM loan_payments lp
      LEFT JOIN loans l ON lp.loan_id = l.id
      LEFT JOIN payroll_weeks pw ON lp.week_id = pw.id
      WHERE l.employee_id = $1
      ORDER BY lp.created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Get loan payment history
app.get('/api/loans/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT lp.*, pw.week_label, pw.week_start, pw.week_end 
      FROM loan_payments lp
      LEFT JOIN payroll_weeks pw ON lp.week_id = pw.id
      WHERE lp.loan_id = $1
      ORDER BY lp.created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark loan as paid
app.put('/api/loans/:id/paid', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE loans SET remaining = 0 WHERE id = $1', [id]);
    res.json({ message: 'Loan marked as paid' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset all data (use carefully!)
app.delete('/api/reset-all-data', async (req, res) => {
  try {
    await pool.query('DELETE FROM loan_payments');
    await pool.query('DELETE FROM loans');
    await pool.query('DELETE FROM payroll_entries');
    await pool.query('DELETE FROM payroll_weeks');
    await pool.query('DELETE FROM employees');
    await pool.query('DELETE FROM audit_log');
    res.json({ message: 'All data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// =====================================================
// SERVE FRONTEND (Production)
// =====================================================
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendPath));
  
  // Handle React routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// =====================================================
// START SERVER
// =====================================================
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Payroll server running on port ${PORT}`);
    console.log(`📊 Company: CV. Kreasi Indah Jaya`);
  });
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
