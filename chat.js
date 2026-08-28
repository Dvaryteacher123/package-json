// ============================================
// DVARY GAMES - CHAT SYSTEM
// ============================================

// ============================================
// IMPORT FIREBASE SDKs
// ============================================
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
    startAfter,
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

console.log('🔥 Firebase Chat initialized successfully!');

// ============================================
// DOM ELEMENTS
// ============================================
// Chat List
const chatList = document.getElementById('chatList');
const searchChats = document.getElementById('searchChats');
const newChatBtn = document.getElementById('newChatBtn');

// Conversation
const conversationContainer = document.getElementById('conversationContainer');
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
const chatModalOverlay = document.getElementById('chatModalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');
const searchUsersInput = document.getElementById('searchUsersInput');
const usersList = document.getElementById('usersList');
const createChatBtn = document.getElementById('createChatBtn');

// ============================================
// STATE
// ============================================
let currentUser = null;
let currentChatId = null;
let currentChatUser = null;
let allChats = [];
let messagesUnsubscribe = null;
let chatsUnsubscribe = null;
let selectedUser = null;

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Format time
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

// Create chat item HTML
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

// Create message HTML
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

// Show toast notification
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

// ============================================
// CHAT FUNCTIONS
// ============================================

// Load all chats for current user
async function loadChats() {
    if (!currentUser) return;
    
    try {
        // Get all chats where user is participant
        const chatsQuery = await getDocs(
            query(
                collection(db, 'chats'),
                where('participants', 'array-contains', currentUser.uid)
            )
        );
        
        allChats = [];
        for (const doc of chatsQuery.docs) {
            const chatData = doc.data();
            
            // Get other participant details
            const otherUid = chatData.participants.find(id => id !== currentUser.uid);
            if (!otherUid) continue;
            
            const userDoc = await getDoc(doc(db, 'users', otherUid));
            if (!userDoc.exists) continue;
            
            const userData = userDoc.data();
            
            // Get last message
            const messagesQuery = await getDocs(
                query(
                    collection(db, `chats/${doc.id}/messages`),
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
            
            // Get unread count
            const unreadQuery = await getDocs(
                query(
                    collection(db, `chats/${doc.id}/messages`),
                    where('read', '==', false),
                    where('senderId', '!=', currentUser.uid)
                )
            );
            
            allChats.push({
                chatId: doc.id,
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
        
        // Sort by last message time
        allChats.sort((a, b) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return b.lastMessageTime.toDate() - a.lastMessageTime.toDate();
        });
        
        renderChats();
        
        // Listen for new messages
        setupRealtimeUpdates();
        
    } catch (error) {
        console.error('Error loading chats:', error);
        showToast('Failed to load chats', 'error');
    }
}

// Render chat list
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
    
    // Add click listeners to chat items
    chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chatId = item.dataset.chatId;
            openChat(chatId);
        });
    });
}

// Setup real-time updates for chats
function setupRealtimeUpdates() {
    if (!currentUser) return;
    
    // Listen for new messages in all chats
    if (chatsUnsubscribe) {
        chatsUnsubscribe();
    }
    
    // Listen for chat updates
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
    
    chatsUnsubscribe = onSnapshot(q, async () => {
        // Reload chats when there are changes
        await loadChats();
    });
}

// Open a chat
async function openChat(chatId) {
    if (!chatId) return;
    
    currentChatId = chatId;
    
    // Find chat data
    const chat = allChats.find(c => c.chatId === chatId);
    if (!chat) {
        showToast('Chat not found', 'error');
        return;
    }
    
    currentChatUser = chat.otherUser;
    
    // Update UI
    if (conversationContainer) {
        conversationContainer.style.display = 'flex';
    }
    
    // Update header
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
    
    // Highlight active chat
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chatId === chatId);
    });
    
    // Load messages
    loadMessages(chatId);
    
    // Mark messages as read
    await markMessagesAsRead(chatId);
    
    // Update chat list to reflect read messages
    renderChats();
}

// Load messages for a chat
function loadMessages(chatId) {
    if (!chatId) return;
    
    // Unsubscribe from previous listener
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
        messagesUnsubscribe = null;
    }
    
    // Listen for new messages in real-time
    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
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
    });
    
    // Mark messages as read
    markMessagesAsRead(chatId);
}

// Render messages
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
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send a message
async function sendMessage() {
    if (!currentChatId || !currentUser) {
        showToast('Please select a chat first', 'error');
        return;
    }
    
    const message = messageInput?.value?.trim();
    if (!message) {
        showToast('Please enter a message', 'error');
        return;
    }
    
    try {
        const messagesRef = collection(db, `chats/${currentChatId}/messages`);
        await addDoc(messagesRef, {
            message: message,
            senderId: currentUser.uid,
            timestamp: serverTimestamp(),
            read: false,
            deleted: false
        });
        
        // Update chat last message
        await updateDoc(doc(db, 'chats', currentChatId), {
            lastMessage: message,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: currentUser.uid,
            updatedAt: serverTimestamp()
        });
        
        // Clear input
        if (messageInput) messageInput.value = '';
        
        // Send notification to other user
        await sendChatNotification(currentChatId, message);
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

// Mark messages as read
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
        
        const batch = db.batch();
        unreadQuery.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });
        
        await batch.commit();
        
        // Update unread count in chat list
        const chat = allChats.find(c => c.chatId === chatId);
        if (chat) {
            chat.unreadCount = 0;
            renderChats();
        }
        
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
}

