/* ================================================================
   PERSONAL EXPENSE TRACKER — script.js
   Sections:
   1. Constants & Config
   2. LocalStorage Data Layer
   3. Utility Helpers
   4. Expense CRUD Logic
   5. Search & Filter Logic
   6. Summary / Analytics Calculations
   7. UI — Navigation
   8. UI — Toasts
   9. UI — Modals
   10. UI — Renderers (Dashboard, Table, Charts, etc.)
   11. Event Bindings & Init
   ================================================================ */

/* ================================================================
   1. CONSTANTS & CONFIG
   ================================================================ */
const STORAGE_KEY = "expenses";
const THEME_KEY = "theme";

// Fixed category list preserved from the original CLI tool
const CATEGORIES = [
  { name: "Food", icon: "🍔", color: "#f59e0b" },
  { name: "Travel", icon: "✈️", color: "#0ea5e9" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899" },
  { name: "Education", icon: "📚", color: "#6366f1" },
  { name: "Entertainment", icon: "🎬", color: "#8b5cf6" },
  { name: "Health", icon: "💊", color: "#10b981" },
  { name: "Bills", icon: "🧾", color: "#ef4444" },
  { name: "Utilities", icon: "💡", color: "#eab308" },
  { name: "Other", icon: "🔖", color: "#64748b" }
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Keeps track of currently open modal targets and active filters
let editingExpenseId = null;
let deletingExpenseId = null;

/* ================================================================
   2. LOCALSTORAGE DATA LAYER
   (Centralized so storage can later be swapped for a real backend)
   ================================================================ */
function loadExpenses() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveExpenses(expenses) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function loadTheme() {
  return localStorage.getItem(THEME_KEY) || "light";
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

/* ================================================================
   3. UTILITY HELPERS
   ================================================================ */
function generateNextId(expenses) {
  if (expenses.length === 0) return 1;
  return Math.max(...expenses.map(e => e.id)) + 1;
}

function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return "₹" + value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(isoDate) {
  if (!isoDate) return "-";
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  return `${day} ${month} ${d.getFullYear()}`;
}

function getCategoryInfo(name) {
  return CATEGORIES.find(c => c.name === name) || { name, icon: "🔖", color: "#64748b" };
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* ================================================================
   4. EXPENSE CRUD LOGIC
   ================================================================ */
function addExpense(amount, category, description, date) {
  const expenses = loadExpenses();
  const newExpense = {
    id: generateNextId(expenses),
    amount: parseFloat(amount),
    category,
    description: description.trim(),
    date
  };
  expenses.push(newExpense);
  saveExpenses(expenses);
  return newExpense;
}

function updateExpense(id, amount, category, description, date) {
  const expenses = loadExpenses();
  const expense = expenses.find(e => e.id === id);
  if (!expense) return false;
  expense.amount = parseFloat(amount);
  expense.category = category;
  expense.description = description.trim();
  expense.date = date;
  saveExpenses(expenses);
  return true;
}

// Deletes an expense and renumbers remaining IDs to stay sequential (1..n)
function deleteExpense(id) {
  let expenses = loadExpenses();
  expenses = expenses.filter(e => e.id !== id);

  // Renumber IDs sequentially based on current order
  expenses.sort((a, b) => a.id - b.id);
  expenses.forEach((exp, index) => { exp.id = index + 1; });

  saveExpenses(expenses);
}

function clearAllExpenses() {
  saveExpenses([]);
}

/* ================================================================
   5. SEARCH & FILTER LOGIC
   ================================================================ */
function searchExpenses(expenses, query) {
  if (!query) return expenses;
  const q = query.trim().toLowerCase();
  return expenses.filter(e =>
    String(e.id).includes(q) ||
    e.category.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q)
  );
}

function filterExpenses(expenses, { category = "all", month = "all", year = "all", minAmount = "", maxAmount = "" } = {}) {
  return expenses.filter(e => {
    const d = new Date(e.date + "T00:00:00");
    if (category !== "all" && e.category !== category) return false;
    if (month !== "all" && (d.getMonth() + 1) !== Number(month)) return false;
    if (year !== "all" && d.getFullYear() !== Number(year)) return false;
    if (minAmount !== "" && e.amount < Number(minAmount)) return false;
    if (maxAmount !== "" && e.amount > Number(maxAmount)) return false;
    return true;
  });
}

function getDistinctYears(expenses) {
  const years = new Set(expenses.map(e => new Date(e.date + "T00:00:00").getFullYear()));
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

/* ================================================================
   6. SUMMARY / ANALYTICS CALCULATIONS
   ================================================================ */
function calculateMonthlySummary(expenses, month, year) {
  const matched = expenses.filter(e => {
    const d = new Date(e.date + "T00:00:00");
    return (d.getMonth() + 1) === Number(month) && d.getFullYear() === Number(year);
  });

  if (matched.length === 0) {
    return { total: 0, count: 0, average: 0, highest: 0, lowest: 0, expenses: [] };
  }

  const amounts = matched.map(e => e.amount);
  const total = amounts.reduce((sum, a) => sum + a, 0);

  return {
    total,
    count: matched.length,
    average: total / matched.length,
    highest: Math.max(...amounts),
    lowest: Math.min(...amounts),
    expenses: matched
  };
}

function calculateCategorySpending(expenses) {
  const totals = {};
  let grandTotal = 0;

  CATEGORIES.forEach(c => { totals[c.name] = 0; });

  expenses.forEach(e => {
    if (!(e.category in totals)) totals[e.category] = 0;
    totals[e.category] += e.amount;
    grandTotal += e.amount;
  });

  const breakdown = Object.keys(totals).map(name => ({
    category: name,
    amount: totals[name],
    percentage: grandTotal > 0 ? (totals[name] / grandTotal) * 100 : 0
  }));

  // Sort descending by amount, keep zero-amount categories at the bottom
  breakdown.sort((a, b) => b.amount - a.amount);

  return { breakdown, grandTotal };
}

function calculateMonthlyTotalsForYear(expenses, year) {
  const totals = new Array(12).fill(0);
  expenses.forEach(e => {
    const d = new Date(e.date + "T00:00:00");
    if (d.getFullYear() === Number(year)) {
      totals[d.getMonth()] += e.amount;
    }
  });
  return totals;
}

function calculateOverallStats(expenses) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const count = expenses.length;
  const average = count > 0 ? total / count : 0;

  const now = new Date();
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date + "T00:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

  return { total, count, average, thisMonthTotal, thisMonthCount: thisMonthExpenses.length };
}

/* ================================================================
   7. UI — NAVIGATION
   ================================================================ */
function navigateTo(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(`page-${pageId}`).classList.add("active");

  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  // Refresh data relevant to the page being shown
  if (pageId === "dashboard") renderDashboard();
  if (pageId === "all-expenses") renderAllExpensesPage();
  if (pageId === "monthly-summary") renderMonthlySummaryPage();
  if (pageId === "category-analysis") renderCategoryAnalysisPage();
  if (pageId === "add-expense") prefillAddExpenseDate();

  closeMobileSidebar();
  window.scrollTo(0, 0);
}

function closeMobileSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("show");
}
function openMobileSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebarOverlay").classList.add("show");
}

/* ================================================================
   8. UI — TOASTS
   ================================================================ */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const icons = { success: "✅", error: "⚠️", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ""}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ================================================================
   9. UI — MODALS
   ================================================================ */
function openEditModal(id) {
  const expenses = loadExpenses();
  const expense = expenses.find(e => e.id === id);
  if (!expense) return;

  editingExpenseId = id;
  document.getElementById("editId").value = expense.id;
  document.getElementById("editAmount").value = expense.amount;
  document.getElementById("editCategory").value = expense.category;
  document.getElementById("editDescription").value = expense.description;
  document.getElementById("editDate").value = expense.date;
  clearEditErrors();

  document.getElementById("editModal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
  editingExpenseId = null;
}

function openDeleteModal(id) {
  deletingExpenseId = id;
  document.getElementById("deleteModal").classList.remove("hidden");
}

function closeDeleteModal() {
  document.getElementById("deleteModal").classList.add("hidden");
  deletingExpenseId = null;
}

function clearEditErrors() {
  ["editErrorAmount", "editErrorCategory", "editErrorDescription", "editErrorDate"].forEach(id => {
    document.getElementById(id).textContent = "";
  });
}

function clearAddErrors() {
  ["errorAmount", "errorCategory", "errorDescription", "errorDate"].forEach(id => {
    document.getElementById(id).textContent = "";
  });
}

/* ================================================================
   10. UI — RENDERERS
   ================================================================ */

/* ---------- Populate static dropdowns (categories, months, years) ---------- */
function populateCategoryDropdowns() {
  const options = CATEGORIES.map(c => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");

  document.getElementById("expenseCategory").innerHTML = `<option value="">Select category</option>` + options;
  document.getElementById("editCategory").innerHTML = options;
  document.getElementById("filterCategory").innerHTML = `<option value="all">All Categories</option>` + options;
}

function populateMonthDropdowns() {
  const optionsWithAll = `<option value="all">All Months</option>` +
    MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  const optionsOnly = MONTH_NAMES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");

  document.getElementById("filterMonth").innerHTML = optionsWithAll;
  document.getElementById("summaryMonth").innerHTML = optionsOnly;

  // Default the summary month selector to the current month
  document.getElementById("summaryMonth").value = new Date().getMonth() + 1;
}

function populateYearDropdowns() {
  const expenses = loadExpenses();
  const years = getDistinctYears(expenses);
  const currentYear = new Date().getFullYear();

  document.getElementById("filterYear").innerHTML = `<option value="all">All Years</option>` +
    years.map(y => `<option value="${y}">${y}</option>`).join("");

  document.getElementById("summaryYear").innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  document.getElementById("summaryYear").value = currentYear;
}

function prefillAddExpenseDate() {
  const dateInput = document.getElementById("expenseDate");
  if (!dateInput.value) dateInput.value = todayISO();
}

/* ---------- Dashboard ---------- */
function renderGreeting() {
  const hour = new Date().getHours();
  let greeting = "Good evening 👋";
  if (hour < 12) greeting = "Good morning ☀️";
  else if (hour < 17) greeting = "Good afternoon 🌤️";

  document.getElementById("greetingText").textContent = greeting;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  document.getElementById("dateIndicator").textContent = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()} · ${dateStr}`;
}

function renderDashboard() {
  renderGreeting();
  const expenses = loadExpenses();
  const stats = calculateOverallStats(expenses);

  document.getElementById("statTotalSpending").textContent = formatCurrency(stats.total);
  document.getElementById("statTotalSub").textContent = `${stats.count} transaction${stats.count !== 1 ? "s" : ""} recorded`;

  document.getElementById("statThisMonth").textContent = formatCurrency(stats.thisMonthTotal);
  document.getElementById("statMonthSub").textContent = `${stats.thisMonthCount} expense${stats.thisMonthCount !== 1 ? "s" : ""} this month`;

  document.getElementById("statCount").textContent = stats.count;
  document.getElementById("statAverage").textContent = formatCurrency(stats.average);

  renderRecentExpenses(expenses);
  renderDashboardCategoryList(expenses);
}

function renderRecentExpenses(expenses) {
  const container = document.getElementById("recentExpensesList");

  if (expenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧾</div>
        <h3>No expenses yet</h3>
        <p>Start tracking your spending by adding your first expense.</p>
        <button class="btn btn-primary" onclick="navigateTo('add-expense')">+ Add Expense</button>
      </div>`;
    return;
  }

  const recent = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id).slice(0, 5);

  container.innerHTML = recent.map(e => {
    const cat = getCategoryInfo(e.category);
    return `
      <div class="recent-expense-item">
        <div class="recent-icon" style="background:${cat.color}22; color:${cat.color}">${cat.icon}</div>
        <div class="recent-details">
          <span class="recent-desc">${escapeHtml(e.description)}</span>
          <span class="recent-meta">${escapeHtml(cat.name)} · ${formatDate(e.date)}</span>
        </div>
        <div class="recent-amount">${formatCurrency(e.amount)}</div>
      </div>
    `;
  }).join("");
}

