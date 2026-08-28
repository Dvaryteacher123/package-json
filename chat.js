// ============================================
// DVARY GAMES - CHAT SYSTEM
// ============================================

// IMPORT FIREBASE SDKs
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
    getAuth, 
    onAuthStateChanged 
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
    Timestamp
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "AIzaSyCmwASW4XXQ3O0AvsCM_r1WLlrUmGjYVxI",
    authDomain: "dvary-9a7d0.firebaseapp.com",
    projectId: "dvary-9a7d0",
    storageBucket: "dvary-9a7d0.firebasestorage.app",
    messagingSenderId: "107370806066",
    appId: "1:107370806066:web:4c2ce1e6f7b6c32909f52b",
    measurementId: "G-07361LFJEP"
};

// INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log('🔥 Firebase Chat initialized successfully!');

// DOM ELEMENTS
const chatList = document.getElementById('chatList');
const searchChats = document.getElementById('searchChats');
const newChatBtn = document.getElementById('newChatBtn');
const newChatBtnEmpty = document.getElementById('newChatBtnEmpty');
const loadingOverlay = document.getElementById('loadingOverlay');

// Conversation
const conversationContainer = document.getElementById('conversationContainer');
const conversationContent = document.getElementById('conversationContent');
const conversationEmpty = document.getElementById('conversationEmpty');
const conversationHeader = document.getElementById('conversationHeader');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const emojiBtn = document.getElementById('emojiBtn');
const attachmentBtn = document.getElementById('attachmentBtn');
const backToChats = document.getElementById('backToChats');

// Chat Profile
const chatProfilePic = document.getElementById('chatProfilePic');
const chatUsername = document.getElementById('chatUsername');
const chatStatus = document.getElementById('chatStatus');

// Modals
const newChatModal = document.getElementById('newChatModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const searchUsersInput = document.getElementById('searchUsersInput');
const usersList = document.getElementById('usersList');
const createChatBtn = document.getElementById('createChatBtn');

// STATE
let currentUser = null;
let currentChatId = null;
let currentChatUser = null;
let allChats = [];
let messagesUnsubscribe = null;
let chatsUnsubscribe = null;
let selectedUser = null;

// UTILITY FUNCTIONS
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

function createChatItem(chat) {
    const isActive = chat.chatId === currentChatId;
    const lastMessage = chat.lastMessage || 'No messages yet';
    const time = chat.lastMessageTime ? formatTime(chat.lastMessageTime) : '';
    const unread = chat.unreadCount > 0 ? `<span class="unread-badge">${chat.unreadCount}</span>` : '';
    
    return `
        <div class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.chatId}">
            <div class="chat-item-avatar">
                <img src="${chat.otherUser.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(chat.otherUser.username) + '&background=6C3CE1&color=fff'}" 
                     alt="${chat.otherUser.username}" />
                <span class="online-status ${chat.otherUser.isOnline ? 'online' : 'offline'}"></span>
            </div>
            <div class="chat-item-content">
                <div class="chat-item-header">
                    <span class="chat-item-name">${chat.otherUser.fullName || chat.otherUser.username}</span>
                    <span class="chat-item-time">${time}</span>
                </div>
                <div class="chat-item-message">
                    <span class="last-message">${lastMessage}</span>
                    ${unread}
                </div>
            </div>
        </div>
    `;
}

function createMessage(message, isOwn) {
    const time = message.timestamp ? formatTime(message.timestamp) : '';
    const deleted = message.deleted || false;
    
    if (deleted) {
        return `
            <div class="message ${isOwn ? 'own' : 'other'} deleted">
                <div class="message-content">
                    <p class="deleted-message"><i class="fas fa-trash-alt"></i> This message was deleted</p>
                    <span class="message-time">${time}</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="message ${isOwn ? 'own' : 'other'}">
            ${!isOwn ? `
                <div class="message-avatar">
                    <img src="${currentChatUser?.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentChatUser?.username || '') + '&background=6C3CE1&color=fff'}" 
                         alt="${currentChatUser?.username}" />
                </div>
            ` : ''}
            <div class="message-content">
                <p>${message.message}</p>
                <span class="message-time">${time}</span>
                ${isOwn ? `<span class="message-status ${message.read ? 'read' : 'sent'}">
                    <i class="fas ${message.read ? 'fa-check-double' : 'fa-check'}"></i>
                </span>` : ''}
            </div>
        </div>
    `;
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

// CHAT FUNCTIONS
async function loadChats() {
    if (!currentUser) return;
    
    try {
        const chatsQuery = await getDocs(
            query(
                collection(db, 'chats'),
                where('participants', 'array-contains', currentUser.uid)
            )
        );
        
        allChats = [];
        for (const chatDoc of chatsQuery.docs) {
            const chatData = chatDoc.data();
            
            const otherUid = chatData.participants.find(id => id !== currentUser.uid);
            if (!otherUid) continue;
            
            const userDoc = await getDoc(doc(db, 'users', otherUid));
            if (!userDoc.exists()) continue;
            
            const userData = userDoc.data();
            
            const messagesQuery = await getDocs(
                query(
                    collection(db, `chats/${chatDoc.id}/messages`),
                    orderBy('timestamp', 'desc'),
                    limit(1)
                )
            );
            
            let lastMessage = null;
            let lastMessageTime = null;
            let lastMessageSender = null;
            
            if (!messagesQuery.empty) {
                const msgDoc = messagesQuery.docs[0];
                const msgData = msgDoc.data();
                lastMessage = msgData.deleted ? '[This message was deleted]' : msgData.message;
                lastMessageTime = msgData.timestamp;
                lastMessageSender = msgData.senderId;
            }
            
            const unreadQuery = await getDocs(
                query(
                    collection(db, `chats/${chatDoc.id}/messages`),
                    where('read', '==', false),
                    where('senderId', '!=', currentUser.uid)
                )
            );
            
            allChats.push({
                chatId: chatDoc.id,
                otherUser: {
                    uid: otherUid,
                    fullName: userData.fullName || userData.username,
                    username: userData.username,
                    profilePicture: userData.profilePicture || '',
                    isOnline: userData.isOnline || false
                },
                lastMessage: lastMessage || 'No messages yet',
                lastMessageTime: lastMessageTime || null,
                lastMessageSender: lastMessageSender,
                unreadCount: unreadQuery.size,
                participants: chatData.participants,
                createdAt: chatData.createdAt
            });
        }
        
        allChats.sort((a, b) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return b.lastMessageTime.toDate() - a.lastMessageTime.toDate();
        });
        
        renderChats();
        
    } catch (error) {
        console.error('Error loading chats:', error);
        showToast('Failed to load chats', 'error');
        if (chatList) {
            chatList.innerHTML = '<p class="no-chats">Error loading chats</p>';
        }
    }
}

function renderChats() {
    if (!chatList) return;
    
    if (allChats.length === 0) {
        chatList.innerHTML = `
            <div class="no-chats">
                <i class="fas fa-comment-dots"></i>
                <p>No chats yet</p>
                <span>Start a new conversation</span>
            </div>
        `;
        return;
    }
    
    chatList.innerHTML = allChats.map(chat => createChatItem(chat)).join('');
    
    chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chatId = item.dataset.chatId;
            openChat(chatId);
        });
    });
}

