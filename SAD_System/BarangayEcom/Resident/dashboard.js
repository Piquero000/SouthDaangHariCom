// Auth guard
let sessionUser = JSON.parse(localStorage.getItem('user'));
if (!sessionUser || sessionUser.role !== 'resident') {
  window.location.href = '../index.html';
}

// State
let complaints = JSON.parse(localStorage.getItem('complaints')) || [];
let currentView = 'taguig';
let profileEditing = false;

const categories = [
  "Road Maintenance","Street Lighting","Garbage Collection","Noise Complaint",
  "Public Safety","Water Supply","Drainage/Flooding","Other"
];

const barangays = [
  "Purok 3,Narra Street",
  "Purok 4,Mahogany Street",
  "Purok 5,Molave Street",
  "Purok 6B,Acacia Street",
  "Purok 6B,Sampaloc Street",
  "Purok 6B,Bamboo Street",
  "Purok 6C,Ipil Street",
  "Purok ^C, duhat street",
  "Purok 7,Yakal Street",
  "Purok 8,Kamias Street",
  "Purok 9,Guava Street",
  "Purok 10,Mango Street",
  "Purok 11,Lanzones Street",
  "Purok 12,Dalandan Street",
  "Purok 13,Barangay Hall (Block 1)"
];

// Helpers
function saveComplaints() {
  localStorage.setItem('complaints', JSON.stringify(complaints));
}
function fmt(dateStr) {
  return new Date(dateStr).toLocaleString();
}
function showToast(message, type='success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Anonymous preference helpers
function setAnonymousPref(value) {
  const isAnon = value === 'anonymous';
  localStorage.setItem('userAnonymous', isAnon ? 'true' : 'false');
  updateAnonymousButtons();
}

function updateAnonymousButtons() {
  const isAnon = localStorage.getItem('userAnonymous') === 'true';
  const publicLabel = document.getElementById('submitPublicLabel');
  const anonLabel = document.getElementById('submitAnonLabel');
  if (!publicLabel || !anonLabel) return;
  // toggle active class and checked state
  if (isAnon) {
    anonLabel.classList.add('active');
    publicLabel.classList.remove('active');
  } else {
    publicLabel.classList.add('active');
    anonLabel.classList.remove('active');
  }
  const anonRadio = document.querySelector('input[name="submitType"][value="anonymous"]');
  const publicRadio = document.querySelector('input[name="submitType"][value="public"]');
  if (anonRadio) anonRadio.checked = isAnon;
  if (publicRadio) publicRadio.checked = !isAnon;
}

// Actions
async function submitComplaint(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const submitType = fd.get('submitType') || 'public';
  const isAnonymous = submitType === 'anonymous';
  const newComplaint = {
    complaint_id: 'C-' + Date.now(),
    title: fd.get('title'),
    description: fd.get('description'),
    category: fd.get('category'),
    location: fd.get('location'),
    status: 'Pending',
    submitted_date: new Date().toISOString(),
    last_update: new Date().toISOString(),
    // always keep an internal link to the submitter so they can still see their own submissions
    submitter_username: sessionUser.username,
    // display name; if anonymous requested, show as 'Anonymous'
    submitter_name: isAnonymous ? 'Anonymous' : sessionUser.username,
    is_anonymous: isAnonymous
  };
  // optional media file (image/video)
  try {
    const fileInput = e.target.querySelector('input[name="media"]');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      try {
        const dataUrl = await readFileAsDataURL(file);
        newComplaint.media = dataUrl;
        newComplaint.media_type = file.type;
      } catch (err) {
        console.error('Media read error', err);
        showToast('Failed to read media file (ignored)', 'error');
      }
    }
  } catch (e) {
    // ignore if DOM access fails
  }
  complaints.push(newComplaint);
  saveComplaints();
  showToast('Complaint submitted successfully!');
  currentView = 'my';
  renderApp();
}