// Send chat notification
async function sendChatNotification(chatId, message) {
    try {
        const chat = allChats.find(c => c.chatId === chatId);
        if (!chat) return;
        
        const otherUser = chat.otherUser;
        if (!otherUser) return;
        
        // Create notification for other user
        await addDoc(collection(db, 'notifications'), {
            userId: otherUser.uid,
            title: `${currentUser.displayName || 'User'} sent a message`,
            message: message,
            type: 'chat',
            chatId: chatId,
            read: false,
            createdAt: serverTimestamp()
        });
        
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

// Delete a message
async function deleteMessage(chatId, messageId) {
    if (!chatId || !messageId) return;
    
    try {
        const messageRef = doc(db, `chats/${chatId}/messages`, messageId);
        await updateDoc(messageRef, {
            deleted: true,
            message: '[This message was deleted]'
        });
        
        showToast('Message deleted', 'success');
    } catch (error) {
        console.error('Error deleting message:', error);
        showToast('Failed to delete message', 'error');
    }
}

// Create a new chat
async function createNewChat(userId) {
    if (!currentUser || !userId) return;
    
    try {
        // Check if chat already exists
        const existingChat = allChats.find(chat => 
            chat.participants.includes(userId) && 
            chat.participants.includes(currentUser.uid)
        );
        
        if (existingChat) {
            openChat(existingChat.chatId);
            if (newChatModal) newChatModal.style.display = 'none';
            return;
        }
        
        // Create new chat
        const chatData = {
            participants: [currentUser.uid, userId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastMessage: 'No messages yet',
            lastMessageTime: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'chats'), chatData);
        
        // Reload chats
        await loadChats();
        
        // Open the new chat
        openChat(docRef.id);
        
        if (newChatModal) newChatModal.style.display = 'none';
        showToast('Chat created successfully!', 'success');
        
    } catch (error) {
        console.error('Error creating chat:', error);
        showToast('Failed to create chat', 'error');
    }
}

// Search users for new chat
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
        
        // Search by username or fullName
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
                users.push({
                    uid: doc.id,
                    ...data
                });
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
                
                // Add click listeners
                usersList.querySelectorAll('.select-user-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const item = e.target.closest('.user-item');
                        const uid = item.dataset.uid;
                        selectedUser = uid;
                        
                        // Highlight selected
                        usersList.querySelectorAll('.user-item').forEach(el => {
                            el.classList.remove('selected');
                        });
                        item.classList.add('selected');
                        
                        if (createChatBtn) createChatBtn.disabled = false;
                    });
                });
            }
        }
        
    } catch (error) {
        console.error('Error searching users:', error);
        if (usersList) {
            usersList.innerHTML = '<p class="error">Failed to search users</p>';
        }
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Send message on button click
if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', sendMessage);
}

// Send message on Enter key
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

// Back to chats (mobile)
if (backToChats) {
    backToChats.addEventListener('click', () => {
        if (conversationContainer) {
            conversationContainer.style.display = 'none';
        }
        currentChatId = null;
        currentChatUser = null;
        
        if (messagesUnsubscribe) {
            messagesUnsubscribe();
            messagesUnsubscribe = null;
        }
    });
}

// New chat button
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        if (newChatModal) {
            newChatModal.style.display = 'flex';
        }
        if (searchUsersInput) {
            searchUsersInput.value = '';
            searchUsersInput.focus();
        }
        if (usersList) {
            usersList.innerHTML = '<p class="search-hint">Search for users to chat with</p>';
        }
        if (createChatBtn) {
            createChatBtn.disabled = true;
        }
        selectedUser = null;
    });
}

// Close modal
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
        if (newChatModal) newChatModal.style.display = 'none';
    });
}

if (chatModalOverlay) {
    chatModalOverlay.addEventListener('click', () => {
        if (newChatModal) newChatModal.style.display = 'none';
    });
}

// Search users
if (searchUsersInput) {
    let searchTimeout;
    searchUsersInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const value = e.target.value.trim();
        searchTimeout = setTimeout(() => {
            searchUsers(value);
        }, 300);
    });
}

// Create chat button
if (createChatBtn) {
    createChatBtn.addEventListener('click', () => {
        if (selectedUser) {
            createNewChat(selectedUser);
        }
    });
}