async function openChat(chatId) {
    if (!chatId) return;
    
    currentChatId = chatId;
    
    const chat = allChats.find(c => c.chatId === chatId);
    if (!chat) {
        showToast('Chat not found', 'error');
        return;
    }
    
    currentChatUser = chat.otherUser;
    
    if (conversationEmpty) conversationEmpty.style.display = 'none';
    if (conversationContent) conversationContent.style.display = 'flex';
    
    if (chatProfilePic) {
        chatProfilePic.src = currentChatUser.profilePicture || 
            `https://ui-avatars.com/api/?name=${encodeURIComponent(currentChatUser.username)}&background=6C3CE1&color=fff`;
    }
    if (chatUsername) {
        chatUsername.textContent = currentChatUser.fullName || currentChatUser.username;
    }
    if (chatStatus) {
        chatStatus.textContent = currentChatUser.isOnline ? 'Online' : 'Offline';
        chatStatus.className = `chat-status ${currentChatUser.isOnline ? 'online' : 'offline'}`;
    }
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chatId === chatId);
    });
    
    loadMessages(chatId);
    await markMessagesAsRead(chatId);
}

function loadMessages(chatId) {
    if (!chatId) return;
    
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
    
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach(doc => {
            messages.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderMessages(messages);
    });
}

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
        .map(msg => createMessage(msg, isOwn(msg.senderId)))
        .join('');
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
    if (!currentChatId || !currentUser) {
        showToast('Please select a chat first', 'error');
        return;
    }
    
    const message = messageInput?.value?.trim();
    if (!message) return;
    
    try {
        const messagesRef = collection(db, `chats/${currentChatId}/messages`);
        await addDoc(messagesRef, {
            message: message,
            senderId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false,
            deleted: false
        });
        
        await updateDoc(doc(db, 'chats', currentChatId), {
            lastMessage: message,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: currentUser.uid,
            updatedAt: serverTimestamp()
        });
        
        if (messageInput) messageInput.value = '';
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

async function markMessagesAsRead(chatId) {
    if (!chatId || !currentUser) return;
    
    try {
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const unreadQuery = await getDocs(
            query(
                messagesRef,
                where('read', '==', false),
                where('senderId', '!=', currentUser.uid)
            )
        );
        
        unreadQuery.forEach(async (msgDoc) => {
            await updateDoc(doc(db, `chats/${chatId}/messages`, msgDoc.id), { read: true });
        });
        
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

async function createNewChat(userId) {
    if (!currentUser || !userId) return;
    
    try {
        const existingChat = allChats.find(chat => 
            chat.participants.includes(userId) && 
            chat.participants.includes(currentUser.uid)
        );
        
        if (existingChat) {
            openChat(existingChat.chatId);
            if (newChatModal) newChatModal.style.display = 'none';
            return;
        }
        
        const chatData = {
            participants: [currentUser.uid, userId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: 'No messages yet',
            lastMessageTime: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'chats'), chatData);
        await loadChats();
        openChat(docRef.id);
        
        if (newChatModal) newChatModal.style.display = 'none';
        showToast('Chat created successfully!', 'success');
        
    } catch (error) {
        console.error('Error creating chat:', error);
        showToast('Failed to create chat', 'error');
    }
}

async function searchUsers(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
        if (usersList) {
            usersList.innerHTML = '<p class="search-hint">Type at least 2 characters to search</p>';
        }
        return;
    }
    
    try {
        const usersRef = collection(db, 'users');
        const searchTermLower = searchTerm.toLowerCase();
        
        const q = query(
            usersRef,
            where('username', '>=', searchTermLower),
            where('username', '<=', searchTermLower + '\uf8ff')
        );
        
        const snapshot = await getDocs(q);
        const users = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (doc.id !== currentUser?.uid && !data.isBlocked) {
                users.push({ uid: doc.id, ...data });
            }
        });
        
        if (usersList) {
            if (users.length === 0) {
                usersList.innerHTML = '<p class="no-results">No users found</p>';
            } else {
                usersList.innerHTML = users.map(user => `
                    <div class="user-item" data-uid="${user.uid}">
                        <img src="${user.profilePicture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username) + '&background=6C3CE1&color=fff'}" 
                             alt="${user.username}" />
                        <div class="user-info">
                            <span class="user-name">${user.fullName || user.username}</span>
                            <span class="user-username">@${user.username}</span>
                        </div>
                        <button class="btn-primary btn-small select-user-btn">Select</button>
                    </div>
                `).join('');
                
                usersList.querySelectorAll('.select-user-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const item = e.target.closest('.user-item');
                        selectedUser = item.dataset.uid;
                        
                        usersList.querySelectorAll('.user-item').forEach(el => el.classList.remove('selected'));
                        item.classList.add('selected');
                        if (createChatBtn) createChatBtn.disabled = false;
                    });
                });
            }
        }
    } catch (error) {
        console.error('Error searching users:', error);
    }
}

