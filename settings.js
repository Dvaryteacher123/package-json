// ============================================
// DVARY GAMES - ADMIN PANEL LOGIC
// ============================================

// ============================================
// IMPORT FIREBASE SDKs
// ============================================
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc,
    query, 
    where, 
    orderBy, 
    limit,
    serverTimestamp
} from "firebase/firestore";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject
} from "firebase/storage";

// ============================================
// FIREBASE CONFIGURATION
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyCmwASW4XXQ3O0AvsCM_r1WLlrUmGjYVxI",
    authDomain: "dvary-9a7d0.firebaseapp.com",
    projectId: "dvary-9a7d0",
    storageBucket: "dvary-9a7d0.firebasestorage.app",
    messagingSenderId: "107370806066",
    appId: "1:107370806066:web:4c2ce1e6f7b6c32909f52b",
    measurementId: "G-07361LFJEP"
};

// ============================================
// INITIALIZE FIREBASE
// ============================================
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log('🔥 Firebase Admin initialized!');

// ============================================
// DOM ELEMENTS
// ============================================
const stats = {
    totalUsers: document.getElementById('totalUsers'),
    totalGames: document.getElementById('totalGames'),
    vipGames: document.getElementById('vipGames'),
    freeGames: document.getElementById('freeGames'),
    featuredGames: document.getElementById('featuredGames'),
    trendingGames: document.getElementById('trendingGames'),
    totalChats: document.getElementById('totalChats'),
    newUsers: document.getElementById('newUsers')
};

const gamesList = document.getElementById('gamesList');
const usersList = document.getElementById('usersList');
const notificationsList = document.getElementById('notificationsList');
const reportsList = document.getElementById('reportsList');

