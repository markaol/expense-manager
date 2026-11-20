(() => {
  'use strict';

  const STORAGE_KEY = 'expense-manager-transactions-v1';
  const $ = (selector) => document.querySelector(selector);
  const form = $('#transactionForm');
  const backdrop = $('#modalBackdrop');
  const dateInput = $('#date');
  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });
  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'short' });
  const fullDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const icons = { Food: '◉', Housing: '⌂', Transport: '↗', Shopping: '◇', Entertainment: '♫', Health: '+', Salary: '↙', Other: '•' };
  let transactions = loadTransactions();
  let toastTimer;

  function loadTransactions() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) return [];
      return stored.filter((item) => item && typeof item.id === 'string' && typeof item.description === 'string' && Number.isFinite(Number(item.amount)) && ['income', 'expense'].includes(item.type) && typeof item.date === 'string');
    } catch (error) {
      console.warn('Could not load saved transactions.', error);
      return [];
    }
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch (error) {
      console.error('Could not save transactions.', error);
      showToast('Could not save. Check your browser storage settings.');
      return false;
    }
  }

  function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function dateFromString(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function isThisMonth(item) {
    const date = dateFromString(item.date);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }

  function total(items, type) {
    return items.reduce((sum, item) => sum + (item.type === type ? Number(item.amount) : 0), 0);
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function openModal() {
    backdrop.classList.add('open');
    dateInput.value = localDateString();
    setTimeout(() => $('#description').focus(), 0);
  }

  function closeModal() {
    backdrop.classList.remove('open');
    form.reset();
    dateInput.value = localDateString();
  }

  function makeCell(text, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function renderRows(target, items) {
    const body = $(target);
    body.replaceChildren();
    if (!items.length) {
      const row = document.createElement('tr');
      const cell = makeCell(target === '#recentRows' ? 'No transactions yet. Add one to get started.' : 'No transactions match your search.');
      cell.colSpan = 5;
      cell.className = 'empty-state';
      row.append(cell);
      body.append(row);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('tr');
      row.className = 'tr-row';
      const nameCell = document.createElement('td');
      const name = document.createElement('div');
      name.className = 'transaction-name';
      const icon = document.createElement('span');
      icon.className = `transaction-icon ${item.type}`;
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = icons[item.category] || icons.Other;
      const description = document.createElement('span');
      description.textContent = item.description;
      name.append(icon, description);
      nameCell.append(name);
      row.append(nameCell);
      row.append(makeCell(item.category || 'Other'));
      row.append(makeCell(fullDateFormatter.format(dateFromString(item.date))));
      row.append(makeCell(`${item.type === 'income' ? '+' : '−'}${money.format(Number(item.amount))}`, `amount ${item.type}`));

      const actionCell = document.createElement('td');
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'delete-button';
      deleteButton.textContent = '×';
      deleteButton.setAttribute('aria-label', `Delete ${item.description}`);
      deleteButton.addEventListener('click', () => {
        transactions = transactions.filter((entry) => entry.id !== item.id);
        saveTransactions();
        render();
        showToast('Transaction deleted');
      });
      actionCell.append(deleteButton);
      row.append(actionCell);
      body.append(row);
    });
  }

  function renderCategories(monthItems) {
    const expenses = monthItems.filter((item) => item.type === 'expense');
    const byCategory = new Map();
    expenses.forEach((item) => byCategory.set(item.category || 'Other', (byCategory.get(item.category || 'Other') || 0) + Number(item.amount)));
    const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    $('#categoryTotal').textContent = money.format(total(expenses, 'expense'));
    const list = $('#categoryList');
    list.replaceChildren();
    if (!sorted.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-copy';
      empty.textContent = 'Your spending categories will show up here.';
      list.append(empty);
      return;
    }
    const max = sorted[0][1] || 1;
    sorted.forEach(([category, amount]) => {
      const row = document.createElement('div');
      row.className = 'category-row';
      const name = document.createElement('span');
      name.textContent = category;
      const bar = document.createElement('span');
      bar.className = 'category-bar';
      const fill = document.createElement('i');
      fill.style.width = `${Math.max(3, (amount / max) * 100)}%`;
      bar.append(fill);
      const value = document.createElement('strong');
      value.textContent = money.format(amount);
      row.append(name, bar, value);
      list.append(row);
    });
  }

  function renderChart() {
    const canvas = $('#cashFlowChart');
    const context = canvas.getContext('2d');
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(100, bounds.width);
    const height = Math.max(100, bounds.height);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const today = new Date();
    const months = Array.from({ length: 6 }, (_, index) => new Date(today.getFullYear(), today.getMonth() - 5 + index, 1));
    const values = months.map((month) => {
      const inMonth = transactions.filter((item) => {
        const date = dateFromString(item.date);
        return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
      });
      return { income: total(inMonth, 'income'), expense: total(inMonth, 'expense') };
    });
    const maxValue = Math.max(1, ...values.flatMap((entry) => [entry.income, entry.expense]));
    const left = 7;
    const right = 7;
    const top = 14;
    const bottom = 25;
    const chartHeight = height - top - bottom;
    const groupWidth = (width - left - right) / months.length;
    const barWidth = Math.min(20, groupWidth * 0.26);
    const baseY = top + chartHeight;

    context.strokeStyle = '#edf0f3';
    context.lineWidth = 1;
    for (let line = 0; line < 4; line += 1) {
      const y = top + (chartHeight / 3) * line;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right, y);
      context.stroke();
    }

    values.forEach((entry, index) => {
      const center = left + groupWidth * index + groupWidth / 2;
      const incomeHeight = (entry.income / maxValue) * (chartHeight - 4);
      const expenseHeight = (entry.expense / maxValue) * (chartHeight - 4);
      context.fillStyle = '#159a72';
      context.beginPath();
      context.roundRect(center - barWidth - 2, baseY - incomeHeight, barWidth, Math.max(incomeHeight, 2), 4);
      context.fill();
      context.fillStyle = '#dce1e8';
      context.beginPath();
      context.roundRect(center + 2, baseY - expenseHeight, barWidth, Math.max(expenseHeight, 2), 4);
      context.fill();
      context.fillStyle = '#7b8491';
      context.font = '11px "DM Sans", sans-serif';
      context.textAlign = 'center';
      context.fillText(monthFormatter.format(months[index]), center, height - 5);
    });
  }

  function renderTransactionsView() {
    const query = $('#searchInput').value.trim().toLowerCase();
    const type = $('#filterType').value;
    const filtered = [...transactions].filter((item) => {
      const matchesQuery = `${item.description} ${item.category}`.toLowerCase().includes(query);
      return matchesQuery && (type === 'all' || item.type === type);
    }).sort((a, b) => b.date.localeCompare(a.date));
    renderRows('#allRows', filtered);
  }

  function render() {
    const monthItems = transactions.filter(isThisMonth);
    const income = total(monthItems, 'income');
    const expenses = total(monthItems, 'expense');
    const balance = total(transactions, 'income') - total(transactions, 'expense');
    $('#balance').textContent = money.format(balance);
    $('#totalIncome').textContent = money.format(income);
    $('#totalExpense').textContent = money.format(expenses);
    $('#incomeCount').textContent = `${monthItems.filter((item) => item.type === 'income').length} entries`;
    $('#expenseCount').textContent = `${monthItems.filter((item) => item.type === 'expense').length} entries`;
    $('#monthLabel').textContent = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date());
    $('#balanceChange').textContent = balance >= 0 ? 'On track' : 'Over budget';
    renderCategories(monthItems);
    const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    renderRows('#recentRows', sorted.slice(0, 5));
    renderTransactionsView();
    renderChart();
  }

  $('#openModal').addEventListener('click', openModal);
  $('#closeModal').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const amount = Number($('#amount').value);
    if (!Number.isFinite(amount) || amount <= 0) {
      $('#amount').setCustomValidity('Enter an amount greater than zero.');
      $('#amount').reportValidity();
      return;
    }
    $('#amount').setCustomValidity('');
    transactions.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      description: $('#description').value.trim(),
      amount,
      type: $('#type').value,
      category: $('#category').value,
      date: dateInput.value
    });
    if (saveTransactions()) {
      closeModal();
      render();
      showToast('Transaction added');
    }
  });
  $('#amount').addEventListener('input', () => $('#amount').setCustomValidity(''));
  $('#searchInput').addEventListener('input', renderTransactionsView);
  $('#filterType').addEventListener('change', renderTransactionsView);
  $('#viewAll').addEventListener('click', () => document.querySelector('[data-view="transactions"]').click());
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const isOverview = button.dataset.view === 'overview';
      document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
      $('#overviewView').classList.toggle('active', isOverview);
      $('#transactionsView').classList.toggle('active', !isOverview);
      $('#pageTitle').textContent = isOverview ? 'Overview' : 'Transactions';
    });
  });
  $('#resetData').addEventListener('click', () => {
    if (!transactions.length || !window.confirm('Delete all saved transactions? This cannot be undone.')) return;
    transactions = [];
    saveTransactions();
    render();
    showToast('All transactions cleared');
  });
  window.addEventListener('resize', renderChart);
  if ('ResizeObserver' in window) new ResizeObserver(renderChart).observe($('#cashFlowChart'));

  dateInput.value = localDateString();
  render();
})();