// Search chats
if (searchChats) {
    searchChats.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            renderChats();
            return;
        }
        
        const filtered = allChats.filter(chat => 
            chat.otherUser.fullName?.toLowerCase().includes(searchTerm) ||
            chat.otherUser.username?.toLowerCase().includes(searchTerm) ||
            chat.lastMessage?.toLowerCase().includes(searchTerm)
        );
        
        if (chatList) {
            if (filtered.length === 0) {
                chatList.innerHTML = '<p class="no-chats">No chats found</p>';
            } else {
                chatList.innerHTML = filtered.map(chat => createChatItem(chat)).join('');
                
                // Add click listeners
                chatList.querySelectorAll('.chat-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const chatId = item.dataset.chatId;
                        openChat(chatId);
                    });
                });
            }
        }
    });
}

// ============================================
// AUTH STATE OBSERVER
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log('👤 Chat user authenticated:', user.email);
        
        // Load chats
        await loadChats();
        
        // Update user online status
        await updateDoc(doc(db, 'users', user.uid), {
            isOnline: true,
            lastSeen: serverTimestamp()
        });
        
        // Set offline status on disconnect
        // Note: For production, use Firebase Realtime Database presence
        // For now, we'll just update on page unload
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
        
    } else {
        currentUser = null;
        console.log('👤 Chat user not authenticated');
        
        // Redirect to login
        if (!window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('signup.html')) {
            // window.location.href = 'login.html';
        }
    }
});

// ============================================
// HANDLE FILE ATTACHMENTS
// ============================================
if (attachmentBtn) {
    attachmentBtn.addEventListener('click', () => {
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // For now, just show a message
            // In production, upload to Firebase Storage
            showToast('File attachments coming soon!', 'info');
        };
        
        fileInput.click();
    });
}

// ============================================
// EMOJI PICKER
// ============================================
if (emojiBtn) {
    let emojiPickerOpen = false;
    
    emojiBtn.addEventListener('click', () => {
        // Simple emoji picker - just add some common emojis
        if (!emojiPickerOpen) {
            const emojiContainer = document.createElement('div');
            emojiContainer.className = 'emoji-picker';
            emojiContainer.innerHTML = `
                <div class="emoji-grid">
                    ${['😊', '😂', '🤣', '❤️', '🔥', '👍', '👋', '🎮', '🎯', '🏆', '👏', '🙌', '💪', '😍', '🤩', '🥳'].map(emoji => 
                        `<span class="emoji-item" data-emoji="${emoji}">${emoji}</span>`
                    ).join('')}
                </div>
            `;
            
            // Position emoji picker
            const rect = emojiBtn.getBoundingClientRect();
            emojiContainer.style.position = 'fixed';
            emojiContainer.style.bottom = '80px';
            emojiContainer.style.left = '20px';
            emojiContainer.style.zIndex = '1000';
            
            document.body.appendChild(emojiContainer);
            emojiPickerOpen = true;
            
            // Add click listeners
            emojiContainer.querySelectorAll('.emoji-item').forEach(el => {
                el.addEventListener('click', () => {
                    if (messageInput) {
                        messageInput.value += el.dataset.emoji;
                        messageInput.focus();
                    }
                    emojiContainer.remove();
                    emojiPickerOpen = false;
                });
            });
            
            // Close on click outside
            const closePicker = (e) => {
                if (!e.target.closest('.emoji-picker') && e.target !== emojiBtn) {
                    emojiContainer.remove();
                    emojiPickerOpen = false;
                    document.removeEventListener('click', closePicker);
                }
            };
            
            setTimeout(() => {
                document.addEventListener('click', closePicker);
            }, 100);
        }
    });
}

// ============================================
// CONTEXT MENU FOR MESSAGES
// ============================================
if (messagesContainer) {
    messagesContainer.addEventListener('contextmenu', (e) => {
        const messageEl = e.target.closest('.message');
        if (!messageEl) return;
        
        e.preventDefault();
        
        const messageId = messageEl.dataset.messageId;
        const isOwn = messageEl.classList.contains('own');
        
        if (!isOwn) return;
        
        // Show context menu
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="delete">
                <i class="fas fa-trash-alt"></i> Delete Message
            </div>
            <div class="context-menu-item" data-action="report">
                <i class="fas fa-flag"></i> Report
            </div>
        `;
        
        menu.style.position = 'fixed';
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;
        menu.style.zIndex = '2000';
        
        document.body.appendChild(menu);
        
        // Handle actions
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', async () => {
                const action = item.dataset.action;
                
                if (action === 'delete') {
                    if (currentChatId && messageId) {
                        await deleteMessage(currentChatId, messageId);
                    }
                } else if (action === 'report') {
                    showToast('Message reported!', 'info');
                }
                
                menu.remove();
            });
        });
        
        // Close menu on click outside
        const closeMenu = (e) => {
            if (!e.target.closest('.context-menu')) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    });
}

// ============================================
// INITIALIZATION
// ============================================
console.log('🚀 DVARY GAMES Chat initialized!');

// ============================================
// EXPORT FUNCTIONS
// ============================================
export {
    app,
    auth,
    db,
    storage,
    loadChats,
    openChat,
    sendMessage,
    createNewChat,
    searchUsers,
    deleteMessage
};
