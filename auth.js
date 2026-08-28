// ============================================
// DVARY GAMES - AUTHENTICATION LOGIC
// ============================================

// ============================================
// IMPORT FIREBASE SDKs
// ============================================
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signInWithRedirect,
    GoogleAuthProvider,
    FacebookAuthProvider,
    TwitterAuthProvider,
    GithubAuthProvider,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile,
    updatePassword,
    updateEmail,
    deleteUser,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    inMemoryPersistence,
    reauthenticateWithCredential,
    EmailAuthProvider,
    getRedirectResult
} from "firebase/auth";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp 
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

// ============================================
// AUTH PROVIDERS
// ============================================
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

const facebookProvider = new FacebookAuthProvider();
const twitterProvider = new TwitterAuthProvider();
const githubProvider = new GithubAuthProvider();

console.log('🔥 Firebase Auth initialized successfully!');

// ============================================
// DOM ELEMENTS (Login Page)
// ============================================
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const authLoading = document.getElementById('authLoading');
const authError = document.getElementById('authError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const togglePassword = document.getElementById('togglePassword');
const rememberMe = document.getElementById('rememberMe');
const forgotPassword = document.getElementById('forgotPassword');
const googleLogin = document.getElementById('googleLogin');

// ============================================
// DOM ELEMENTS (Signup Page)
// ============================================
const signupForm = document.getElementById('signupForm');
const fullNameInput = document.getElementById('fullName');
const usernameInput = document.getElementById('username');
const signupEmailInput = document.getElementById('email');
const phoneInput = document.getElementById('phoneNumber');
const signupPasswordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const profilePictureInput = document.getElementById('profilePicture');
const termsCheckbox = document.getElementById('termsCheckbox');
const signupBtn = document.getElementById('signupBtn');
const googleSignup = document.getElementById('googleSignup');

// Signup error elements
const fullNameError = document.getElementById('fullNameError');
const usernameError = document.getElementById('usernameError');
const signupEmailError = document.getElementById('emailError');
const signupPasswordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');
const termsError = document.getElementById('termsError');

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate username (3-20 characters, letters, numbers, underscore)
function validateUsername(username) {
    const re = /^[a-zA-Z0-9_]{3,20}$/;
    return re.test(username);
}

// Validate password (min 6 characters)
function validatePassword(password) {
    return password.length >= 6;
}

// Show error message
function showError(message, errorElement = authError) {
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

// Set loading state
function setLoading(isLoading, button = loginBtn, loadingElement = authLoading) {
    if (isLoading) {
        if (button) button.style.display = 'none';
        if (loadingElement) loadingElement.style.display = 'block';
        if (button) button.disabled = true;
    } else {
        if (button) button.style.display = 'flex';
        if (loadingElement) loadingElement.style.display = 'none';
        if (button) button.disabled = false;
    }
}

// Clear all errors
function clearErrors() {
    const errorElements = document.querySelectorAll('.form-error, .auth-error');
    errorElements.forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

// ============================================
// 1. REGISTER USER (Email & Password)
// ============================================
async function registerUser(userData) {
    try {
        const { fullName, username, email, phoneNumber, password, profilePicture } = userData;

        // Check if username is taken
        const usernameTaken = await isUsernameTaken(username);
        if (usernameTaken) {
            throw new Error('Username is already taken. Please choose another.');
        }

        // Check if email is already registered
        const emailTaken = await isEmailTaken(email);
        if (emailTaken) {
            throw new Error('Email is already registered. Please login instead.');
        }

        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update profile with display name
        await updateProfile(user, {
            displayName: fullName
        });

        // Send email verification
        try {
            await sendEmailVerification(user);
            console.log('✅ Verification email sent to:', email);
        } catch (emailError) {
            console.error('Email verification error:', emailError);
        }

        // Create user document in Firestore
        const userDoc = {
            uid: user.uid,
            fullName: fullName,
            username: username,
            email: email,
            phoneNumber: phoneNumber || '',
            profilePicture: profilePicture || '',
            isAdmin: false,
            isBlocked: false,
            emailVerified: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastLogin: null,
            gamesPlayed: 0,
            favorites: [],
            settings: {
                darkMode: true,
                language: 'en',
                notifications: {
                    games: true,
                    chat: true,
                    updates: true
                }
            }
        };

        await setDoc(doc(db, 'users', user.uid), userDoc);

        // Store user info in localStorage
        localStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: fullName,
            username: username,
            profilePicture: profilePicture || ''
        }));

        console.log('✅ User registered successfully:', user.email);

        return {
            success: true,
            user: user,
            message: 'Account created successfully!'
        };

    } catch (error) {
        console.error('Registration error:', error);
        
        let errorMessage = 'Registration failed. Please try again.';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered. Please login instead.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
                break;
            default:
                errorMessage = error.message || 'Registration failed. Please try again.';
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

// ============================================
// 2. LOGIN USER (Email & Password)
// ============================================
async function loginUser(email, password, remember = false) {
    try {
        // Set persistence based on Remember Me
        await setPersistence(
            auth, 
            remember ? browserLocalPersistence : browserSessionPersistence
        );
        
        // Sign in with email and password
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Check if user is blocked
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.isBlocked) {
                await signOut(auth);
                throw new Error('Your account has been blocked. Please contact support.');
            }
            
            // Update last login
            await updateDoc(doc(db, 'users', user.uid), {
                lastLogin: serverTimestamp()
            });
        }
        
        // Store user info
        localStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email,
            photoURL: user.photoURL || ''
        }));
        
        console.log('✅ User logged in:', user.email);
        
        return {
            success: true,
            user: user
        };
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed. Please try again.';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            default:
                errorMessage = error.message || 'Login failed. Please try again.';
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