// Keep sessionUser in sync if admin updates verification status in another tab/window
window.addEventListener('storage', (e) => {
  if (!sessionUser) return;
  if (e.key === 'users' || e.key === 'verifyRequests') {
    try {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const updated = users.find(u => u.username === sessionUser.username);
      const oldStatus = sessionUser.verified_status || 'Unverified';
      let newStatus = oldStatus;
      if (updated && updated.verified_status) newStatus = updated.verified_status;

      // If verifyRequests was changed, prefer checking the request entry for message details
      const requests = JSON.parse(localStorage.getItem('verifyRequests') || '[]');
      const myReq = requests.find(r => r.username === sessionUser.username);

      if (newStatus !== oldStatus) {
        // update local sessionUser and localStorage so UI shows the new state
        sessionUser = Object.assign({}, sessionUser, updated || { verified_status: newStatus });
        localStorage.setItem('user', JSON.stringify(sessionUser));

        // notify the resident
        if (newStatus === 'Verified') {
          showToast('Your ID verification was approved', 'success');
        } else if (oldStatus === 'Pending' && newStatus === 'Unverified') {
          // likely a rejection
          // include reviewed reason/time if available
          if (myReq && myReq.status === 'Rejected') {
            showToast('Your ID verification was rejected', 'error');
          } else {
            showToast('Your verification status changed', 'error');
          }
        }

        try { renderApp(); } catch (err) { /* ignore if render not ready */ }

        // If request was rejected, navigate resident to Profile and offer to re-upload
        if (oldStatus === 'Pending' && newStatus === 'Unverified') {
          try {
            currentView = 'profile';
            renderApp();
            // small delay to ensure DOM is ready then prompt user to re-upload
            setTimeout(() => {
              const ask = confirm('Your ID was rejected. Would you like to re-upload a new ID now?');
              if (ask) {
                const input = document.getElementById('idFile');
                if (input) {
                  try { input.click(); } catch (e) { /* ignore if browser blocks programmatic click */ }
                }
              }
            }, 250);
          } catch (e) { /* ignore failures */ }
        }
      }
    } catch (err) { /* ignore JSON parse errors */ }
  }
});

