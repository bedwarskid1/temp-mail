// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let currentEmail = null;
let currentToken = null;
let expiryTime = null;
let countdownInterval = null;
let refreshInterval = null;

// DOM Elements
const generateBtn = document.getElementById('generateBtn');
const emailInput = document.getElementById('emailInput');
const copyBtn = document.getElementById('copyBtn');
const deleteBtn = document.getElementById('deleteBtn');
const emailDisplay = document.getElementById('emailDisplay');
const inboxSection = document.getElementById('inboxSection');
const messagesList = document.getElementById('messagesList');
const messageCountSpan = document.getElementById('messageCount');
const countdownSpan = document.getElementById('countdown');
const toast = document.getElementById('toast');

// Event Listeners
generateBtn.addEventListener('click', generateEmail);
copyBtn.addEventListener('click', copyToClipboard);
deleteBtn.addEventListener('click', deleteAccount);

// Functions

/**
 * Generate a new temporary email
 */
async function generateEmail() {
  try {
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ Generating...';

    const response = await fetch(`${API_BASE_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'temp.mail' }),
    });

    if (!response.ok) throw new Error('Failed to generate email');

    const data = await response.json();
    currentEmail = data.email;
    currentToken = data.token;
    expiryTime = Date.now() + data.expiresIn * 1000;

    // Show email display
    emailDisplay.classList.remove('hidden');
    inboxSection.classList.remove('hidden');
    emailInput.value = currentEmail;

    // Start countdown and refresh
    startCountdown();
    refreshMessages();
    startRefreshInterval();

    showToast(`✅ Email created: ${currentEmail}`);
  } catch (error) {
    console.error('Error:', error);
    showToast('❌ Failed to generate email', 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = '🔄 Generate New Email';
  }
}

/**
 * Copy email to clipboard
 */
async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(currentEmail);
    showToast('✅ Email copied to clipboard!');
    
    // Change button text temporarily
    const originalText = copyBtn.textContent;
    copyBtn.textContent = '✅ Copied!';
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error('Error:', error);
    showToast('❌ Failed to copy', 'error');
  }
}

/**
 * Delete the current account
 */
async function deleteAccount() {
  if (!confirm('Are you sure? This cannot be undone.')) return;

  try {
    const response = await fetch(`${API_BASE_URL}/accounts`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) throw new Error('Failed to delete account');

    // Reset UI
    emailDisplay.classList.add('hidden');
    inboxSection.classList.add('hidden');
    messagesList.innerHTML = '<p class="empty-state">No messages yet. Waiting for emails...</p>';
    currentEmail = null;
    currentToken = null;

    // Clear intervals
    clearInterval(countdownInterval);
    clearInterval(refreshInterval);

    showToast('✅ Account deleted successfully');
  } catch (error) {
    console.error('Error:', error);
    showToast('❌ Failed to delete account', 'error');
  }
}

/**
 * Refresh messages from server
 */
async function refreshMessages() {
  if (!currentToken) return;

  try {
    const response = await fetch(`${API_BASE_URL}/messages`, {
      headers: {
        'Authorization': `Bearer ${currentToken}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch messages');

    const data = await response.json();
    const messages = data.messages || [];

    updateMessagesList(messages);
    messageCountSpan.textContent = messages.length;
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}

/**
 * Update the messages list UI
 */
function updateMessagesList(messages) {
  if (messages.length === 0) {
    messagesList.innerHTML = '<p class="empty-state">📭 No messages yet. Waiting for emails...</p>';
    return;
  }

  messagesList.innerHTML = messages
    .map((msg) => `
      <div class="message-item">
        <div class="message-header">
          <div class="message-from">${escapeHtml(msg.from_email)}</div>
          <div class="message-time">${formatTime(msg.received_at)}</div>
        </div>
        <div class="message-subject">${escapeHtml(msg.subject || '(No Subject)')}</div>
        <div class="message-preview">${escapeHtml(msg.text ? msg.text.substring(0, 100) : '(No preview)')}</div>
      </div>
    `)
    .join('');
}

/**
 * Start countdown timer
 */
function startCountdown() {
  clearInterval(countdownInterval);
  
  const updateCountdown = () => {
    const now = Date.now();
    const remaining = expiryTime - now;

    if (remaining <= 0) {
      countdownSpan.textContent = '00:00:00';
      clearInterval(countdownInterval);
      showToast('⏰ Email expired', 'error');
      return;
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    countdownSpan.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Start auto-refresh for messages
 */
function startRefreshInterval() {
  clearInterval(refreshInterval);
  refreshInterval = setInterval(refreshMessages, 5000); // Refresh every 5 seconds
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast show`;
  
  if (type === 'error') {
    toast.style.background = '#ef4444';
  } else {
    toast.style.background = '#10b981';
  }

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
