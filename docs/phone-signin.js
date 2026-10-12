const phoneApi = (window.APP_CONFIG?.API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const phoneForm = document.getElementById('phoneForm');
const phoneMessage = document.getElementById('phoneMessage');
let requestingAccess = false;
const nameField = document.getElementById('requestNameField');
const nameInput = document.getElementById('customerName');
const modeToggle = document.getElementById('accessModeToggle');
modeToggle.addEventListener('click', () => {
  requestingAccess = !requestingAccess;
  nameField.hidden = !requestingAccess;
  nameInput.required = requestingAccess;
  nameInput.disabled = !requestingAccess;
  document.getElementById('requestConsent').hidden = !requestingAccess;
  document.getElementById('phoneSubmit').textContent = requestingAccess ? 'Request access' : 'Enter shop';
  modeToggle.textContent = requestingAccess ? 'Already approved? Sign in' : 'New customer? Request access';
  modeToggle.setAttribute('aria-expanded', String(requestingAccess));
  phoneMessage.textContent = '';
});
nameInput.disabled = true;
phoneForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const requestAccess = requestingAccess;
  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  if (requestAccess && !name) { phoneMessage.textContent = 'Please enter your name to request access.'; return; }
  const buttons = phoneForm.querySelectorAll('button');
  buttons.forEach(button => { button.disabled = true; });
  phoneMessage.textContent = requestAccess ? 'Submitting request...' : 'Checking access...';
  try {
    const response = await fetch(`${phoneApi}/api/access/${requestAccess ? 'request' : 'login'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestAccess ? { name, phone } : { phone }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Please try again.');
    if (requestAccess) phoneMessage.textContent = result.message;
    else {
      localStorage.setItem(window.ShopSession.key, JSON.stringify(result));
      window.location.replace('./index.html');
    }
  } catch (error) { phoneMessage.textContent = error.message; }
  finally { buttons.forEach(button => { button.disabled = false; }); }
});