// Views
function header() {
  return `
    <header class="gradient-bg shadow-md">
      <div class="max-w-7xl mx-auto px-4 py-6 flex items-center gap-4 justify-between">
        <div class="flex items-center gap-4">
          <div style="font-size: 40px;">🏛️</div>
          <div>
            <h1 class="text-white font-bold text-2xl">Taguig Barangay Complaints</h1>
            <p class="text-white opacity-80">Report and Track Community Issues</p>
          </div>
        </div>
        <div class="text-white">
          <span class="font-semibold">👤 ${sessionUser.username}</span>
          <button class="ml-4 bg-white/20 px-3 py-1 rounded" onclick="logout()">Logout</button>
        </div>
      </div>
    </header>
  `;
}
function nav() {
  const items = [
    { id:'taguig', label:'Taguig Complaints', icon:'🏘️' },
    { id:'submit', label:'Submit Complaint', icon:'📝' },
    { id:'my', label:'My Complaints', icon:'📋' },
    { id:'updates', label:'Updates', icon:'🔔' },
    { id:'profile', label:'Profile', icon:'👤' }
  ];
  return `
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-7xl mx-auto px-4 flex overflow-x-auto">
        ${items.map(i => `
          <button onclick="currentView='${i.id}'; renderApp();"
                  class="px-6 py-4 font-semibold ${currentView===i.id ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-700'}">
            <span class="mr-2">${i.icon}</span>${i.label}
          </button>
        `).join('')}
      </div>
    </nav>
  `;
}
function viewTaguig() {
  const sorted = [...complaints].sort((a,b)=> new Date(b.submitted_date)-new Date(a.submitted_date));
  if (sorted.length===0) {
    return `
      <div class="p-6">
        <div class="max-w-7xl mx-auto bg-white rounded-lg shadow p-10 text-center">
          <div class="text-6xl mb-4">📭</div>
          <p class="text-xl font-semibold">No complaints submitted yet</p>
          <p class="text-gray-500 mt-2">Be the first to report an issue in your community</p>
        </div>
      </div>
    `;
  }
  return `
    <div class="p-6">
      <div class="max-w-7xl mx-auto grid gap-6 md:grid-cols-2">
        ${sorted.map(c => `
          <div class="bg-white p-5 rounded-xl shadow complaint-card">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-bold text-lg">${c.title}</h3>
              <span class="text-xs font-semibold px-3 py-1 rounded-full ${
                c.status==='Resolved' ? 'bg-green-100 text-green-700'
                : c.status==='In Progress' ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
              }">${c.status}</span>
            </div>
            <p class="text-sm text-gray-700">${c.description}</p>
            ${c.media ? `
              <div class="mt-3">
                ${c.media_type && c.media_type.startsWith('image') ? `
                  <img src="${c.media}" alt="attachment" style="max-width:100%;border-radius:8px;display:block" />
                ` : c.media_type && c.media_type.startsWith('video') ? `
                  <video controls style="max-width:100%;border-radius:8px;display:block">
                    <source src="${c.media}" type="${c.media_type}">
                    Your browser does not support the video tag.
                  </video>
                ` : `<a href="${c.media}" target="_blank">View attachment</a>`}
              </div>
            ` : ''}
            
            <div class="text-xs text-gray-500 mt-2 flex gap-3 flex-wrap">
              <span>📂 ${c.category}</span><span>•</span><span>📍 ${c.location}</span>
            </div>
            <div class="border-t mt-3 pt-2 text-xs text-gray-500">
              <div class="font-semibold">Submitted by: ${c.is_anonymous ? 'Anonymous' : c.submitter_name}</div>
              <div>ID: ${c.complaint_id}</div>
              <div>Date: ${fmt(c.submitted_date)}</div>
            </div>
            ${c.responses && c.responses.length ? `
              <div class="mt-3">
                <div class="text-sm font-semibold">Responses</div>
                <div class="mt-2 space-y-2 text-sm">
                  ${c.responses.map(r=>`<div class="p-2 bg-green-50 rounded"><div class="text-xs text-green-700">${r.admin} • ${fmt(r.at)}</div><div class="mt-1">${r.message}</div></div>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
function viewSubmit() {
  const isAnonymous = localStorage.getItem('userAnonymous') === 'true';

return `
  <div class="p-6">
    <div class="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow">
      <div class="text-center mb-6">
        <div class="text-6xl mb-2">📝</div>
        <h2 class="text-2xl font-bold">Submit a Complaint</h2>
        <p class="text-gray-600">Help improve our community by reporting issues</p>
      </div>

      <form onsubmit="submitComplaint(event)" class="space-y-4">
        <div class="text-center mb-6">
         <label class="font-semibold block mb-3 text-left">Submission Type *</label>
         <div class="flex justify-center gap-6">
          <!-- Public Option -->
          <label class="cursor-pointer w-40">
            <input type="radio" name="submitType" value="public" class="peer hidden" checked />
            <div class="p-4 border rounded-xl text-center peer-checked:bg-blue-100 peer-checked:border-blue-500 transition hover:bg-blue-50">
              <div class="flex flex-col items-center">
              <div class="text-4xl mb-1">👤</div>
              <div class="text-sm font-semibold text-blue-700">Public</div>
              <p class="text-xs text-gray-600">Show my name</p>
            </div>
         </div>
        </label>

         <!-- Anonymous Option -->
         <label class="cursor-pointer w-40">
            <input type="radio" name="submitType" value="anonymous" class="peer hidden" />
             <div class="p-4 border rounded-xl text-center bg-gray-300 peer-checked:bg-gray-400 peer-checked:border-gray-700 transition hover:bg-gray-400">
              <div class="flex flex-col items-center">
              <div class="text-4xl mb-1">🙈</div>
              <div class="text-sm font-semibold text-gray-800">Anonymous</div>
              <p class="text-xs text-gray-700">Hide my name</p>
              </div>
             </div>
            </label>
          </div>
       </div>

        <div>
          <label class="font-semibold">Complaint Title *</label>
          <input type="text" name="title" required class="w-full mt-2 p-3 border rounded-lg" placeholder="Brief description of the issue"/>
        </div>

        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="font-semibold">Category *</label>
            <select name="category" required class="w-full mt-2 p-3 border rounded-lg">
              <option value="">Select category</option>
              ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="font-semibold">Street Location *</label>
            <select name="location" required class="w-full mt-2 p-3 border rounded-lg">
              <option value="">Select street location</option>
              ${barangays.map(b => `<option value="${b}">${b}</option>`).join('')}
            </select>
          </div>
        </div>

        <div>
          <label class="font-semibold">Detailed Description *</label>
          <textarea name="description" rows="6" required class="w-full mt-2 p-3 border rounded-lg"
                    placeholder="Provide a detailed description..."></textarea>
        </div>

        <div>
          <label class="font-semibold">Attachment (optional)</label>
          <input type="file" name="media" accept="image/*,video/*" class="w-full mt-2" />
        </div>

        <button type="submit" class="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition">
          Submit Complaint
        </button>
      </form>
    </div>
  </div>
`;
}
function viewMy() {
  const mine = complaints.filter(c => (c.submitter_username && c.submitter_username === sessionUser.username) || c.submitter_name === sessionUser.username);
  if (mine.length===0) {
    return `
      <div class="p-6">
        <div class="max-w-7xl mx-auto bg-white rounded-xl shadow p-10 text-center">
          <div class="text-6xl mb-4">📝</div>
          <p class="text-xl font-semibold">You haven't submitted any complaints yet</p>
          <p class="text-gray-600 mt-2">Report issues to help improve Taguig</p>
          <button class="mt-4 px-5 py-2 bg-red-600 text-white rounded-lg font-bold"
                  onclick="currentView='submit'; renderApp();">Submit Your First Complaint</button>
        </div>
      </div>
    `;
  }
  return `
    <div class="p-6">
      <div class="max-w-7xl mx-auto grid gap-6 md:grid-cols-2">
        ${mine.map(c => `
          <div class="bg-white p-5 rounded-xl shadow complaint-card">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-bold text-lg">${c.title}</h3>
              <span class="text-xs font-semibold px-3 py-1 rounded-full ${
                c.status==='Resolved' ? 'bg-green-100 text-green-700'
                : c.status==='In Progress' ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
              }">${c.status}</span>
            </div>
            <p class="text-sm text-gray-700">${c.description}</p>
            ${c.media ? `
              <div class="mt-3">
                ${c.media_type && c.media_type.startsWith('image') ? `
                  <img src="${c.media}" alt="attachment" style="max-width:100%;border-radius:8px;display:block" />
                ` : c.media_type && c.media_type.startsWith('video') ? `
                  <video controls style="max-width:100%;border-radius:8px;display:block">
                    <source src="${c.media}" type="${c.media_type}">
                    Your browser does not support the video tag.
                  </video>
                ` : `<a href="${c.media}" target="_blank">View attachment</a>`}
              </div>
            ` : ''}
            <div class="text-xs text-gray-500 mt-2 flex gap-3 flex-wrap">
              <span>📂 ${c.category}</span><span>•</span><span>📍 ${c.location}</span>
            </div>
            <div class="border-t mt-3 pt-2 text-xs text-gray-500">
              <div>ID: ${c.complaint_id}</div>
              <div>Submitted: ${fmt(c.submitted_date)}</div>
              <div>Last Update: ${fmt(c.last_update)}</div>
            </div>
            ${c.responses && c.responses.length ? `
              <div class="mt-3">
                <div class="text-sm font-semibold">Admin Response:</div>
                <div class="mt-2 space-y-2 text-sm">
                  ${c.responses.map(r=>`<div class="p-2 bg-green-50 rounded"><div class="text-xs text-green-700">${r.admin} • ${fmt(r.at)}</div><div class="mt-1">${r.message}</div></div>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
function viewUpdates() {
  const recent = [...complaints].sort((a,b)=> new Date(b.last_update)-new Date(a.last_update)).slice(0,15);
  if (recent.length===0) {
    return `
      <div class="p-6">
        <div class="max-w-7xl mx-auto bg-white rounded-xl shadow p-10 text-center">
          <div class="text-6xl mb-4">🔔</div>
          <p class="text-xl font-semibold">No updates available yet</p>
          <p class="text-gray-600 mt-2">Check back later for status updates</p>
        </div>
      </div>
    `;
  }
  return `
    <div class="p-6">
      <div class="max-w-5xl mx-auto flex flex-col gap-4">
        ${recent.map(c => `
          <div class="bg-white p-4 rounded-lg shadow border-l-4 ${
            c.status==='Resolved' ? 'border-green-500'
            : c.status==='In Progress' ? 'border-blue-500' : 'border-yellow-500'
          }">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h3 class="font-bold text-lg">${c.title}</h3>
                <p class="text-sm text-gray-600">${c.description}</p>
                ${c.media ? `
                  <div class="mt-3">
                    ${c.media_type && c.media_type.startsWith('image') ? `
                      <img src="${c.media}" alt="attachment" style="max-width:100%;border-radius:8px;display:block" />
                    ` : c.media_type && c.media_type.startsWith('video') ? `
                      <video controls style="max-width:100%;border-radius:8px;display:block">
                        <source src="${c.media}" type="${c.media_type}">
                        Your browser does not support the video tag.
                      </video>
                    ` : `<a href="${c.media}" target="_blank">View attachment</a>`}
                  </div>
                ` : ''}
                <div class="text-xs text-gray-500 mt-1">
                  📍 ${c.location} • 📂 ${c.category} • 👤 ${c.is_anonymous ? 'Anonymous' : c.submitter_name}
                </div>
              </div>
              <span class="text-xs font-semibold px-3 py-1 rounded-full ${
                c.status==='Resolved' ? 'bg-green-100 text-green-700'
                : c.status==='In Progress' ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
              }">${c.status}</span>
            </div>
            <div class="text-xs text-gray-400 font-medium">
              Last updated: ${fmt(c.last_update)}
            </div>
            ${c.responses && c.responses.length ? `
              <div class="mt-3">
                <div class="text-sm font-semibold">Admin Responses</div>
                <div class="mt-2 space-y-2 text-sm">
                  ${c.responses.map(r=>`<div class="p-2 bg-green-50 rounded"><div class="text-xs text-green-700">${r.admin} • ${fmt(r.at)}</div><div class="mt-1">${r.message}</div></div>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
function viewProfile() {
  const name = localStorage.getItem('userName') || sessionUser.username;
  const email = localStorage.getItem('userEmail') || sessionUser.email || '';
  const phone = localStorage.getItem('userPhone') || '';
  const barangay = localStorage.getItem('userBarangay') || '';
  const verifiedStatus = (sessionUser && sessionUser.verified_status) ? sessionUser.verified_status : 'Unverified';
  const idPreview = (sessionUser && sessionUser.id_image) ? sessionUser.id_image : '';
  // fetch notifications for this user
  const notifications = JSON.parse(localStorage.getItem('notifications') || '[]').filter(n => n.username === sessionUser.username).sort((a,b)=>new Date(b.at)-new Date(a.at));
  // mark notifications as read when rendering profile
  try {
    if (notifications && notifications.length>0) {
      const allNotes = JSON.parse(localStorage.getItem('notifications') || '[]');
      let changed = false;
      allNotes.forEach(n => { if (n.username === sessionUser.username && !n.read) { n.read = true; changed = true; } });
      if (changed) localStorage.setItem('notifications', JSON.stringify(allNotes));
    }
  } catch (e) { /* ignore */ }

  const summary = `
    <div class="mb-4">
      <table class="w-full text-sm">
        <tr><td class="font-semibold w-36">Full Name</td><td>${name}</td></tr>
        <tr><td class="font-semibold w-36">Email</td><td>${email || '<span class="text-gray-400">(not set)</span>'}</td></tr>
        <tr><td class="font-semibold w-36">Phone</td><td>${phone || '<span class="text-gray-400">(not set)</span>'}</td></tr>
          <tr><td class="font-semibold w-36">Street Location</td><td>${barangay || '<span class="text-gray-400">(not set)</span>'}</td></tr>
        <tr><td class="font-semibold w-36">Verification</td><td>${verifiedStatus}</td></tr>
      </table>
    </div>
  `;

  // edit form (reuse existing form markup)
  const editForm = `
    <form id="profileForm" onsubmit="event.preventDefault(); saveProfile();">
      <div class="mb-4">
        <label class="font-semibold">Full Name *</label>
        <input type="text" name="name" required value="${name}" class="w-full mt-2 p-3 border rounded-lg"/>
      </div>
      <div class="mb-4">
        <label class="font-semibold">Email Address</label>
        <input type="email" name="email" value="${email}" class="w-full mt-2 p-3 border rounded-lg"/>
      </div>
      <div class="mb-4">
        <label class="font-semibold">Phone Number</label>
        <input type="tel" name="phone" value="${phone}" class="w-full mt-2 p-3 border rounded-lg"
               maxlength="11" inputmode="numeric" pattern="\\d{11}"
               oninput="this.value = this.value.replace(/\D/g,'').slice(0,11)" />
      </div>
      <div class="mb-6">
        <label class="font-semibold">Street Location</label>
        <select name="barangay" class="w-full mt-2 p-3 border rounded-lg">
          <option value="">Select your street</option>
          ${barangays.map(b => `<option value="${b}" ${barangay===b ? 'selected' : ''}>${b}</option>`).join('')}
        </select>
      </div>
      <div class="flex gap-3">
        <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-lg">Save Profile</button>
        <button type="button" onclick="cancelProfileEdit()" class="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
      </div>
    </form>
  `;

  return `
    <div class="p-6">
      <div class="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center text-2xl">👤</div>
            <div>
              <h2 class="text-2xl font-bold">Profile</h2>
              <p class="text-gray-600">View and edit your account information</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
              <span class="verification-badge">${verifiedStatus === 'Verified' ? '✅ Verified' : verifiedStatus === 'Pending' ? '⏳ Pending Verification' : '⚠ Unverified'}</span>
              <div class="ml-3 text-sm">
                ${notifications && notifications.filter(n=>!n.read).length > 0 ? `<span class="px-2 py-1 bg-red-100 text-red-700 rounded">${notifications.filter(n=>!n.read).length} new</span>` : ''}
              </div>
            ${profileEditing ? '' : `<button class="ml-4 btn-primary" onclick="startProfileEdit()">Edit Profile</button>`}
          </div>
        </div>

        ${profileEditing ? editForm : summary}

        <div class="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 class="font-semibold mb-2">Account Verification</h3>
          <p class="muted mb-3">Verify your account using a government-issued ID. This helps the barangay confirm your identity.</p>
          <div id="verifySection">
            <div class="mb-3">
              <strong>Status:</strong> <span id="verifyStatus">${verifiedStatus}</span>
            </div>
            ${idPreview ? `
              <div class="mb-3">
                <strong>Uploaded ID Preview:</strong>
                <div class="mt-2"><img src="${idPreview}" alt="ID preview" style="max-width:220px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.08)"/></div>
              </div>
            ` : ''}
            <form id="verifyForm" onsubmit="requestVerification(event)">
              <div class="mb-3">
                <label class="font-semibold">ID Type</label>
                <select id="idType" required class="w-full mt-2 p-3 border rounded-lg">
                  <option value="">Select ID type</option>
                  <option value="Driver's License">Driver's License</option>
                  <option value="Passport">Passport</option>
                  <option value="UMID">UMID</option>
                  <option value="SSS/GSIS/PHILHEALTH">SSS/GSIS/PHILHEALTH</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="font-semibold">Upload ID (image/pdf)</label>
                <input id="idFile" type="file" accept="image/*,application/pdf" class="w-full mt-2" required />
              </div>
              <div class="flex gap-3">
                <button type="submit" class="btn-primary">Request Verification</button>
                <button type="button" onclick="cancelVerification()" class="px-4 py-2 bg-gray-200 rounded">Cancel/Remove</button>
              </div>
            </form>
          </div>
        </div>
        ${notifications && notifications.length ? `
          <div class="mt-4 p-4 border rounded-lg bg-white">
            <h3 class="font-semibold mb-2">Notifications</h3>
            <div class="space-y-2 text-sm">
              ${notifications.map(n=>`<div class="p-2 ${n.type==='error' ? 'bg-red-50' : 'bg-green-50'} rounded"><div class="text-xs text-gray-500">${fmt(n.at)}</div><div class="mt-1">${n.message}</div></div>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Read file as Data URL helper
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Request verification handler: saves request and sets user status to Pending
async function requestVerification(e) {
  e.preventDefault();
  const fileInput = document.getElementById('idFile');
  const idType = document.getElementById('idType').value;
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Please select an ID file to upload', 'error');
    return;
  }
  const file = fileInput.files[0];
  try {
    const dataUrl = await readFileAsDataURL(file);
    // update sessionUser object and localStorage
    sessionUser.verified_status = 'Pending';
    sessionUser.id_image = dataUrl;
    sessionUser.id_type = idType;
    localStorage.setItem('user', JSON.stringify(sessionUser));

    // save/replace a verification request list entry for admin to review
    let requests = JSON.parse(localStorage.getItem('verifyRequests') || '[]');
    // remove any existing request for this username so admin sees the latest upload
    requests = requests.filter(r => r.username !== sessionUser.username);
    requests.push({ username: sessionUser.username, id_type: idType, id_image: dataUrl, status: 'Pending', requested_at: new Date().toISOString() });
    localStorage.setItem('verifyRequests', JSON.stringify(requests));

    // also update the canonical users list so admin-side reads current id and status
    try {
      const users = JSON.parse(localStorage.getItem('users') || '[]');
      const u = users.find(x => x.username === sessionUser.username);
      if (u) {
        u.verified_status = 'Pending';
        u.id_image = dataUrl;
        u.id_type = idType;
        localStorage.setItem('users', JSON.stringify(users));
      }
    } catch (err) {
      // ignore if users storage not present
    }

    showToast('Verification requested — status: Pending');
    renderApp();
  } catch (err) {
    console.error(err);
    showToast('Failed to read uploaded file', 'error');
  }
}

function cancelVerification() {
  // remove any id image and set status to Unverified
  if (sessionUser) {
    delete sessionUser.id_image;
    delete sessionUser.id_type;
    sessionUser.verified_status = 'Unverified';
    localStorage.setItem('user', JSON.stringify(sessionUser));
    // also clear pending requests for this user
    const requests = JSON.parse(localStorage.getItem('verifyRequests') || '[]').filter(r => r.username !== sessionUser.username);
    localStorage.setItem('verifyRequests', JSON.stringify(requests));
    showToast('Verification cancelled/removed');
    renderApp();
  }
}
function saveProfile() {
  const form = document.getElementById('profileForm');
  const fd = new FormData(form);
  const rawPhone = (fd.get('phone') || '') + '';
  const phoneDigits = rawPhone.replace(/\D/g, '');
  // enforce exactly 11 digits
  if (phoneDigits.length !== 11) {
    showToast('Phone number must be exactly 11 digits and contain only numbers', 'error');
    return;
  }
  localStorage.setItem('userName', fd.get('name'));
  localStorage.setItem('userEmail', fd.get('email'));
  localStorage.setItem('userPhone', phoneDigits);
  localStorage.setItem('userBarangay', fd.get('barangay'));
  // update session user object so other parts of the app reflect changes
  if (sessionUser) {
    try {
      sessionUser.email = fd.get('email');
      sessionUser.phone = phoneDigits;
      sessionUser.barangay = fd.get('barangay');
      // do not overwrite username here; keep it as the login id
      localStorage.setItem('user', JSON.stringify(sessionUser));
    } catch (e) { /* ignore if session write fails */ }
  }
  profileEditing = false;
  showToast('Profile updated successfully!');
  renderApp();
}

function startProfileEdit() {
  profileEditing = true;
  renderApp();
}

function cancelProfileEdit() {
  profileEditing = false;
  renderApp();
}
function logout() {
  localStorage.removeItem('user');
  window.location.href = '../index.html';
}

// App
function content() {
  switch (currentView) {
    case 'taguig': return viewTaguig();
    case 'submit': return viewSubmit();
    case 'my': return viewMy();
    case 'updates': return viewUpdates();
    case 'profile': return viewProfile();
    default: return viewTaguig();
  }
}
function renderApp() {
  const app = document.getElementById('app');
  app.innerHTML = `${header()}${nav()}${content()}`;
  // refresh anonymous button styling/state after rendering
  try { updateAnonymousButtons(); } catch(e) { /* ignore if not present */ }
}
renderApp();
