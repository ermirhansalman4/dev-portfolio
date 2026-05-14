import { db } from './firebase.js';
import { collection, addDoc } from "firebase/firestore";
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
                <li><a href="admin.html" class="btn btn-primary btn-sm" style="color:white">Panelim</a></li>
                <li><button id="theme-toggle-nav" class="icon-btn"><i class="fas fa-moon"></i></button></li>
            `;
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

    document.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        
        cursor.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
        follower.style.transform = `translate(${x - 20}px, ${y - 20}px)`;
        glow.style.transform = `translate(${x - 300}px, ${y - 300}px)`;
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
    
    // Dinamik içerikler için (yorumlar vb.) periyodik kontrol
    setInterval(updateInteractiveElements, 2000);
}
