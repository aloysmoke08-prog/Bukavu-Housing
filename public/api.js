// Ingrédient indispensable : Charger SweetAlert2 si pas encore présent
if (!window.Swal) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
  document.head.appendChild(script);
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css';
  document.head.appendChild(link);
}

const API_URL = window.location.origin + '/api';

function setToken(t) { localStorage.setItem('token', t); }
function getToken() { return localStorage.getItem('token'); }
function removeToken() { localStorage.removeItem('token'); }
function setUser(u) { localStorage.setItem('user', JSON.stringify(u)); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}
function removeUser() { localStorage.removeItem('user'); }

async function apiRequest(method, path, body = null, isFormData = false) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  // CSRF token basique encodé en Base64 avec timestamp
  headers['x-csrf-token'] = btoa(JSON.stringify({ ts: Date.now() }));

  const options = { method, headers };
  if (body) options.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(API_URL + path, options);
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

const Auth = {
  async register(nom, email, password, whatsapp, email_contact = '', telephone2 = '') {
    const data = await apiRequest('POST', '/auth/register', { nom, email, password, whatsapp, email_contact, telephone2 });
    setToken(data.token); setUser(data.user);
    return data;
  },
  async login(email, password) {
    const data = await apiRequest('POST', '/auth/login', { email, password });
    setToken(data.token); setUser(data.user);
    return data;
  },
  async loginGoogle(idToken) {
    const data = await apiRequest('POST', '/auth/google', { idToken });
    setToken(data.token); setUser(data.user);
    return data;
  },
  async me() {
    return apiRequest('GET', '/auth/me');
  },
  async forgotPassword(email) {
    return apiRequest('POST', '/auth/forgot-password', { email });
  },
  async resetPassword(token, newPassword) {
    return apiRequest('POST', '/auth/reset-password', { token, newPassword });
  },
  logout() {
    removeToken(); removeUser();
    window.location.href = 'auth.html';
  },
  isLoggedIn() { return !!getToken(); },
  currentUser() { return getUser(); },
  requireAuth() {
    if (!this.isLoggedIn()) { window.location.href = 'auth.html'; }
  },
};

const Logements = {
  async lister(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return apiRequest('GET', `/logements${qs ? '?' + qs : ''}`);
  },
  async detail(id) {
    return apiRequest('GET', `/logements/${id}`);
  },
  async publier(formData) {
    return apiRequest('POST', '/logements', formData, true);
  },
  async modifier(id, data) {
    return apiRequest('PUT', `/logements/${id}`, data);
  },
  async supprimer(id) {
    return apiRequest('DELETE', `/logements/${id}`);
  },
  async incrementerVue(id) {
    return apiRequest('POST', `/logements/${id}/vue`);
  },
  async similaires(id) {
    return apiRequest('GET', `/logements/${id}/similaires`);
  },
  async signaler(id, raison) {
    return apiRequest('POST', `/logements/${id}/signaler`, { raison });
  },
  async stats() {
    return apiRequest('GET', '/stats');
  }
};

const Users = {
  async profil() {
    return apiRequest('GET', '/users/profil');
  },
  async mettreAJour(data) {
    return apiRequest('PUT', '/users/profil', data);
  },
  async changerAvatar(formData) {
    return apiRequest('PUT', '/users/avatar', formData, true);
  },
  async changerMotDePasse(ancienPassword, nouveauPassword) {
    return apiRequest('PUT', '/users/password', { ancienPassword, nouveauPassword });
  },
  async supprimerCompte() {
    return apiRequest('DELETE', '/users/compte');
  },
  async toggleFavori(logementId) {
    return apiRequest('POST', `/users/favoris/${logementId}`);
  },
  async isFavori(logementId) {
    return apiRequest('GET', `/users/favoris/${logementId}`);
  },
  async mesAnnonces() {
    return apiRequest('GET', '/users/annonces');
  },
  async messages() {
    return apiRequest('GET', '/users/messages');
  },
  async envoyerMessage(destinataire_id, logement_id, contenu) {
    return apiRequest('POST', '/users/messages', { destinataire_id, logement_id, contenu });
  },
  async marquerMessagesLus(expediteur_id, logement_id) {
    return apiRequest('PUT', '/users/messages/lire', { expediteur_id, logement_id });
  }
};