// ============================================
// 3. GOOGLE LOGIN / SIGNUP
// ============================================
async function loginWithGoogle(redirect = false) {
    try {
        let result;
        if (redirect) {
            await signInWithRedirect(auth, googleProvider);
            return { success: true, message: 'Redirecting to Google...' };
        } else {
            result = await signInWithPopup(auth, googleProvider);
        }
        
        const user = result.user;
        
        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
            // Create new user document
            const username = user.email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);
            const userData = {
                uid: user.uid,
                fullName: user.displayName || 'Google User',
                username: username,
                email: user.email,
                phoneNumber: '',
                profilePicture: user.photoURL || '',
                isAdmin: false,
                isBlocked: false,
                emailVerified: user.emailVerified || false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastLogin: null,
                gamesPlayed: 0,
                favorites: [],
                settings: {
                    darkMode: true,
                    language: 'en',
                    notifications: {
                        games: true,
                        chat: true,
                        updates: true
                    }
                }
            };
            await setDoc(doc(db, 'users', user.uid), userData);
        } else {
            // Update last login
            await updateDoc(doc(db, 'users', user.uid), {
                lastLogin: serverTimestamp()
            });
        }
        
        localStorage.setItem('user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Google User',
            photoURL: user.photoURL || ''
        }));
        
        console.log('✅ User logged in with Google:', user.email);
        
        return {
            success: true,
            user: user
        };
        
    } catch (error) {
        console.error('Google login error:', error);
        return {
            success: false,
            error: error.message || 'Google login failed. Please try again.'
        };
    }
}

// ============================================
// 4. LOGOUT USER
// ============================================
async function logoutUser() {
    try {
        await signOut(auth);
        localStorage.removeItem('user');
        console.log('✅ User logged out');
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { 
            success: false, 
            error: error.message || 'Logout failed. Please try again.'
        };
    }
}

// ============================================
// 5. FORGOT PASSWORD / RESET PASSWORD
// ============================================
async function resetPassword(email) {
    try {
        if (!email || !validateEmail(email)) {
            throw new Error('Please enter a valid email address.');
        }
        
        await sendPasswordResetEmail(auth, email);
        console.log('✅ Password reset email sent to:', email);
        return {
            success: true,
            message: 'Password reset email sent! Please check your inbox.'
        };
    } catch (error) {
        console.error('Password reset error:', error);
        let errorMessage = 'Failed to send reset email. Please try again.';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            default:
                errorMessage = error.message || 'Failed to send reset email.';
        }
        return {
            success: false,
            error: errorMessage
        };
    }
}