// EVENT LISTENERS
if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendMessage);

if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

const openNewChatModal = () => {
    if (newChatModal) newChatModal.style.display = 'flex';
    if (searchUsersInput) {
        searchUsersInput.value = '';
        searchUsersInput.focus();
    }
    if (usersList) usersList.innerHTML = '<p class="search-hint">Search for users to chat with</p>';
    if (createChatBtn) createChatBtn.disabled = true;
    selectedUser = null;
};

if (newChatBtn) newChatBtn.addEventListener('click', openNewChatModal);
if (newChatBtnEmpty) newChatBtnEmpty.addEventListener('click', openNewChatModal);

if (closeModalBtn) closeModalBtn.addEventListener('click', () => { if (newChatModal) newChatModal.style.display = 'none'; });
if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => { if (newChatModal) newChatModal.style.display = 'none'; });

if (searchUsersInput) {
    let searchTimeout;
    searchUsersInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const value = e.target.value.trim();
        searchTimeout = setTimeout(() => searchUsers(value), 300);
    });
}

if (createChatBtn) {
    createChatBtn.addEventListener('click', () => {
        if (selectedUser) createNewChat(selectedUser);
    });
}

// AUTH OBSERVER
onAuthStateChanged(auth, async (user) => {
    // FICHA LOADING OVERLAY MARA MOJA
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }

    if (user) {
        currentUser = user;
        console.log('👤 Chat user authenticated:', user.email);
        
        await loadChats();
        
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                isOnline: true,
                lastSeen: serverTimestamp()
            });
        } catch (e) {
            console.error('User doc does not exist yet:', e);
        }
        
    } else {
        currentUser = null;
        console.log('👤 Chat user not authenticated - Redirecting');
        window.location.href = 'login.html';
    }
});

