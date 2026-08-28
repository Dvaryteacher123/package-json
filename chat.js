// ============================================
// DVARY GAMES - GROUP CHAT LOGIC
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
    serverTimestamp,
    onSnapshot,
    increment,
    arrayUnion,
    arrayRemove,
    Timestamp
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

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

console.log('🔥 Firebase Group Chat initialized!');

// ============================================
// CONSTANTS
// ============================================
const GROUP_CHAT_ID = 'dvary_community'; // Fixed group ID

// ============================================
// DOM ELEMENTS
// ============================================
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const emojiBtn = document.getElementById('emojiBtn');
const attachmentBtn = document.getElementById('attachmentBtn');
const emojiPicker = document.getElementById('emojiPicker');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');

// Stats
const totalMembersEl = document.getElementById('totalMembers');
const onlineMembersEl = document.getElementById('onlineMembers');
const modalTotalMembers = document.getElementById('modalTotalMembers');
const modalOnlineMembers = document.getElementById('modalOnlineMembers');

// Group Info
const groupInfoBtn = document.getElementById('groupInfoBtn');
const groupInfoModal = document.getElementById('groupInfoModal');
const closeGroupInfoBtn = document.getElementById('closeGroupInfoBtn');
const membersList = document.getElementById('membersList');
const searchMembers = document.getElementById('searchMembers');

// Navigation
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');

// ============================================
// STATE
// ============================================
let currentUser = null;
let currentUserData = null;
let messagesUnsubscribe = null;
let typingTimeout = null;
let isTyping = false;
let allMembers = [];
let onlineUsers = new Set();

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showError(message) {
    showToast(message, 'error');
    console.error('Error:', message);
}

// ============================================
// CREATE OR GET GROUP CHAT
// ============================================
async function getOrCreateGroupChat() {
    try {
        const groupRef = doc(db, 'groups', GROUP_CHAT_ID);
        const groupDoc = await getDoc(groupRef);
        
        if (!groupDoc.exists()) {
            // Create the group chat
            await setDoc(groupRef, {
                name: 'DVARY GAMES COMMUNITY',
                description: 'Official community chat for DVARY GAMES',
                createdAt: serverTimestamp(),
                createdBy: 'system',
                members: [],
                totalMessages: 0
            });
            console.log('✅ Group chat created!');
        }
        
        return groupRef;
    } catch (error) {
        console.error('Error getting/creating group:', error);
        return null;
    }
}

// ============================================
// LOAD MESSAGES
// ============================================
function loadMessages() {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
    
    const messagesRef = collection(db, 'groups', GROUP_CHAT_ID, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            messages.push({
                id: doc.id,
                ...data
            });
        });
        renderMessages(messages);
    }, (error) => {
        console.error('Error loading messages:', error);
        showError('Failed to load messages');
    });
}