// ============================================
// 6. UPDATE USER PROFILE
// ============================================
async function updateUserProfile(uid, data) {
    try {
        const updateData = {};
        
        if (data.fullName) {
            updateData.fullName = data.fullName;
            // Also update auth profile
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, {
                    displayName: data.fullName
                });
            }
        }
        
        if (data.username) updateData.username = data.username;
        if (data.phoneNumber) updateData.phoneNumber = data.phoneNumber;
        if (data.profilePicture) updateData.profilePicture = data.profilePicture;
        if (data.settings) updateData.settings = data.settings;
        
        updateData.updatedAt = serverTimestamp();
        
        await updateDoc(doc(db, 'users', uid), updateData);
        console.log('✅ Profile updated for:', uid);
        return { success: true };
    } catch (error) {
        console.error('Profile update error:', error);
        return {
            success: false,
            error: error.message || 'Failed to update profile.'
        };
    }
}

// ============================================
// 7. CHANGE PASSWORD
// ============================================
async function changePassword(currentPassword, newPassword) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in.');
        }
        
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(
            user.email,
            currentPassword
        );
        await reauthenticateWithCredential(user, credential);
        
        // Update password
        await updatePassword(user, newPassword);
        console.log('✅ Password changed successfully');
        return { success: true };
    } catch (error) {
        console.error('Password change error:', error);
        let errorMessage = 'Failed to change password.';
        switch (error.code) {
            case 'auth/wrong-password':
                errorMessage = 'Current password is incorrect.';
                break;
            case 'auth/weak-password':
                errorMessage = 'New password is too weak. Use at least 6 characters.';
                break;
            default:
                errorMessage = error.message || 'Failed to change password.';
        }
        return {
            success: false,
            error: errorMessage
        };
    }
}

// ============================================
// 8. DELETE ACCOUNT
// ============================================
async function deleteAccount(uid, password) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('No user logged in.');
        }
        
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(
            user.email,
            password
        );
        await reauthenticateWithCredential(user, credential);
        
        // Delete user document from Firestore
        await deleteDoc(doc(db, 'users', uid));
        
        // Delete user from Firebase Auth
        await deleteUser(user);
        console.log('✅ Account deleted for:', uid);
        return { success: true };
    } catch (error) {
        console.error('Account deletion error:', error);
        let errorMessage = 'Failed to delete account.';
        switch (error.code) {
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/requires-recent-login':
                errorMessage = 'Please login again before deleting your account.';
                break;
            default:
                errorMessage = error.message || 'Failed to delete account.';
        }
        return {
            success: false,
            error: errorMessage
        };
    }
}

// ============================================
// 9. CHECK USERNAME EXISTS
// ============================================
async function isUsernameTaken(username) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking username:', error);
        return false;
    }
}

// ============================================
// 10. CHECK EMAIL EXISTS
// ============================================
async function isEmailTaken(email) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking email:', error);
        return false;
    }
}

// ============================================
// 11. GET CURRENT USER DATA
// ============================================
async function getCurrentUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            return {
                success: true,
                data: userDoc.data()
            };
        } else {
            return {
                success: false,
                error: 'User not found.'
            };
        }
    } catch (error) {
        console.error('Error getting user data:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ============================================
// 12. AUTH STATE OBSERVER
// ============================================
function onAuthStateChangedListener(callback) {
    return onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('👤 User authenticated:', user.email);
            callback({ authenticated: true, user: user });
        } else {
            console.log('👤 User not authenticated');
            callback({ authenticated: false, user: null });
        }
    });
}

// ============================================
// 13. REDIRECT RESULT HANDLER
// ============================================
async function handleRedirectResult() {
    try {
        const result = await getRedirectResult(auth);
        if (result) {
            const user = result.user;
            console.log('✅ Redirect login successful:', user.email);
            return { success: true, user: user };
        }
        return { success: false, user: null };
    } catch (error) {
        console.error('Redirect result error:', error);
        return { success: false, error: error.message };
    }
}

// ============================================
// EVENT LISTENERS (LOGIN PAGE)
// ============================================

// Toggle password visibility
if (togglePassword) {
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.querySelector('i').classList.toggle('fa-eye');
        togglePassword.querySelector('i').classList.toggle('fa-eye-slash');
    });
}