function renderDashboardCategoryList(expenses) {
  const container = document.getElementById("dashboardCategoryList");
  const { breakdown, grandTotal } = calculateCategorySpending(expenses);
  const top = breakdown.filter(b => b.amount > 0).slice(0, 5);

  if (top.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h3>No data yet</h3>
        <p>Category insights will appear once you add expenses.</p>
      </div>`;
    return;
  }

  container.innerHTML = top.map(b => {
    const cat = getCategoryInfo(b.category);
    return `
      <div class="mini-category-row">
        <span class="mini-cat-dot" style="background:${cat.color}"></span>
        <span class="mini-cat-name">${cat.icon} ${escapeHtml(cat.name)}</span>
        <span class="mini-cat-amount">${formatCurrency(b.amount)}</span>
      </div>
    `;
  }).join("");
}

/* ---------- All Expenses Page ---------- */
function getAllExpensesFilterState() {
  return {
    search: document.getElementById("searchInput").value,
    category: document.getElementById("filterCategory").value,
    month: document.getElementById("filterMonth").value,
    year: document.getElementById("filterYear").value,
    minAmount: document.getElementById("filterMinAmount").value,
    maxAmount: document.getElementById("filterMaxAmount").value
  };
}

function renderAllExpensesPage() {
  populateYearDropdowns();
  renderExpensesTable();
}

function renderExpensesTable() {
  const expenses = loadExpenses();
  const state = getAllExpensesFilterState();

  let result = filterExpenses(expenses, state);
  result = searchExpenses(result, state.search);
  result.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

  const tbody = document.getElementById("expensesTableBody");
  const emptyState = document.getElementById("expensesEmptyState");
  const tableWrapper = document.querySelector("#page-all-expenses .table-wrapper");

  if (expenses.length === 0) {
    tableWrapper.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  tableWrapper.classList.remove("hidden");

  if (result.length === 0) {
    emptyState.classList.remove("hidden");
    emptyState.innerHTML = `
      <div class="empty-icon">🔍</div>
      <h3>No matching expenses</h3>
      <p>Try adjusting your search or filters.</p>
    `;
    tbody.innerHTML = "";
    return;
  }

  emptyState.classList.add("hidden");

  tbody.innerHTML = result.map(e => {
    const cat = getCategoryInfo(e.category);
    return `
      <tr>
        <td>#${e.id}</td>
        <td class="amount-cell">${formatCurrency(e.amount)}</td>
        <td><span class="badge" style="background:${cat.color}22; color:${cat.color}">${cat.icon} ${escapeHtml(cat.name)}</span></td>
        <td>${escapeHtml(e.description)}</td>
        <td>${formatDate(e.date)}</td>
        <td class="actions-cell">
          <button class="btn-icon-sm btn-edit" title="Edit" onclick="openEditModal(${e.id})">✏️</button>
          <button class="btn-icon-sm btn-delete" title="Delete" onclick="openDeleteModal(${e.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
}

function clearAllFilters() {
  document.getElementById("searchInput").value = "";
  document.getElementById("filterCategory").value = "all";
  document.getElementById("filterMonth").value = "all";
  document.getElementById("filterYear").value = "all";
  document.getElementById("filterMinAmount").value = "";
  document.getElementById("filterMaxAmount").value = "";
  renderExpensesTable();
}

/* ---------- Monthly Summary Page ---------- */
function renderMonthlySummaryPage() {
  populateYearDropdowns();
  // Reapply defaults only if selects are empty (first visit already sets defaults)
  if (!document.getElementById("summaryMonth").value) {
    document.getElementById("summaryMonth").value = new Date().getMonth() + 1;
  }
  if (!document.getElementById("summaryYear").value) {
    document.getElementById("summaryYear").value = new Date().getFullYear();
  }
  updateMonthlySummary();
}

function updateMonthlySummary() {
  const month = document.getElementById("summaryMonth").value;
  const year = document.getElementById("summaryYear").value;
  const expenses = loadExpenses();

  const summary = calculateMonthlySummary(expenses, month, year);

  document.getElementById("msTotal").textContent = formatCurrency(summary.total);
  document.getElementById("msCount").textContent = summary.count;
  document.getElementById("msAverage").textContent = formatCurrency(summary.average);
  document.getElementById("msHighest").textContent = formatCurrency(summary.highest);
  document.getElementById("msLowest").textContent = formatCurrency(summary.lowest);

  // Monthly bar chart for the selected year
  document.getElementById("chartYearLabel").textContent = year;
  renderMonthlyBarChart(expenses, year, Number(month));

  // Table of expenses for the selected month
  const tbody = document.getElementById("monthlyExpensesBody");
  const emptyState = document.getElementById("monthlyEmptyState");
  const tableWrapper = document.querySelector("#page-monthly-summary .table-wrapper");

  if (summary.expenses.length === 0) {
    tableWrapper.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  tableWrapper.classList.remove("hidden");
  emptyState.classList.add("hidden");

  const sorted = [...summary.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = sorted.map(e => {
    const cat = getCategoryInfo(e.category);
    return `
      <tr>
        <td>#${e.id}</td>
        <td class="amount-cell">${formatCurrency(e.amount)}</td>
        <td><span class="badge" style="background:${cat.color}22; color:${cat.color}">${cat.icon} ${escapeHtml(cat.name)}</span></td>
        <td>${escapeHtml(e.description)}</td>
        <td>${formatDate(e.date)}</td>
      </tr>
    `;
  }).join("");
}

function renderMonthlyBarChart(expenses, year, activeMonth) {
  const totals = calculateMonthlyTotalsForYear(expenses, year);
  const maxValue = Math.max(...totals, 1);
  const container = document.getElementById("monthlyBarChart");

  container.innerHTML = totals.map((amount, index) => {
    const heightPct = amount > 0 ? Math.max((amount / maxValue) * 100, 4) : 2;
    const isActive = (index + 1) === activeMonth;
    return `
      <div class="bar-column">
        <span class="bar-value-label">${amount > 0 ? formatCurrency(amount) : ""}</span>
        <div class="bar-fill-wrapper">
          <div class="bar-fill ${isActive ? "active-bar" : ""}" style="height:${heightPct}%" title="${MONTH_NAMES[index]}: ${formatCurrency(amount)}"></div>
        </div>
        <span class="bar-label">${MONTH_NAMES[index].slice(0, 3)}</span>
      </div>
    `;
  }).join("");
}

/* ---------- Category Analysis Page ---------- */
function renderCategoryAnalysisPage() {
  const expenses = loadExpenses();
  const { breakdown, grandTotal } = calculateCategorySpending(expenses);

  renderDonutChart(breakdown, grandTotal);
  renderCategoryBreakdownList(breakdown, grandTotal);
}

function renderDonutChart(breakdown, grandTotal) {
  const donut = document.getElementById("donutChart");
  const legend = document.getElementById("donutLegend");

  document.getElementById("donutTotal").textContent = formatCurrency(grandTotal);

  const active = breakdown.filter(b => b.amount > 0);

  if (grandTotal === 0 || active.length === 0) {
    donut.style.background = "conic-gradient(var(--border) 0 100%)";
    legend.innerHTML = `<p style="color:var(--text-secondary); font-size:13.5px;">No spending data available yet.</p>`;
    return;
  }

  // Build a conic-gradient string based on each category's percentage
  let cumulative = 0;
  const gradientParts = active.map(b => {
    const cat = getCategoryInfo(b.category);
    const start = cumulative;
    cumulative += b.percentage;
    return `${cat.color} ${start}% ${cumulative}%`;
  });
  donut.style.background = `conic-gradient(${gradientParts.join(", ")})`;

  legend.innerHTML = active.map(b => {
    const cat = getCategoryInfo(b.category);
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background:${cat.color}"></span>
        <span class="legend-name">${cat.icon} ${escapeHtml(cat.name)}</span>
        <span class="legend-pct">${b.percentage.toFixed(1)}%</span>
      </div>
    `;
  }).join("");
}

function renderCategoryBreakdownList(breakdown, grandTotal) {
  const container = document.getElementById("categoryBreakdownList");
  const emptyState = document.getElementById("categoryEmptyState");
  const totalRow = document.getElementById("categoryTotalRow");

  document.getElementById("categoryGrandTotal").textContent = formatCurrency(grandTotal);

  if (grandTotal === 0) {
    container.classList.add("hidden");
    totalRow.classList.add("hidden");
    emptyState.classList.remove("hidden");
    return;
  }

  container.classList.remove("hidden");
  totalRow.classList.remove("hidden");
  emptyState.classList.add("hidden");

  container.innerHTML = breakdown.map(b => {
    const cat = getCategoryInfo(b.category);
    return `
      <div class="category-row">
        <div class="category-row-top">
          <div class="category-name-group">
            <span class="category-icon-badge" style="background:${cat.color}22; color:${cat.color}">${cat.icon}</span>
            ${escapeHtml(cat.name)}
          </div>
          <div class="category-amounts">
            <span class="category-amount">${formatCurrency(b.amount)}</span>
            <span class="category-percent">${b.percentage.toFixed(1)}%</span>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${b.percentage}%; background:${cat.color}"></div>
        </div>
      </div>
    `;
  }).join("");
}

/* ---------- CSV Export ---------- */
function exportExpensesToCSV() {
  const expenses = loadExpenses();
  if (expenses.length === 0) {
    showToast("No expenses available to export.", "error");
    return;
  }

  const headers = ["ID", "Amount", "Category", "Description", "Date"];
  const rows = expenses.map(e => [e.id, e.amount, e.category, e.description, e.date]);

  const csvLines = [headers.join(",")];
  rows.forEach(row => {
    csvLines.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","));
  });

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `expenses_${todayISO()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast("Expenses exported successfully", "success");
}

/* ================================================================
   THEME (DARK / LIGHT MODE)
   ================================================================ */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeIcon").textContent = theme === "dark" ? "☀️" : "🌙";
  document.getElementById("mobileThemeBtn").textContent = theme === "dark" ? "☀️" : "🌙";
  document.getElementById("darkModeSwitch").checked = theme === "dark";
  saveTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
}

/* ================================================================
   FORM VALIDATION
   ================================================================ */
function validateExpenseForm({ amount, category, description, date }, errorIds) {
  let isValid = true;

  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    document.getElementById(errorIds.amount).textContent = "Please enter a valid amount greater than 0.";
    isValid = false;
  }
  if (!category) {
    document.getElementById(errorIds.category).textContent = "Please select a category.";
    isValid = false;
  }
  if (!description || description.trim() === "") {
    document.getElementById(errorIds.description).textContent = "Description is required.";
    isValid = false;
  }
  if (!date) {
    document.getElementById(errorIds.date).textContent = "Please select a valid date.";
    isValid = false;
  }

  return isValid;
}

/* ================================================================
   11. EVENT BINDINGS & INIT
   ================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  // ---- Initial Setup ----
  applyTheme(loadTheme());
  populateCategoryDropdowns();
  populateMonthDropdowns();
  populateYearDropdowns();
  prefillAddExpenseDate();
  navigateTo("dashboard");

  // ---- Sidebar Navigation ----
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
  });
  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.nav));
  });

  // ---- Mobile Sidebar Toggle ----
  document.getElementById("mobileMenuBtn").addEventListener("click", openMobileSidebar);
  document.getElementById("sidebarCloseBtn").addEventListener("click", closeMobileSidebar);
  document.getElementById("sidebarOverlay").addEventListener("click", closeMobileSidebar);

  // ---- Theme Toggle ----
  document.getElementById("themeToggleBtn").addEventListener("click", toggleTheme);
  document.getElementById("mobileThemeBtn").addEventListener("click", toggleTheme);
  document.getElementById("darkModeSwitch").addEventListener("change", toggleTheme);

  // ---- Add Expense Form ----
  document.getElementById("addExpenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    clearAddErrors();

    const amount = document.getElementById("expenseAmount").value;
    const category = document.getElementById("expenseCategory").value;
    const description = document.getElementById("expenseDescription").value;
    const date = document.getElementById("expenseDate").value;

    const isValid = validateExpenseForm(
      { amount, category, description, date },
      { amount: "errorAmount", category: "errorCategory", description: "errorDescription", date: "errorDate" }
    );

    if (!isValid) {
      showToast("Please fill all required fields correctly.", "error");
      return;
    }

    addExpense(amount, category, description, date);
    document.getElementById("addExpenseForm").reset();
    prefillAddExpenseDate();
    showToast("Expense added successfully", "success");
    renderDashboard();
    navigateTo("all-expenses");
  });

  // ---- All Expenses: Search & Filters ----
  document.getElementById("searchInput").addEventListener("input", renderExpensesTable);
  ["filterCategory", "filterMonth", "filterYear", "filterMinAmount", "filterMaxAmount"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderExpensesTable);
    document.getElementById(id).addEventListener("change", renderExpensesTable);
  });
  document.getElementById("clearFiltersBtn").addEventListener("click", clearAllFilters);

  // ---- Edit Modal ----
  document.getElementById("editExpenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    clearEditErrors();

    const amount = document.getElementById("editAmount").value;
    const category = document.getElementById("editCategory").value;
    const description = document.getElementById("editDescription").value;
    const date = document.getElementById("editDate").value;

    const isValid = validateExpenseForm(
      { amount, category, description, date },
      { amount: "editErrorAmount", category: "editErrorCategory", description: "editErrorDescription", date: "editErrorDate" }
    );

    if (!isValid) {
      showToast("Please fill all required fields correctly.", "error");
      return;
    }

    updateExpense(editingExpenseId, amount, category, description, date);
    closeEditModal();
    showToast("Expense updated successfully", "success");
    renderExpensesTable();
    renderDashboard();
  });
  document.getElementById("editCancelBtn").addEventListener("click", closeEditModal);
  document.getElementById("editModalClose").addEventListener("click", closeEditModal);

  // ---- Delete Modal ----
  document.getElementById("deleteCancelBtn").addEventListener("click", closeDeleteModal);
  document.getElementById("deleteModalClose").addEventListener("click", closeDeleteModal);

  // Single unified handler: supports deleting one expense OR clearing all data
  document.getElementById("deleteConfirmBtn").addEventListener("click", () => {
    if (deletingExpenseId === null) return;

    if (deletingExpenseId === "ALL") {
      clearAllExpenses();
      closeDeleteModal();
      document.querySelector("#deleteModal .modal-message").textContent =
        "Are you sure you want to delete this expense? This action cannot be undone.";
      showToast("All expense data cleared", "success");
      renderDashboard();
      renderAllExpensesPage();
    } else {
      deleteExpense(deletingExpenseId);
      closeDeleteModal();
      showToast("Expense deleted successfully", "success");
      renderExpensesTable();
      renderDashboard();
    }
  });

  // ---- Monthly Summary ----
  document.getElementById("summaryMonth").addEventListener("change", updateMonthlySummary);
  document.getElementById("summaryYear").addEventListener("change", updateMonthlySummary);

  // ---- Settings ----
  document.getElementById("exportCsvBtn").addEventListener("click", exportExpensesToCSV);
  document.getElementById("clearAllBtn").addEventListener("click", () => {
    deletingExpenseId = "ALL";
    document.querySelector("#deleteModal .modal-message").textContent =
      "Are you sure you want to permanently delete ALL expenses? This action cannot be undone.";
    document.getElementById("deleteModal").classList.remove("hidden");
  });
});