// ============================================
// STATE
// ============================================
let currentUser = null;
let isAdmin = false;
let allGames = [];
let allUsers = [];
let allNotifications = [];
let allReports = [];

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(ts) {
    if (!ts) return 'N/A';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================
// LOAD STATS
// ============================================
async function loadStats() {
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        stats.totalUsers.textContent = usersSnap.size;
        
        const gamesSnap = await getDocs(collection(db, 'games'));
        const total = gamesSnap.size;
        stats.totalGames.textContent = total;
        
        const vipSnap = await getDocs(query(collection(db, 'games'), where('isVip', '==', true)));
        const vipCount = vipSnap.size;
        stats.vipGames.textContent = vipCount;
        stats.freeGames.textContent = total - vipCount;
        
        const featuredSnap = await getDocs(query(collection(db, 'games'), where('isFeatured', '==', true)));
        stats.featuredGames.textContent = featuredSnap.size;
        
        const trendingSnap = await getDocs(query(collection(db, 'games'), where('isTrending', '==', true)));
        stats.trendingGames.textContent = trendingSnap.size;
        
        const chatsSnap = await getDocs(collection(db, 'chats'));
        stats.totalChats.textContent = chatsSnap.size;
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const newUsersSnap = await getDocs(query(collection(db, 'users'), where('createdAt', '>=', sevenDaysAgo)));
        stats.newUsers.textContent = newUsersSnap.size;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================
// LOAD GAMES
// ============================================
async function loadGames() {
    try {
        const snap = await getDocs(collection(db, 'games'));
        allGames = [];
        snap.forEach(doc => allGames.push({ id: doc.id, ...doc.data() }));
        
        if (!gamesList) return;
        if (allGames.length === 0) {
            gamesList.innerHTML = `<div class="empty-state"><i class="fas fa-gamepad"></i><p>No games found</p></div>`;
            return;
        }
        
        gamesList.innerHTML = allGames.map(g => `
            <div class="admin-game-item" data-id="${g.id}">
                <div class="game-info">
                    <img src="${g.coverImage || 'https://placehold.co/60x60/1a1a2e/6C3CE1?text=G'}" alt="${g.gameName}" />
                    <div>
                        <h4>${g.gameName}</h4>
                        <p>${g.category || 'Uncategorized'} • ${g.version || '1.0.0'}</p>
                        <div class="game-badges">
                            ${g.isVip ? '<span class="badge vip">VIP</span>' : '<span class="badge free">Free</span>'}
                            ${g.isFeatured ? '<span class="badge featured">Featured</span>' : ''}
                            ${g.isTrending ? '<span class="badge trending">Trending</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="game-actions">
                    <button class="btn-icon edit-game" data-id="${g.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-game" data-id="${g.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `).join('');
        
        // Event listeners for edit/delete
        gamesList.querySelectorAll('.delete-game').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm('Delete this game?')) {
                    await deleteDoc(doc(db, 'games', id));
                    showToast('Game deleted', 'success');
                    loadGames();
                    loadStats();
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading games:', error);
        showToast('Failed to load games', 'error');
    }
}

// ============================================
// LOAD USERS
// ============================================
async function loadUsers() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        allUsers = [];
        snap.forEach(doc => allUsers.push({ uid: doc.id, ...doc.data() }));
        
        if (!usersList) return;
        if (allUsers.length === 0) {
            usersList.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>No users found</p></div>`;
            return;
        }
        
        usersList.innerHTML = allUsers.map(u => `
            <div class="admin-user-item">
                <div class="user-info">
                    <img src="${u.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.fullName || u.username) + '&background=6C3CE1&color=fff'}" alt="${u.fullName}" />
                    <div>
                        <h4>${u.fullName || u.username}</h4>
                        <p>@${u.username} • ${u.email}</p>
                        <div class="user-badges">
                            ${u.isAdmin ? '<span class="badge admin">Admin</span>' : ''}
                            ${u.isBlocked ? '<span class="badge blocked">Blocked</span>' : '<span class="badge active">Active</span>'}
                        </div>
                    </div>
                </div>
                <div class="user-actions">
                    ${!u.isAdmin ? `
                        ${u.isBlocked ? 
                            `<button class="btn-icon unblock-user" data-uid="${u.uid}"><i class="fas fa-user-check"></i></button>` :
                            `<button class="btn-icon block-user" data-uid="${u.uid}"><i class="fas fa-user-slash"></i></button>`
                        }
                    ` : '<span class="admin-protected">Protected</span>'}
                </div>
            </div>
        `).join('');
        
        usersList.querySelectorAll('.block-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const uid = btn.dataset.uid;
                if (confirm('Block this user?')) {
                    await updateDoc(doc(db, 'users', uid), { isBlocked: true });
                    showToast('User blocked', 'success');
                    loadUsers();
                    loadStats();
                }
            });
        });
        
        usersList.querySelectorAll('.unblock-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const uid = btn.dataset.uid;
                await updateDoc(doc(db, 'users', uid), { isBlocked: false });
                showToast('User unblocked', 'success');
                loadUsers();
                loadStats();
            });
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
    }
}

// ============================================
// LOAD NOTIFICATIONS
// ============================================
async function loadNotifications() {
    try {
        const snap = await getDocs(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50)));
        allNotifications = [];
        snap.forEach(doc => allNotifications.push({ id: doc.id, ...doc.data() }));
        
        if (!notificationsList) return;
        if (allNotifications.length === 0) {
            notificationsList.innerHTML = `<div class="empty-state"><i class="fas fa-bell"></i><p>No notifications</p></div>`;
            return;
        }
        
        notificationsList.innerHTML = allNotifications.map(n => `
            <div class="admin-notification-item">
                <div class="notif-info">
                    <h4>${n.title}</h4>
                    <p>${n.message}</p>
                    <span class="notif-meta">To: ${n.userId === 'all' ? 'All Users' : 'Specific'} • ${formatDate(n.createdAt)}</span>
                </div>
                <div class="notif-actions">
                    <button class="btn-icon delete-notif" data-id="${n.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `).join('');
        
        notificationsList.querySelectorAll('.delete-notif').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (confirm('Delete this notification?')) {
                    await deleteDoc(doc(db, 'notifications', id));
                    showToast('Notification deleted', 'success');
                    loadNotifications();
                }
            });
        });
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// ============================================
// LOAD REPORTS
// ============================================
async function loadReports() {
    try {
        const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc')));
        allReports = [];
        snap.forEach(doc => allReports.push({ id: doc.id, ...doc.data() }));
        
        if (!reportsList) return;
        if (allReports.length === 0) {
            reportsList.innerHTML = `<div class="empty-state"><i class="fas fa-flag"></i><p>No reports</p></div>`;
            return;
        }
        
        reportsList.innerHTML = allReports.map(r => `
            <div class="admin-report-item">
                <div class="report-info">
                    <h4>Report #${r.id.slice(0, 8)}</h4>
                    <p>${r.reason || 'No reason'}</p>
                    <span class="report-status ${r.resolved ? 'resolved' : 'pending'}">${r.resolved ? 'Resolved' : 'Pending'}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

// ============================================
// TAB SWITCHING
// ============================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        
        if (btn.dataset.tab === 'games') loadGames();
        if (btn.dataset.tab === 'users') loadUsers();
        if (btn.dataset.tab === 'notifications') loadNotifications();
        if (btn.dataset.tab === 'moderation') loadReports();
    });
});

// ============================================
// LOGOUT
// ============================================
document.querySelectorAll('#adminLogout, #mobileAdminLogout').forEach(el => {
    if (el) {
        el.addEventListener('click', async () => {
            await signOut(auth);
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }
});

// ============================================
// AUTH STATE
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.isAdmin) {
                isAdmin = true;
                console.log('👑 Admin authenticated:', user.email);
                await loadStats();
                await loadGames();
                await loadUsers();
                await loadNotifications();
                await loadReports();
                return;
            }
        }
        // Not admin - redirect to home
        window.location.href = 'index.html';
    } else {
        window.location.href = 'login.html';
    }
});

console.log('🚀 DVARY GAMES Admin ready!');