// Login form submission
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        clearErrors();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const remember = rememberMe ? rememberMe.checked : false;
        
        // Validate
        let hasError = false;
        
        if (!email) {
            if (emailError) emailError.textContent = 'Email is required.';
            hasError = true;
        } else if (!validateEmail(email)) {
            if (emailError) emailError.textContent = 'Please enter a valid email address.';
            hasError = true;
        }
        
        if (!password) {
            if (passwordError) passwordError.textContent = 'Password is required.';
            hasError = true;
        } else if (password.length < 6) {
            if (passwordError) passwordError.textContent = 'Password must be at least 6 characters.';
            hasError = true;
        }
        
        if (hasError) return;
        
        setLoading(true);
        
        const result = await loginUser(email, password, remember);
        
        setLoading(false);
        
        if (result.success) {
            window.location.href = 'index.html';
        } else {
            showError(result.error);
        }
    });
}

// Forgot password
if (forgotPassword) {
    forgotPassword.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = emailInput ? emailInput.value.trim() : '';
        
        if (!email || !validateEmail(email)) {
            showError('Please enter a valid email address to reset your password.');
            return;
        }
        
        const result = await resetPassword(email);
        
        if (result.success) {
            showError(result.message, authError);
            // Change style to success
            if (authError) {
                authError.style.background = '#10b981';
                authError.style.color = '#fff';
                authError.style.border = '1px solid #10b981';
                setTimeout(() => {
                    authError.style.background = '';
                    authError.style.color = '';
                    authError.style.border = '';
                }, 5000);
            }
        } else {
            showError(result.error);
        }
    });
}

// Google login
if (googleLogin) {
    googleLogin.addEventListener('click', async () => {
        setLoading(true);
        const result = await loginWithGoogle(false);
        setLoading(false);
        
        if (result.success) {
            window.location.href = 'index.html';
        } else {
            showError(result.error);
        }
    });
}

// ============================================
// EVENT LISTENERS (SIGNUP PAGE)
// ============================================

// Toggle password visibility (signup)
const toggleSignupPassword = document.getElementById('togglePassword');
if (toggleSignupPassword && signupPasswordInput) {
    toggleSignupPassword.addEventListener('click', () => {
        const type = signupPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        signupPasswordInput.setAttribute('type', type);
        toggleSignupPassword.querySelector('i').classList.toggle('fa-eye');
        toggleSignupPassword.querySelector('i').classList.toggle('fa-eye-slash');
    });
}

const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
if (toggleConfirmPassword && confirmPasswordInput) {
    toggleConfirmPassword.addEventListener('click', () => {
        const type = confirmPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        confirmPasswordInput.setAttribute('type', type);
        toggleConfirmPassword.querySelector('i').classList.toggle('fa-eye');
        toggleConfirmPassword.querySelector('i').classList.toggle('fa-eye-slash');
    });
}

