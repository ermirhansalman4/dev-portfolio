import { db } from './firebase.js';
import { collection, addDoc, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { listenAuthState } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Theme Management
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    
    if (themeToggle) {
        themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeToggle.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            themeToggle.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        });
    }

    // Dynamic Year in Footer
    const yearEl = document.getElementById('year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    // Analytics (Visitor Tracking)
    trackVisitor();

    // Setup Dynamic Navbar
    setupNavbar();
    
    // Init Custom Cursor & Spotlight
    initCustomCursor();
});

function setupNavbar() {
    const navLinks = document.getElementById('nav-links');
    if (!navLinks) return;

    listenAuthState((user) => {
        const currentPath = window.location.pathname;
        const isIndex = currentPath.endsWith('index.html') || currentPath === '/';
        const isProjects = currentPath.endsWith('projects.html');
        const isBlog = currentPath.endsWith('blog.html');

        if(user) {
            navLinks.innerHTML = `
                <li><a href="index.html" class="${isIndex ? 'active' : ''}">Ana Sayfa</a></li>
                <li><a href="projects.html" class="${isProjects ? 'active' : ''}">Projeler</a></li>
                <li><a href="blog.html" class="${isBlog ? 'active' : ''}">Blog</a></li>
                <li class="nav-item-relative">
                    <button id="noti-btn" class="icon-btn">
                        <i class="fas fa-bell"></i>
                        <span id="noti-count" class="badge" style="display:none">0</span>
                    </button>
                    <div id="noti-dropdown" class="noti-dropdown glass" style="display:none">
                        <div class="noti-header">Bildirimler</div>
                        <div id="noti-list" class="noti-list">
                            <p class="text-center p-3 text-muted">Bildirim yok</p>
                        </div>
                    </div>
                </li>
                <li><a href="admin.html" class="btn btn-primary btn-sm" style="color:white">Panelim</a></li>
                <li><button id="theme-toggle-nav" class="icon-btn"><i class="fas fa-moon"></i></button></li>
            `;
            // Bildirimleri dinle
            initNotifications(user.uid);
        } else {
            navLinks.innerHTML = `
                <li><a href="index.html" class="${isIndex ? 'active' : ''}">Ana Sayfa</a></li>
                <li><a href="projects.html" class="${isProjects ? 'active' : ''}">Projeler</a></li>
                <li><a href="blog.html" class="${isBlog ? 'active' : ''}">Blog</a></li>
                <li><a href="login.html">Giriş Yap</a></li>
                <li><a href="register.html" class="btn btn-primary btn-sm" style="color:white">Kayıt Ol</a></li>
                <li><button id="theme-toggle-nav" class="icon-btn"><i class="fas fa-moon"></i></button></li>
            `;
        }

        // Re-attach theme toggle listener for the new button
        const themeBtn = document.getElementById('theme-toggle-nav');
        if(themeBtn) {
            const html = document.documentElement;
            themeBtn.innerHTML = html.getAttribute('data-theme') === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            themeBtn.addEventListener('click', () => {
                const current = html.getAttribute('data-theme');
                const newTheme = current === 'dark' ? 'light' : 'dark';
                html.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                themeBtn.innerHTML = newTheme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            });
        }
    });
}

async function trackVisitor() {
    if (sessionStorage.getItem('visited')) return;
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        
        await addDoc(collection(db, "visitors"), {
            ip: data.ip,
            timestamp: new Date()
        });
        sessionStorage.setItem('visited', 'true');
    } catch (err) {
        console.error("Ziyaretçi takip hatası:", err);
    }
}
// Global Toast Function
window.showToast = (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// Custom Cursor & Spotlight Logic
function initCustomCursor() {
    // Sadece masaüstünde çalışsın
    if (window.innerWidth < 768) return;

    const cursor = document.createElement('div');
    const follower = document.createElement('div');
    const glow = document.createElement('div');
    
    cursor.className = 'custom-cursor';
    follower.className = 'cursor-follower';
    glow.className = 'cursor-glow';
    
    document.body.appendChild(cursor);
    document.body.appendChild(follower);
    document.body.appendChild(glow);

    let requestRef;
    document.addEventListener('mousemove', (e) => {
        if (requestRef) cancelAnimationFrame(requestRef);
        
        requestRef = requestAnimationFrame(() => {
            const x = e.clientX;
            const y = e.clientY;
            
            cursor.style.transform = `translate3d(${x - 5}px, ${y - 5}px, 0)`;
            follower.style.transform = `translate3d(${x - 20}px, ${y - 20}px, 0)`;
            glow.style.transform = `translate3d(${x - 300}px, ${y - 300}px, 0)`;
        });
    });

    // İnteraktif öğelere gelince imleci büyüt
    const updateInteractiveElements = () => {
        const elements = document.querySelectorAll('a, button, .card, .btn, .tag, .sidebar-nav li');
        elements.forEach(el => {
            el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
            el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
        });
    };
    
    updateInteractiveElements();
    
    // Dinamik içerikler için daha seyrek kontrol
    setInterval(updateInteractiveElements, 5000);
}

// Real-time Notifications Listener
function initNotifications(uid) {
    const notiBtn = document.getElementById('noti-btn');
    const notiDropdown = document.getElementById('noti-dropdown');
    const notiCount = document.getElementById('noti-count');
    const notiList = document.getElementById('noti-list');

    if(!notiBtn) return;

    notiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notiDropdown.style.display = notiDropdown.style.display === 'none' ? 'block' : 'none';
        
        // Bildirimleri okundu olarak işaretleme mantığı buraya eklenebilir
    });

    document.addEventListener('click', () => {
        if(notiDropdown) notiDropdown.style.display = 'none';
    });

    // Firebase Listener
    const q = query(collection(db, "notifications"), where("recipientId", "==", uid), orderBy("createdAt", "desc"), limit(20));
    
    onSnapshot(q, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const unreadCount = notifications.filter(n => !n.isRead).length;

        if (unreadCount > 0) {
            notiCount.textContent = unreadCount;
            notiCount.style.display = 'block';
        } else {
            notiCount.style.display = 'none';
        }

        if (notifications.length === 0) {
            notiList.innerHTML = '<p class="text-center p-3 text-muted">Bildirim yok</p>';
            return;
        }

        notiList.innerHTML = notifications.map(n => `
            <div class="noti-item ${n.isRead ? '' : 'unread'}" onclick="window.location.href='${n.link || '#'}'">
                <p><strong>${n.senderName}</strong> ${n.message}</p>
                <small>${n.createdAt ? new Date(n.createdAt.seconds * 1000).toLocaleString('tr-TR') : 'Şimdi'}</small>
            </div>
        `).join('');
    });
}

// Global Custom Confirm
window.showConfirm = (title, message) => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        overlay.innerHTML = `
            <div class="confirm-modal glass">
                <h3>${title}</h3>
                <p>${message}</p>
                <div class="modal-actions">
                    <button id="confirm-no" class="btn btn-outline btn-sm">Vazgeç</button>
                    <button id="confirm-yes" class="btn btn-primary btn-sm">Evet, Sil</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Disable scroll
        document.body.style.overflow = 'hidden';

        const close = (result) => {
            document.body.removeChild(overlay);
            document.body.style.overflow = 'auto';
            resolve(result);
        };

        document.getElementById('confirm-yes').addEventListener('click', () => close(true));
        document.getElementById('confirm-no').addEventListener('click', () => close(false));
        overlay.addEventListener('click', (e) => {
            if(e.target === overlay) close(false);
        });
    });
};