// ============================================
// RENDER MESSAGES
// ============================================
function renderMessages(messages) {
    if (!messagesContainer) return;
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="no-messages">
                <i class="fas fa-comment-dots"></i>
                <p>No messages yet</p>
                <span>Start the conversation!</span>
            </div>
        `;
        return;
    }
    
    const isOwn = (senderId) => senderId === currentUser?.uid;
    
    messagesContainer.innerHTML = messages
        .filter(msg => !msg.deleted || msg.senderId === currentUser?.uid)
        .map(msg => {
            const time = msg.createdAt ? formatTime(msg.createdAt) : '';
            const isOwnMessage = isOwn(msg.senderId);
            const deleted = msg.deleted || false;
            
            if (deleted) {
                return `
                    <div class="message ${isOwnMessage ? 'own' : 'other'} deleted">
                        <div class="message-content">
                            <p class="deleted-message"><i class="fas fa-trash-alt"></i> This message was deleted</p>
                            <span class="message-time">${time}</span>
                        </div>
                    </div>
                `;
            }
            
            const senderName = msg.senderName || 'Unknown User';
            const senderPhoto = msg.senderPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=6C3CE1&color=fff`;
            
            return `
                <div class="message ${isOwnMessage ? 'own' : 'other'}" data-message-id="${msg.id}">
                    ${!isOwnMessage ? `
                        <div class="message-avatar">
                            <img src="${senderPhoto}" alt="${senderName}" />
                        </div>
                    ` : ''}
                    <div class="message-content-wrapper">
                        ${!isOwnMessage ? `<span class="message-sender">${senderName}</span>` : ''}
                        <div class="message-content">
                            <p>${msg.message}</p>
                            <span class="message-time">${time}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================
// SEND MESSAGE
// ============================================
async function sendMessage() {
    if (!currentUser) {
        showError('Please login to send messages');
        return;
    }
    
    const message = messageInput?.value?.trim();
    if (!message) {
        showError('Please enter a message');
        return;
    }
    
    try {
        const messagesRef = collection(db, 'groups', GROUP_CHAT_ID, 'messages');
        
        await addDoc(messagesRef, {
            message: message,
            senderId: currentUser.uid,
            senderName: currentUserData?.fullName || currentUser.displayName || 'User',
            senderPhoto: currentUserData?.profilePicture || '',
            createdAt: serverTimestamp(),
            deleted: false,
            readBy: [currentUser.uid]
        });
        
        // Update total messages count
        await updateDoc(doc(db, 'groups', GROUP_CHAT_ID), {
            totalMessages: increment(1)
        });
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
        
        // Clear typing indicator
        clearTyping();
        
    } catch (error) {
        console.error('Error sending message:', error);
        showError('Failed to send message');
    }
}

// ============================================
// TYPING INDICATOR
// ============================================
function setTyping(isTyping) {
    if (isTyping) {
        typingIndicator.style.display = 'flex';
        typingText.textContent = currentUserData?.fullName || 'Someone' + ' is typing...';
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            typingIndicator.style.display = 'none';
        }, 3000);
    } else {
        typingIndicator.style.display = 'none';
        clearTimeout(typingTimeout);
    }
}

function clearTyping() {
    typingIndicator.style.display = 'none';
    clearTimeout(typingTimeout);
}

// ============================================
// LOAD MEMBERS & ONLINE STATUS
// ============================================
async function loadMembers() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const members = [];
        const online = [];
        
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            if (!data.isBlocked) {
                const isOnline = data.isOnline || false;
                members.push({
                    uid: doc.id,
                    ...data,
                    isOnline: isOnline
                });
                if (isOnline) {
                    online.push(doc.id);
                }
            }
        });
        
        allMembers = members;
        onlineUsers = new Set(online);
        
        updateStats();
        renderMembers();
        
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

function updateStats() {
    const total = allMembers.length;
    const online = onlineUsers.size;
    
    if (totalMembersEl) totalMembersEl.textContent = total;
    if (onlineMembersEl) onlineMembersEl.textContent = online;
    if (modalTotalMembers) modalTotalMembers.textContent = total;
    if (modalOnlineMembers) modalOnlineMembers.textContent = online;
}

function renderMembers(filter = '') {
    if (!membersList) return;
    
    const searchTerm = filter.toLowerCase().trim();
    let filtered = allMembers;
    
    if (searchTerm) {
        filtered = allMembers.filter(m => 
            m.fullName?.toLowerCase().includes(searchTerm) ||
            m.username?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filtered.length === 0) {
        membersList.innerHTML = `
            <div class="no-results">
                <p>No members found</p>
            </div>
        `;
        return;
    }
    
    membersList.innerHTML = filtered.map(m => `
        <div class="member-item">
            <img src="${m.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.fullName || m.username)}&background=6C3CE1&color=fff`}" 
                 alt="${m.fullName || m.username}" />
            <div class="member-info">
                <span class="member-name">${m.fullName || m.username}</span>
                <span class="member-username">@${m.username}</span>
            </div>
            <span class="member-status ${m.isOnline ? 'online' : 'offline'}">
                ${m.isOnline ? '🟢 Online' : '⚫ Offline'}
            </span>
        </div>
    `).join('');
}

// ============================================
// EMOJI PICKER
// ============================================
function toggleEmojiPicker() {
    const isVisible = emojiPicker.style.display === 'block';
    emojiPicker.style.display = isVisible ? 'none' : 'block';
}

function insertEmoji(emoji) {
    const input = messageInput;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const value = input.value;
    
    input.value = value.substring(0, start) + emoji + value.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + emoji.length;
    
    emojiPicker.style.display = 'none';
}

// ============================================
// GROUP INFO MODAL
// ============================================
function openGroupInfo() {
    if (groupInfoModal) {
        groupInfoModal.style.display = 'flex';
        renderMembers();
    }
}

function closeGroupInfo() {
    if (groupInfoModal) {
        groupInfoModal.style.display = 'none';
    }
}

// ============================================
// LOGOUT
// ============================================
async function logoutUser() {
    try {
        await signOut(auth);
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        showError('Failed to logout');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Send message
sendMessageBtn?.addEventListener('click', sendMessage);

messageInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Typing indicator
messageInput?.addEventListener('input', () => {
    const hasText = messageInput.value.trim().length > 0;
    if (hasText && !isTyping) {
        isTyping = true;
        setTyping(true);
        // In real implementation, send typing status to Firestore
    } else if (!hasText && isTyping) {
        isTyping = false;
        clearTyping();
    }
});

messageInput?.addEventListener('blur', () => {
    isTyping = false;
    clearTyping();
});

// Emoji picker
emojiBtn?.addEventListener('click', toggleEmojiPicker);

document.querySelectorAll('.emoji-item').forEach(el => {
    el.addEventListener('click', () => {
        insertEmoji(el.textContent);
    });
});

// Close emoji picker on outside click
document.addEventListener('click', (e) => {
    if (emojiPicker && !e.target.closest('.emoji-picker-container') && !e.target.closest('.emoji-btn')) {
        emojiPicker.style.display = 'none';
    }
});

// Group Info
groupInfoBtn?.addEventListener('click', openGroupInfo);
closeGroupInfoBtn?.addEventListener('click', closeGroupInfo);
groupInfoModal?.addEventListener('click', (e) => {
    if (e.target === groupInfoModal) {
        closeGroupInfo();
    }
});

// Search members
searchMembers?.addEventListener('input', (e) => {
    renderMembers(e.target.value);
});

// Attachment button (placeholder for future)
attachmentBtn?.addEventListener('click', () => {
    showToast('File attachment coming soon!', 'info');
});

// Menu toggle
menuToggle?.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
document.getElementById('mobileLogoutBtn')?.addEventListener('click', logoutUser);

// ============================================
// AUTO-RESIZE TEXTAREA
// ============================================
messageInput?.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ============================================
// AUTH STATE
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('✅ Chat user authenticated:', user.email);
        
        // Get user data
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                console.log('✅ User data loaded:', currentUserData.fullName);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        
        // Update navigation
        const userLinks = document.getElementById('userLinks');
        const authLinks = document.getElementById('authLinks');
        const mobileUserLinks = document.getElementById('mobileUserLinks');
        const mobileAuthLinks = document.getElementById('mobileAuthLinks');
        const navUsername = document.getElementById('navUsername');
        const navProfilePic = document.getElementById('navProfilePic');
        
        if (userLinks) userLinks.style.display = 'flex';
        if (authLinks) authLinks.style.display = 'none';
        if (mobileUserLinks) mobileUserLinks.style.display = 'block';
        if (mobileAuthLinks) mobileAuthLinks.style.display = 'none';
        
        if (navUsername) {
            navUsername.textContent = currentUserData?.fullName || user.displayName || user.email;
        }
        if (navProfilePic) {
            navProfilePic.src = currentUserData?.profilePicture || user.photoURL || 
                `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData?.fullName || 'User')}&background=6C3CE1&color=fff`;
        }
        
        // Set user online status
        await updateDoc(doc(db, 'users', user.uid), {
            isOnline: true,
            lastSeen: serverTimestamp()
        });
        
        // Setup group chat
        await getOrCreateGroupChat();
        loadMessages();
        await loadMembers();
        
        // Update online status on page unload
        window.addEventListener('beforeunload', async () => {
            if (currentUser) {
                try {
                    await updateDoc(doc(db, 'users', currentUser.uid), {
                        isOnline: false,
                        lastSeen: serverTimestamp()
                    });
                } catch (error) {
                    console.error('Error updating offline status:', error);
                }
            }
        });
        
        // Listen for member status changes
        const usersRef = collection(db, 'users');
        const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
            const online = new Set();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.isOnline && !data.isBlocked) {
                    online.add(doc.id);
                }
            });
            onlineUsers = online;
            updateStats();
            renderMembers(searchMembers?.value || '');
        });
        
        // Store unsubscribe for cleanup
        window._unsubscribeUsers = unsubscribeUsers;
        
    } else {
        currentUser = null;
        currentUserData = null;
        console.log('❌ Chat user not authenticated');
        
        // Cleanup listeners
        if (messagesUnsubscribe) {
            messagesUnsubscribe();
            messagesUnsubscribe = null;
        }
        if (window._unsubscribeUsers) {
            window._unsubscribeUsers();
            window._unsubscribeUsers = null;
        }
        
        // Redirect to login
        window.location.href = 'login.html';
    }
});

console.log('🚀 DVARY GAMES Group Chat ready!');