// Profile picture preview
if (profilePictureInput) {
    profilePictureInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const previewImage = document.getElementById('previewImage');
                const filePreview = document.getElementById('filePreview');
                if (previewImage && filePreview) {
                    previewImage.src = event.target.result;
                    filePreview.style.display = 'block';
                    const label = document.querySelector('.file-upload-label');
                    if (label) label.style.display = 'none';
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

// Remove file
const removeFile = document.getElementById('removeFile');
if (removeFile) {
    removeFile.addEventListener('click', () => {
        if (profilePictureInput) {
            profilePictureInput.value = '';
            const filePreview = document.getElementById('filePreview');
            const previewImage = document.getElementById('previewImage');
            const label = document.querySelector('.file-upload-label');
            if (filePreview) filePreview.style.display = 'none';
            if (previewImage) previewImage.src = '';
            if (label) label.style.display = 'flex';
        }
    });
}

// Signup form submission
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        clearErrors();
        
        const fullName = fullNameInput ? fullNameInput.value.trim() : '';
        const username = usernameInput ? usernameInput.value.trim() : '';
        const email = signupEmailInput ? signupEmailInput.value.trim() : '';
        const phoneNumber = phoneInput ? phoneInput.value.trim() : '';
        const password = signupPasswordInput ? signupPasswordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
        const termsChecked = termsCheckbox ? termsCheckbox.checked : false;
        
        // Validate
        let hasError = false;
        
        if (!fullName) {
            if (fullNameError) fullNameError.textContent = 'Full name is required.';
            hasError = true;
        } else if (fullName.length < 2) {
            if (fullNameError) fullNameError.textContent = 'Full name must be at least 2 characters.';
            hasError = true;
        }
        
        if (!username) {
            if (usernameError) usernameError.textContent = 'Username is required.';
            hasError = true;
        } else if (!validateUsername(username)) {
            if (usernameError) usernameError.textContent = 'Username must be 3-20 characters (letters, numbers, underscore only).';
            hasError = true;
        }
        
        if (!email) {
            if (signupEmailError) signupEmailError.textContent = 'Email is required.';
            hasError = true;
        } else if (!validateEmail(email)) {
            if (signupEmailError) signupEmailError.textContent = 'Please enter a valid email address.';
            hasError = true;
        }
        
        if (!password) {
            if (signupPasswordError) signupPasswordError.textContent = 'Password is required.';
            hasError = true;
        } else if (!validatePassword(password)) {
            if (signupPasswordError) signupPasswordError.textContent = 'Password must be at least 6 characters.';
            hasError = true;
        }
        
        if (!confirmPassword) {
            if (confirmPasswordError) confirmPasswordError.textContent = 'Please confirm your password.';
            hasError = true;
        } else if (password !== confirmPassword) {
            if (confirmPasswordError) confirmPasswordError.textContent = 'Passwords do not match.';
            hasError = true;
        }
        
        if (!termsChecked) {
            if (termsError) termsError.textContent = 'You must agree to the Terms of Service and Privacy Policy.';
            hasError = true;
        }
        
        if (hasError) return;
        
        setLoading(true, signupBtn);
        
        // Get profile picture (if any)
        let profilePicture = '';
        if (profilePictureInput && profilePictureInput.files && profilePictureInput.files[0]) {
            const file = profilePictureInput.files[0];
            const reader = new FileReader();
            // For now, we'll use a placeholder
            // In production, upload to Firebase Storage
            profilePicture = URL.createObjectURL(file);
        }
        
        const result = await registerUser({
            fullName,
            username,
            email,
            phoneNumber,
            password,
            profilePicture
        });
        
        setLoading(false, signupBtn);
        
        if (result.success) {
            const authError = document.getElementById('authError');
            if (authError) {
                authError.style.display = 'block';
                authError.style.background = '#10b981';
                authError.style.color = '#fff';
                authError.textContent = '✅ Account created successfully! Redirecting...';
            }
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } else {
            showError(result.error);
        }
    });
}

// Google signup
if (googleSignup) {
    googleSignup.addEventListener('click', async () => {
        setLoading(true, signupBtn);
        const result = await loginWithGoogle(false);
        setLoading(false, signupBtn);
        
        if (result.success) {
            window.location.href = 'index.html';
        } else {
            showError(result.error);
        }
    });
}

// ============================================
// AUTO-REDIRECT IF LOGGED IN
// ============================================
// Check if on login or signup page and user is already logged in
const currentPage = window.location.pathname.split('/').pop();
if ((currentPage === 'login.html' || currentPage === 'signup.html') && auth.currentUser) {
    // Optional: Redirect to home
    // window.location.href = 'index.html';
}

// ============================================
// EXPORT FUNCTIONS
// ============================================
export {
    // Firebase instances
    app,
    analytics,
    auth,
    db,
    storage,
    
    // Auth providers
    googleProvider,
    facebookProvider,
    twitterProvider,
    githubProvider,
    
    // Core auth functions
    registerUser,
    loginUser,
    loginWithGoogle,
    logoutUser,
    resetPassword,
    updateUserProfile,
    changePassword,
    deleteAccount,
    
    // Helper functions
    isUsernameTaken,
    isEmailTaken,
    getCurrentUserData,
    onAuthStateChangedListener,
    handleRedirectResult,
    
    // Utility
    validateEmail,
    validateUsername,
    validatePassword,
    showError,
    setLoading,
    clearErrors
};

console.log('✅ Auth module ready!');
