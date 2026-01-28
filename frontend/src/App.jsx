import React, { useState, useEffect, useMemo } from 'react';

// =====================================================
// API HELPER FUNCTIONS
// =====================================================
const API_BASE = '/api';

async function api(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API Error');
  }
  return response.json();
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
const formatRp = (num) => `Rp ${(num || 0).toLocaleString('id-ID')}`;
const roundUp1000 = (num) => Math.ceil(num / 1000) * 1000;

// Get week dates (Sunday to Saturday)
function getWeekDates(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return { sunday, saturday };
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateISO(date) {
  return new Date(date).toISOString().split('T')[0];
}

// Generate last N weeks
function generateWeekOptions(n = 5) {
  const weeks = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (i * 7));
    const { sunday, saturday } = getWeekDates(d);
    const weekNum = Math.ceil(sunday.getDate() / 7);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    weeks.push({
      id: formatDateISO(sunday),
      label: `Minggu ke-${weekNum} ${monthNames[sunday.getMonth()]}`,
      range: `${formatDate(sunday)} – ${formatDate(saturday)}`,
      start: formatDateISO(sunday),
      end: formatDateISO(saturday)
    });
  }
  return weeks;
}

// =====================================================
// STYLES
// =====================================================
const styles = {
  container: { minHeight: '100vh', background: '#f1f5f9' },
  sidebar: {
    position: 'fixed', left: 0, top: 0, bottom: 0, width: '240px',
    background: 'linear-gradient(180deg, #1e3a8a 0%, #1e40af 100%)',
    padding: '24px 16px', display: 'flex', flexDirection: 'column'
  },
  main: { marginLeft: '240px', padding: '32px' },
  card: { background: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '16px' },
  button: { padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500' },
  buttonPrimary: { background: '#2563eb', color: 'white' },
  buttonSuccess: { background: '#059669', color: 'white' },
  buttonOutline: { background: 'white', border: '1px solid #d1d5db', color: '#374151' },
  input: { width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' },
  label: { display: 'block', color: '#374151', fontWeight: '500', marginBottom: '6px', fontSize: '0.875rem' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: '0.875rem', fontWeight: '600', borderBottom: '2px solid #e5e7eb' },
  td: { padding: '12px 8px', borderBottom: '1px solid #f1f5f9' },
  badge: { padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '500' },
  modal: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
  }
};

// =====================================================
// MAIN APP COMPONENT
// =====================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [employees, setEmployees] = useState([]);
  const [loans, setLoans] = useState([]);
  const [weeks, setWeeks] = useState(generateWeekOptions(5));
  const [selectedWeek, setSelectedWeek] = useState(weeks[0]);
  const [currentWeekId, setCurrentWeekId] = useState(null);
  const [payrollEntries, setPayrollEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState('batch'); // 'batch' | 'daftarbayar'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // =====================================================
  // DATA LOADING
  // =====================================================
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedWeek) {
      loadWeekData();
    }
  }, [selectedWeek]);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [emps, lns] = await Promise.all([
        api('/employees'),
        api('/loans')
      ]);
      setEmployees(emps);
      setLoans(lns);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function loadWeekData() {
    try {
      // Get or create week
      const week = await api('/weeks', {
        method: 'POST',
        body: {
          week_start: selectedWeek.start,
          week_end: selectedWeek.end,
          week_label: selectedWeek.label
        }
      });
      setCurrentWeekId(week.id);

      // Initialize payroll entries for all employees
      await api(`/payroll/initialize/${week.id}`, { method: 'POST' });

      // Load payroll entries
      const entries = await api(`/payroll/${week.id}`);
      setPayrollEntries(entries);
    } catch (err) {
      console.error('Error loading week data:', err);
    }
  }

  // =====================================================
  // EMPLOYEE FUNCTIONS
  // =====================================================
  async function saveEmployee(employeeData) {
    try {
      if (editingEmployee) {
        await api(`/employees/${editingEmployee.id}`, { method: 'PUT', body: employeeData });
      } else {
        await api('/employees', { method: 'POST', body: employeeData });
      }
      await loadInitialData();
      await loadWeekData();
      setShowEmployeeModal(false);
      setEditingEmployee(null);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function deleteEmployee(id) {
    if (!confirm('Yakin ingin menonaktifkan karyawan ini?')) return;
    try {
      await api(`/employees/${id}`, { method: 'DELETE' });
      await loadInitialData();
      await loadWeekData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // =====================================================
  // PAYROLL FUNCTIONS
  // =====================================================
  async function updatePayrollEntry(entryId, updates) {
    try {
      await api(`/payroll/${entryId}`, { method: 'PUT', body: updates });
      
      // If there's a loan deduction, record the payment
      if (updates.potongan_pinjaman && updates.potongan_pinjaman > 0) {
        const entry = payrollEntries.find(e => e.id === entryId);
        if (entry) {
          await api('/loans/payment', {
            method: 'POST',
            body: {
              employee_id: entry.employee_id,
              week_id: currentWeekId,
              amount: updates.potongan_pinjaman
            }
          });
          // Reload loans to update remaining balance
          const lns = await api('/loans');
          setLoans(lns);
        }
      }
      
      await loadWeekData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // =====================================================
  // LOAN FUNCTIONS
  // =====================================================
  async function saveLoan(loanData) {
    try {
      await api('/loans', { method: 'POST', body: loanData });
      const lns = await api('/loans');
      setLoans(lns);
      setShowLoanModal(false);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // =====================================================
  // HELPER: Get loan for employee
  // =====================================================
  function getLoanForEmployee(employeeId) {
    return loans.find(l => l.employee_id === employeeId && l.remaining > 0);
  }

  function getTotalLoanForEmployee(employeeId) {
    return loans
      .filter(l => l.employee_id === employeeId && l.remaining > 0)
      .reduce((sum, l) => sum + l.remaining, 0);
  }

  // =====================================================
  // CALCULATE PAYROLL
  // =====================================================
  function calculatePayroll(entry) {
    if (!entry) return null;
    
    const gajiPerHari = entry.override_gaji_per_hari || entry.gaji_per_hari || 0;
    const lemburPerJam = entry.override_lembur_per_jam || entry.lembur_per_jam || 0;
    const transportPerHari = entry.override_transport_per_hari || entry.transport_per_hari || 0;
    const makanPerHari = entry.override_makan_per_hari || entry.makan_per_hari || 0;

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
      lemburArray, tambahanList: tambahan,
      rates: { gajiPerHari, lemburPerJam, transportPerHari, makanPerHari }
    };
  }

  // =====================================================
  // FILTERED DATA
  // =====================================================
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const term = searchTerm.toLowerCase();
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(term) ||
      emp.employee_id.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const filteredPayrollEntries = useMemo(() => {
    if (!searchTerm) return payrollEntries;
    const term = searchTerm.toLowerCase();
    return payrollEntries.filter(entry =>
      entry.name.toLowerCase().includes(term) ||
      entry.emp_code.toLowerCase().includes(term)
    );
  }, [payrollEntries, searchTerm]);

  // =====================================================
  // NAVIGATION TABS
  // =====================================================
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'employees', label: 'Karyawan', icon: '👥' },
    { id: 'payroll', label: 'Gaji Mingguan', icon: '💰' },
    { id: 'loans', label: 'Pinjaman', icon: '📋' },
    { id: 'reports', label: 'Laporan', icon: '📈' },
  ];

  // =====================================================
  // EXPORT CSV
  // =====================================================
  function exportCSV() {
    if (!currentWeekId) return;
    window.open(`${API_BASE}/export/weekly/${currentWeekId}`, '_blank');
  }

  // =====================================================
  // RENDER: DASHBOARD
  // =====================================================
  const Dashboard = () => {
    const totalPayout = payrollEntries.reduce((sum, entry) => {
      const calc = calculatePayroll(entry);
      return sum + (calc?.gajiBersih || 0);
    }, 0);

    const totalLoans = loans.reduce((sum, l) => sum + l.remaining, 0);

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '600', color: '#1a1a2e' }}>Selamat Datang</h2>
            <p style={{ color: '#6b7280', marginTop: '4px' }}>Periode: {selectedWeek.range}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={exportCSV} style={{ ...styles.button, ...styles.buttonOutline }}>📥 Export CSV</button>
            <button onClick={() => setActiveTab('payroll')} style={{ ...styles.button, ...styles.buttonPrimary }}>Buat Slip Gaji →</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', padding: '24px', borderRadius: '16px' }}>
            <p style={{ color: '#1e40af', fontSize: '0.875rem', fontWeight: '500' }}>Total Karyawan Aktif</p>
            <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1e3a8a', marginTop: '8px' }}>{employees.length}</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', padding: '24px', borderRadius: '16px' }}>
            <p style={{ color: '#166534', fontSize: '0.875rem', fontWeight: '500' }}>Total Gaji Minggu Ini</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#14532d', marginTop: '8px' }}>{formatRp(totalPayout)}</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', padding: '24px', borderRadius: '16px' }}>
            <p style={{ color: '#92400e', fontSize: '0.875rem', fontWeight: '500' }}>Total Sisa Pinjaman</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#78350f', marginTop: '8px' }}>{formatRp(totalLoans)}</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', padding: '24px', borderRadius: '16px' }}>
            <p style={{ color: '#9d174d', fontSize: '0.875rem', fontWeight: '500' }}>Karyawan Punya Pinjaman</p>
            <p style={{ fontSize: '2.5rem', fontWeight: '700', color: '#831843', marginTop: '8px' }}>{loans.filter(l => l.remaining > 0).length}</p>
          </div>
        </div>

        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontWeight: '600' }}>Ringkasan Cepat - {selectedWeek.label}</h3>
            <select
              value={selectedWeek.id}
              onChange={(e) => setSelectedWeek(weeks.find(w => w.id === e.target.value))}
              style={{ ...styles.input, width: 'auto' }}
            >
              {weeks.map(w => <option key={w.id} value={w.id}>{w.label} ({w.range})</option>)}
            </select>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Karyawan</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Hari</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Lembur</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Gaji Bersih</th>
              </tr>
            </thead>
            <tbody>
              {payrollEntries.map(entry => {
                const calc = calculatePayroll(entry);
                const hasLoan = getTotalLoanForEmployee(entry.employee_id) > 0;
                return (
                  <tr key={entry.id}>
                    <td style={styles.td}>
                      <span style={{ fontWeight: '500' }}>{entry.name}</span>
                      <span style={{ color: '#9ca3af', marginLeft: '8px', fontSize: '0.875rem' }}>{entry.emp_code}</span>
                      {hasLoan && (
                        <span style={{ ...styles.badge, background: '#fef3c7', color: '#92400e', marginLeft: '8px' }}>💳 Pinjaman</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{entry.hari_hadir || 0}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{calc?.totalLembur || 0} jam</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600', color: '#059669' }}>{formatRp(calc?.gajiBersih)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // =====================================================
  // RENDER: EMPLOYEES
  // =====================================================
  const Employees = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '600', color: '#1a1a2e' }}>Daftar Karyawan</h2>
        <button
          onClick={() => { setEditingEmployee(null); setShowEmployeeModal(true); }}
          style={{ ...styles.button, ...styles.buttonPrimary }}
        >
          + Tambah Karyawan
        </button>
      </div>

      <div style={{ marginBottom: '16px', maxWidth: '320px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Cari nama atau ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...styles.input, paddingLeft: '40px' }}
        />
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>Nama</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Gaji/Hari</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Lembur/Jam</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Transport/Hari</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Makan/Hari</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Pinjaman</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => {
              const totalLoan = getTotalLoanForEmployee(emp.id);
              return (
                <tr key={emp.id}>
                  <td style={{ ...styles.td, fontFamily: 'monospace', color: '#64748b' }}>{emp.employee_id}</td>
                  <td style={{ ...styles.td, fontWeight: '500' }}>{emp.name}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatRp(emp.gaji_per_hari)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatRp(emp.lembur_per_jam)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatRp(emp.transport_per_hari)}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{formatRp(emp.makan_per_hari)}</td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    {totalLoan > 0 ? (
                      <span style={{ ...styles.badge, background: '#fef3c7', color: '#92400e' }}>{formatRp(totalLoan)}</span>
                    ) : '—'}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <button
                      onClick={() => { setEditingEmployee(emp); setShowEmployeeModal(true); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}
                    >✏️</button>
                    <button
                      onClick={() => deleteEmployee(emp.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}
                    >🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // =====================================================
  // RENDER: PAYROLL ENTRY
  // =====================================================
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  const PayrollEntry = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '600', color: '#1a1a2e' }}>Input Gaji Mingguan</h2>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>Periode: Minggu – Sabtu ({selectedWeek.range})</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={selectedWeek.id}
            onChange={(e) => setSelectedWeek(weeks.find(w => w.id === e.target.value))}
            style={{ ...styles.input, width: 'auto' }}
          >
            {weeks.map(w => <option key={w.id} value={w.id}>{w.label} ({w.range})</option>)}
          </select>
          <button onClick={() => { setPrintMode('daftarbayar'); setShowPrintModal(true); }} style={{ ...styles.button, ...styles.buttonOutline }}>
            📋 Daftar Bayar
          </button>
          <button onClick={() => { setPrintMode('batch'); setShowPrintModal(true); }} style={{ ...styles.button, ...styles.buttonSuccess }}>
            🖨️ Cetak Semua Slip
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px', maxWidth: '320px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Cari nama atau ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...styles.input, paddingLeft: '40px' }}
        />
        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>🔍</span>
      </div>

      {filteredPayrollEntries.map(entry => {
        const calc = calculatePayroll(entry);
        const totalLoan = getTotalLoanForEmployee(entry.employee_id);
        const lemburArray = JSON.parse(entry.lembur_per_hari || '[0,0,0,0,0,0,0]');
        const isOverLimit = (entry.potongan_pinjaman || 0) > totalLoan;

        return (
          <div key={entry.id} style={{
            ...styles.card,
            borderLeft: totalLoan > 0 ? '4px solid #f59e0b' : '4px solid transparent'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ fontWeight: '600', fontSize: '1.125rem' }}>{entry.name}</h3>
                  {totalLoan > 0 && (
                    <span style={{ ...styles.badge, background: '#fef3c7', color: '#92400e' }}>
                      💳 Sisa: {formatRp(totalLoan)}
                    </span>
                  )}
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{entry.emp_code}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Gaji Bersih</p>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#059669' }}>{formatRp(calc?.gajiBersih)}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 200px', gap: '24px' }}>
              {/* Hari Hadir */}
              <div>
                <label style={styles.label}>Hari Hadir</label>
                <input
                  type="number"
                  value={entry.hari_hadir || 0}
                  min="0"
                  max="7"
                  onChange={(e) => updatePayrollEntry(entry.id, { hari_hadir: parseInt(e.target.value) || 0 })}
                  style={{ ...styles.input, textAlign: 'center', fontSize: '1.25rem', fontWeight: '600' }}
                />
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '4px', textAlign: 'center' }}>Maks: 7 hari</p>
              </div>

              {/* Lembur per hari */}
              <div>
                <label style={styles.label}>Lembur (Jam per Hari)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                  {days.map((day, idx) => (
                    <div key={day} style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '4px' }}>{day}</p>
                      <input
                        type="number"
                        value={lemburArray[idx] || 0}
                        min="0"
                        onChange={(e) => {
                          const newArr = [...lemburArray];
                          newArr[idx] = parseInt(e.target.value) || 0;
                          updatePayrollEntry(entry.id, { lembur_per_hari: newArr });
                        }}
                        style={{ ...styles.input, padding: '8px 2px', textAlign: 'center' }}
                      />
                    </div>
                  ))}
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '8px', textAlign: 'right' }}>
                  Total: <strong>{calc?.totalLembur || 0} jam</strong> = {formatRp(calc?.lembur)}
                </p>
              </div>

              {/* Kerajinan & Pinjaman */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={styles.label}>Kerajinan</label>
                  <input
                    type="number"
                    value={entry.kerajinan || 0}
                    min="0"
                    step="1000"
                    onChange={(e) => updatePayrollEntry(entry.id, { kerajinan: parseInt(e.target.value) || 0 })}
                    style={styles.input}
                  />
                </div>
                <div>
                  <label style={styles.label}>Pot. Pinjaman</label>
                  <input
                    type="number"
                    value={entry.potongan_pinjaman || 0}
                    min="0"
                    step="1000"
                    onChange={(e) => updatePayrollEntry(entry.id, { potongan_pinjaman: parseInt(e.target.value) || 0 })}
                    style={{
                      ...styles.input,
                      borderColor: isOverLimit ? '#dc2626' : '#e5e7eb',
                      background: isOverLimit ? '#fef2f2' : 'white'
                    }}
                  />
                  {isOverLimit && (
                    <p style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px' }}>⚠️ Melebihi sisa pinjaman!</p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Gaji: <strong style={{ color: '#1f2937' }}>{formatRp(calc?.gaji)}</strong></span>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Transport: <strong style={{ color: '#1f2937' }}>{formatRp(calc?.transport)}</strong></span>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Makan: <strong style={{ color: '#1f2937' }}>{formatRp(calc?.makan)}</strong></span>
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Kerajinan: <strong style={{ color: '#1f2937' }}>{formatRp(calc?.kerajinan)}</strong></span>
              </div>
              <button
                onClick={() => { setSelectedEmployee(entry); setShowSlipModal(true); }}
                style={{ ...styles.button, ...styles.buttonOutline, padding: '6px 16px', fontSize: '0.875rem' }}
              >
                Lihat Slip →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // =====================================================
  // RENDER: LOANS
  // =====================================================
  const Loans = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '600', color: '#1a1a2e' }}>Pinjaman Karyawan</h2>
        <button onClick={() => setShowLoanModal(true)} style={{ ...styles.button, ...styles.buttonPrimary }}>
          + Pinjaman Baru
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {loans.filter(l => l.remaining > 0).map(loan => {
          const paidPercent = ((loan.principal - loan.remaining) / loan.principal) * 100;
          return (
            <div key={loan.id} style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontWeight: '600' }}>{loan.name}</h3>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{loan.loan_id}</p>
                </div>
                <span style={{ ...styles.badge, background: '#fef3c7', color: '#92400e' }}>Aktif</span>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Pokok Pinjaman</span>
                  <span style={{ fontWeight: '600' }}>{formatRp(loan.principal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Sudah Dibayar</span>
                  <span style={{ fontWeight: '600', color: '#059669' }}>{formatRp(loan.principal - loan.remaining)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Sisa</span>
                  <span style={{ fontWeight: '600', color: '#dc2626' }}>{formatRp(loan.remaining)}</span>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ background: '#e5e7eb', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                  <div style={{
                    background: 'linear-gradient(90deg, #059669 0%, #10b981 100%)',
                    height: '100%',
                    width: `${paidPercent}%`
                  }} />
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '4px', textAlign: 'right' }}>{paidPercent.toFixed(0)}% lunas</p>
              </div>
            </div>
          );
        })}
      </div>

      {loans.filter(l => l.remaining > 0).length === 0 && (
        <div style={{ ...styles.card, textAlign: 'center', color: '#6b7280' }}>
          Tidak ada pinjaman aktif
        </div>
      )}
    </div>
  );

  // =====================================================
  // RENDER: REPORTS
  // =====================================================
  const Reports = () => {
    const totals = payrollEntries.reduce((acc, entry) => {
      const calc = calculatePayroll(entry);
      if (!calc) return acc;
      return {
        gaji: acc.gaji + calc.gaji,
        lembur: acc.lembur + calc.lembur,
        transport: acc.transport + calc.transport,
        makan: acc.makan + calc.makan,
        kerajinan: acc.kerajinan + calc.kerajinan,
        tambahan: acc.tambahan + calc.tambahan,
        pinjaman: acc.pinjaman + calc.potonganPinjaman,
        bersih: acc.bersih + calc.gajiBersih,
      };
    }, { gaji: 0, lembur: 0, transport: 0, makan: 0, kerajinan: 0, tambahan: 0, pinjaman: 0, bersih: 0 });

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '600', color: '#1a1a2e' }}>Laporan Mingguan</h2>
            <p style={{ color: '#6b7280' }}>Periode: {selectedWeek.range}</p>
          </div>
          <select
            value={selectedWeek.id}
            onChange={(e) => setSelectedWeek(weeks.find(w => w.id === e.target.value))}
            style={{ ...styles.input, width: 'auto' }}
          >
            {weeks.map(w => <option key={w.id} value={w.id}>{w.label} ({w.range})</option>)}
          </select>
        </div>

        <div style={styles.card}>
          <h3 style={{ fontWeight: '600', marginBottom: '20px' }}>Rekap Pengeluaran</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Gaji Pokok', value: totals.gaji, color: '#2563eb' },
              { label: 'Upah Lembur', value: totals.lembur, color: '#7c3aed' },
              { label: 'Tunjangan Transport', value: totals.transport, color: '#0891b2' },
              { label: 'Uang Makan', value: totals.makan, color: '#ea580c' },
              { label: 'Kerajinan', value: totals.kerajinan, color: '#16a34a' },
              { label: 'Tambahan Lainnya', value: totals.tambahan, color: '#ca8a04' },
            ].map(item => (
              <div key={item.label} style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', borderLeft: `4px solid ${item.color}` }}>
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{item.label}</p>
                <p style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: '4px' }}>{formatRp(item.value)}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', paddingTop: '20px', borderTop: '2px solid #e5e7eb' }}>
            <div style={{ padding: '20px', background: '#dbeafe', borderRadius: '12px' }}>
              <p style={{ color: '#1e40af', fontSize: '0.875rem' }}>Total Pendapatan</p>
              <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e3a8a' }}>
                {formatRp(totals.gaji + totals.lembur + totals.transport + totals.makan + totals.kerajinan + totals.tambahan)}
              </p>
            </div>
            <div style={{ padding: '20px', background: '#fee2e2', borderRadius: '12px' }}>
              <p style={{ color: '#991b1b', fontSize: '0.875rem' }}>Total Potongan Pinjaman</p>
              <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#7f1d1d' }}>{formatRp(totals.pinjaman)}</p>
            </div>
            <div style={{ padding: '20px', background: '#dcfce7', borderRadius: '12px' }}>
              <p style={{ color: '#166534', fontSize: '0.875rem' }}>Total Dibayarkan</p>
              <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#14532d' }}>{formatRp(totals.bersih)}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button onClick={() => { setPrintMode('daftarbayar'); setShowPrintModal(true); }} style={{ ...styles.button, ...styles.buttonOutline }}>📋 Cetak Daftar Bayar</button>
          <button onClick={exportCSV} style={{ ...styles.button, ...styles.buttonOutline }}>📥 Export CSV</button>
        </div>
      </div>
    );
  };

  // =====================================================
  // MODAL: EMPLOYEE FORM
  // =====================================================
  const EmployeeModal = () => {
    const [form, setForm] = useState(editingEmployee || {
      employee_id: `EMP${String(employees.length + 1).padStart(3, '0')}`,
      name: '',
      gaji_per_hari: 70000,
      lembur_per_jam: 15000,
      transport_per_hari: 15000,
      makan_per_hari: 20000
    });

    return (
      <div style={styles.modal} onClick={() => setShowEmployeeModal(false)}>
        <div style={{ ...styles.card, maxWidth: '500px', width: '100%' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontWeight: '600', marginBottom: '20px' }}>{editingEmployee ? 'Edit Karyawan' : 'Tambah Karyawan Baru'}</h3>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div>
                <label style={styles.label}>ID Karyawan</label>
                <input
                  type="text"
                  value={form.employee_id}
                  onChange={e => setForm({ ...form, employee_id: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Nama Lengkap</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={styles.label}>Gaji per Hari (Rp)</label>
                <input
                  type="number"
                  value={form.gaji_per_hari}
                  onChange={e => setForm({ ...form, gaji_per_hari: parseInt(e.target.value) || 0 })}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Lembur per Jam (Rp)</label>
                <input
                  type="number"
                  value={form.lembur_per_jam}
                  onChange={e => setForm({ ...form, lembur_per_jam: parseInt(e.target.value) || 0 })}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Transport per Hari (Rp)</label>
                <input
                  type="number"
                  value={form.transport_per_hari}
                  onChange={e => setForm({ ...form, transport_per_hari: parseInt(e.target.value) || 0 })}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Uang Makan per Hari (Rp)</label>
                <input
                  type="number"
                  value={form.makan_per_hari}
                  onChange={e => setForm({ ...form, makan_per_hari: parseInt(e.target.value) || 0 })}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowEmployeeModal(false)} style={{ ...styles.button, ...styles.buttonOutline }}>Batal</button>
            <button onClick={() => saveEmployee(form)} style={{ ...styles.button, ...styles.buttonPrimary }}>Simpan</button>
          </div>
        </div>
      </div>
    );
  };

  // =====================================================
  // MODAL: LOAN FORM
  // =====================================================
  const LoanModal = () => {
    const [form, setForm] = useState({
      loan_id: `LOAN${String(loans.length + 1).padStart(3, '0')}`,
      employee_id: employees[0]?.id || '',
      principal: 0,
      start_date: formatDateISO(new Date()),
      notes: ''
    });

    return (
      <div style={styles.modal} onClick={() => setShowLoanModal(false)}>
        <div style={{ ...styles.card, maxWidth: '450px', width: '100%' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontWeight: '600', marginBottom: '20px' }}>Pinjaman Baru</h3>

          <div style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={styles.label}>ID Pinjaman</label>
              <input
                type="text"
                value={form.loan_id}
                onChange={e => setForm({ ...form, loan_id: e.target.value })}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Karyawan</label>
              <select
                value={form.employee_id}
                onChange={e => setForm({ ...form, employee_id: parseInt(e.target.value) })}
                style={styles.input}
              >
                <option value="">Pilih karyawan...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.employee_id} - {emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={styles.label}>Jumlah Pinjaman (Rp)</label>
              <input
                type="number"
                value={form.principal}
                onChange={e => setForm({ ...form, principal: parseInt(e.target.value) || 0 })}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Tanggal Pinjaman</label>
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Catatan (opsional)</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                style={styles.input}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowLoanModal(false)} style={{ ...styles.button, ...styles.buttonOutline }}>Batal</button>
            <button onClick={() => saveLoan(form)} style={{ ...styles.button, ...styles.buttonPrimary }}>Simpan</button>
          </div>
        </div>
      </div>
    );
  };

  // =====================================================
  // MODAL: SLIP PREVIEW
  // =====================================================
  const SlipModal = () => {
    if (!selectedEmployee) return null;
    const calc = calculatePayroll(selectedEmployee);
    const lemburArray = JSON.parse(selectedEmployee.lembur_per_hari || '[0,0,0,0,0,0,0]');

    return (
      <div style={styles.modal} onClick={() => setShowSlipModal(false)}>
        <div style={{ ...styles.card, maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
          {/* Slip Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #1a1a2e' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1a1a2e' }}>SLIP GAJI MINGGUAN</h2>
            <p style={{ color: '#4b5563' }}>CV. Kreasi Indah Jaya</p>
          </div>

          {/* Slip Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px', fontSize: '0.875rem' }}>
            <div><span style={{ color: '#6b7280' }}>Periode:</span> <strong>Min – Sab</strong></div>
            <div><span style={{ color: '#6b7280' }}>Tanggal:</span> <strong>{selectedWeek.range}</strong></div>
            <div><span style={{ color: '#6b7280' }}>Karyawan:</span> <strong>{selectedEmployee.emp_code} – {selectedEmployee.name}</strong></div>
            <div><span style={{ color: '#6b7280' }}>Cetak:</span> <strong>{formatDate(new Date())}</strong></div>
          </div>

          {/* Attendance & OT */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span><strong>Hari Hadir:</strong> {selectedEmployee.hari_hadir || 0} hari</span>
              <span><strong>Total Lembur:</strong> {calc?.totalLembur || 0} jam</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {days.map((day, idx) => (
                <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem' }}>
                  <div style={{ color: '#6b7280' }}>{day}</div>
                  <div style={{ fontWeight: '600', background: lemburArray[idx] > 0 ? '#dbeafe' : 'transparent', borderRadius: '4px' }}>{lemburArray[idx]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Earnings Table */}
          <table style={{ ...styles.table, fontSize: '0.875rem', marginBottom: '20px' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 0' }}>Gaji Pokok</td>
                <td style={{ textAlign: 'right', color: '#6b7280' }}>{formatRp(calc?.rates?.gajiPerHari)} × {selectedEmployee.hari_hadir}</td>
                <td style={{ textAlign: 'right', fontWeight: '500', width: '120px' }}>{formatRp(calc?.gaji)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 0' }}>Upah Lembur</td>
                <td style={{ textAlign: 'right', color: '#6b7280' }}>{formatRp(calc?.rates?.lemburPerJam)} × {calc?.totalLembur}</td>
                <td style={{ textAlign: 'right', fontWeight: '500' }}>{formatRp(calc?.lembur)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 0' }}>Tunjangan Transport</td>
                <td style={{ textAlign: 'right', color: '#6b7280' }}>{formatRp(calc?.rates?.transportPerHari)} × {selectedEmployee.hari_hadir}</td>
                <td style={{ textAlign: 'right', fontWeight: '500' }}>{formatRp(calc?.transport)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 0' }}>Uang Makan</td>
                <td style={{ textAlign: 'right', color: '#6b7280' }}>{formatRp(calc?.rates?.makanPerHari)} × {selectedEmployee.hari_hadir}</td>
                <td style={{ textAlign: 'right', fontWeight: '500' }}>{formatRp(calc?.makan)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '8px 0' }}>Kerajinan</td>
                <td style={{ textAlign: 'right', color: '#6b7280' }}>—</td>
                <td style={{ textAlign: 'right', fontWeight: '500' }}>{formatRp(calc?.kerajinan)}</td>
              </tr>
              <tr style={{ background: '#f0fdf4' }}>
                <td colSpan="2" style={{ padding: '10px 0', fontWeight: '600' }}>Total Pendapatan</td>
                <td style={{ textAlign: 'right', fontWeight: '700' }}>{formatRp(calc?.totalPendapatan)}</td>
              </tr>
              {(calc?.potonganPinjaman || 0) > 0 && (
                <tr style={{ background: '#fef2f2' }}>
                  <td colSpan="2" style={{ padding: '10px 0', fontWeight: '600' }}>Potongan Pinjaman</td>
                  <td style={{ textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>({formatRp(calc?.potonganPinjaman)})</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Net Pay */}
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            padding: '16px 20px',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <span style={{ color: 'white', fontWeight: '600' }}>GAJI BERSIH (DIBAYARKAN)</span>
            <span style={{ color: 'white', fontWeight: '700', fontSize: '1.5rem' }}>{formatRp(calc?.gajiBersih)}</span>
          </div>

          {/* Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '50px' }}>Dibuat oleh,</p>
              <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px' }}>(.........................)</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '50px' }}>Diterima oleh,</p>
              <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px' }}>(.........................)</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowSlipModal(false)} style={{ ...styles.button, ...styles.buttonOutline }}>Tutup</button>
            <button onClick={() => window.print()} style={{ ...styles.button, ...styles.buttonPrimary }}>🖨️ Cetak</button>
          </div>
        </div>
      </div>
    );
  };

  // =====================================================
  // MODAL: PRINT VIEW (BATCH / DAFTAR BAYAR)
  // =====================================================
  const PrintModal = () => {
    const totalBayar = payrollEntries.reduce((sum, entry) => {
      const calc = calculatePayroll(entry);
      return sum + (calc?.gajiBersih || 0);
    }, 0);

    return (
      <div style={styles.modal} onClick={() => setShowPrintModal(false)}>
        <div style={{ background: '#f1f5f9', borderRadius: '16px', maxWidth: printMode === 'daftarbayar' ? '900px' : '700px', width: '100%', maxHeight: '95vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
            <h3 style={{ fontWeight: '600' }}>
              {printMode === 'daftarbayar' ? '📋 Daftar Bayar' : '🖨️ Cetak Semua Slip (3 per halaman)'}
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowPrintModal(false)} style={{ ...styles.button, ...styles.buttonOutline }}>✕ Tutup</button>
              <button onClick={() => window.print()} style={{ ...styles.button, ...styles.buttonPrimary }}>🖨️ Cetak</button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '24px' }}>
            {printMode === 'daftarbayar' ? (
              /* DAFTAR BAYAR */
              <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '2px solid #1a1a2e', paddingBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>DAFTAR BAYAR GAJI MINGGUAN</h2>
                  <p style={{ color: '#4b5563' }}>CV. Kreasi Indah Jaya</p>
                  <p style={{ marginTop: '8px' }}>Periode: <strong>{selectedWeek.range}</strong></p>
                </div>

                <table style={{ ...styles.table, marginBottom: '24px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', width: '40px' }}>No</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'left' }}>Nama Karyawan</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', width: '60px' }}>Hari</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'right' }}>Gaji Bersih</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', width: '80px' }}>✓ Bayar</th>
                      <th style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center', width: '120px' }}>Tanda Tangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollEntries.map((entry, idx) => {
                      const calc = calculatePayroll(entry);
                      return (
                        <tr key={entry.id}>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px' }}>
                            {entry.name}
                            <span style={{ color: '#9ca3af', marginLeft: '8px', fontSize: '0.875rem' }}>{entry.emp_code}</span>
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>{entry.hari_hadir || 0}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'right', fontWeight: '600' }}>{formatRp(calc?.gajiBersih)}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px', textAlign: 'center' }}>
                            <div style={{ width: '24px', height: '24px', border: '2px solid #d1d5db', margin: '0 auto' }}></div>
                          </td>
                          <td style={{ border: '1px solid #d1d5db', padding: '10px' }}></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f0fdf4' }}>
                      <td colSpan="3" style={{ border: '1px solid #d1d5db', padding: '12px', fontWeight: '700', textAlign: 'right' }}>TOTAL</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '12px', textAlign: 'right', fontWeight: '700', fontSize: '1.125rem' }}>{formatRp(totalBayar)}</td>
                      <td colSpan="2" style={{ border: '1px solid #d1d5db' }}></td>
                    </tr>
                  </tfoot>
                </table>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '40px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#6b7280', marginBottom: '50px' }}>Dibuat oleh,</p>
                    <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px' }}>(................................)</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#6b7280', marginBottom: '50px' }}>Disetujui oleh,</p>
                    <div style={{ borderTop: '1px solid #d1d5db', paddingTop: '8px' }}>(................................)</div>
                  </div>
                </div>
              </div>
            ) : (
              /* BATCH SLIPS - 3 per page */
              <div>
                <p style={{ marginBottom: '16px', color: '#6b7280', fontSize: '0.875rem' }}>💡 Format 3 slip per halaman - potong sesuai garis putus-putus</p>
                {Array.from({ length: Math.ceil(payrollEntries.length / 3) }, (_, pageIdx) => (
                  <div key={pageIdx} style={{ background: 'white', marginBottom: '24px', padding: '16px', borderRadius: '8px' }}>
                    <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '8px' }}>Halaman {pageIdx + 1}</p>
                    {payrollEntries.slice(pageIdx * 3, (pageIdx + 1) * 3).map(entry => {
                      const calc = calculatePayroll(entry);
                      const lemburArray = JSON.parse(entry.lembur_per_hari || '[0,0,0,0,0,0,0]');
                      return (
                        <div key={entry.id} style={{ border: '1px dashed #cbd5e1', padding: '16px', marginBottom: '8px', fontSize: '0.75rem' }}>
                          <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '2px solid #1a1a2e', paddingBottom: '8px' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: '700' }}>SLIP GAJI MINGGUAN</h4>
                            <p style={{ color: '#4b5563', fontSize: '0.7rem' }}>CV. Kreasi Indah Jaya</p>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
                            <div>Periode: <strong>{selectedWeek.range}</strong></div>
                            <div>Karyawan: <strong>{entry.emp_code} - {entry.name}</strong></div>
                            <div>Hari Hadir: <strong>{entry.hari_hadir || 0}</strong></div>
                            <div>Total Lembur: <strong>{calc?.totalLembur || 0} jam</strong></div>
                          </div>
                          <table style={{ ...styles.table, fontSize: '0.65rem', marginBottom: '8px' }}>
                            <tbody>
                              <tr><td>Gaji Pokok</td><td style={{ textAlign: 'right' }}>{formatRp(calc?.gaji)}</td></tr>
                              <tr><td>Lembur</td><td style={{ textAlign: 'right' }}>{formatRp(calc?.lembur)}</td></tr>
                              <tr><td>Transport</td><td style={{ textAlign: 'right' }}>{formatRp(calc?.transport)}</td></tr>
                              <tr><td>Makan</td><td style={{ textAlign: 'right' }}>{formatRp(calc?.makan)}</td></tr>
                              <tr><td>Kerajinan</td><td style={{ textAlign: 'right' }}>{formatRp(calc?.kerajinan)}</td></tr>
                              {(calc?.potonganPinjaman || 0) > 0 && (
                                <tr style={{ color: '#dc2626' }}><td>Pot. Pinjaman</td><td style={{ textAlign: 'right' }}>({formatRp(calc?.potonganPinjaman)})</td></tr>
                              )}
                            </tbody>
                          </table>
                          <div style={{ background: '#059669', color: 'white', padding: '8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600' }}>GAJI BERSIH</span>
                            <span style={{ fontWeight: '700' }}>{formatRp(calc?.gajiBersih)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================
  if (loading) {
    return (
      <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
          <p>Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...styles.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#dc2626' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
          <p>Error: {error}</p>
          <button onClick={loadInitialData} style={{ ...styles.button, ...styles.buttonPrimary, marginTop: '16px' }}>Coba Lagi</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={{ marginBottom: '32px', padding: '0 8px' }}>
          <h1 style={{ color: 'white', fontSize: '1.25rem', fontWeight: '700' }}>💼 PayrollApp</h1>
          <p style={{ color: '#93c5fd', fontSize: '0.75rem', marginTop: '4px' }}>CV. Kreasi Indah Jaya</p>
        </div>

        <nav style={{ flex: 1 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                marginBottom: '4px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '0.9375rem',
                background: activeTab === tab.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: activeTab === tab.id ? 'white' : '#bfdbfe',
                fontWeight: activeTab === tab.id ? '600' : '400'
              }}
            >
              <span style={{ fontSize: '1.125rem' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <button onClick={exportCSV} style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.2)',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)',
          color: '#bfdbfe',
          fontSize: '0.875rem'
        }}>
          <span>📥</span> Export CSV
        </button>

        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
          <p style={{ color: '#93c5fd', fontSize: '0.75rem' }}>Sistem Gaji</p>
          <p style={{ color: 'white', fontSize: '0.875rem', fontWeight: '500' }}>v1.0</p>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'employees' && <Employees />}
        {activeTab === 'payroll' && <PayrollEntry />}
        {activeTab === 'loans' && <Loans />}
        {activeTab === 'reports' && <Reports />}
      </div>

      {/* Modals */}
      {showEmployeeModal && <EmployeeModal />}
      {showLoanModal && <LoanModal />}
      {showSlipModal && <SlipModal />}
      {showPrintModal && <PrintModal />}
    </div>
  );
}
