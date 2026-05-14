import { listenAuthState, logout } from './auth.js';
import { getUserProjects, addProject, deleteProject } from './projects.js';
import { getUserPosts, addPost, deletePost } from './blog.js';
import { db, auth } from './firebase.js';
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { sendNotification } from './projects.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const adminDashboard = document.getElementById('admin-dashboard');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');

    // View Management
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a[data-target]');
    const views = document.querySelectorAll('.admin-view');

    // View Management Function
    window.switchAdminView = (targetId) => {
        console.log("Görünüm değiştiriliyor:", targetId);

        // Önce linkleri güncelle
        sidebarLinks.forEach(l => {
            if (l.getAttribute('data-target') === targetId) l.classList.add('active');
            else l.classList.remove('active');
        });

        // Sonra sayfaları güncelle
        views.forEach(v => {
            v.style.display = 'none';
            v.classList.remove('active');
        });

        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.style.display = 'block';
            targetView.classList.add('active');

            // Verileri yükle
            if (auth.currentUser) {
                const uid = auth.currentUser.uid;
                if (targetId === 'view-dashboard') loadDashboardStats().catch(console.error);
                if (targetId === 'view-projects') loadAdminProjects(uid).catch(console.error);
                if (targetId === 'view-blog') loadAdminBlog(uid).catch(console.error);
                if (targetId === 'view-connections') loadAdminConnections(uid).catch(console.error);
            }
        }
    };

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            window.location.hash = target.replace('view-', '');
            window.switchAdminView(target);
        });
    });

    // Sayfa ilk açıldığında veya URL değiştiğinde (hash) kontrol et
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '');
        if (hash) window.switchAdminView('view-' + hash);
    });

    // Auth state listener
    listenAuthState((user) => {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            console.log("Kullanıcı doğrulandı:", user.uid);

            // Mevcut hash'e göre görünümü ayarla
            const hash = window.location.hash.replace('#', '');
            if (hash && ['dashboard', 'projects', 'blog', 'connections'].includes(hash)) {
                window.switchAdminView('view-' + hash);
            } else {
                window.switchAdminView('view-dashboard');
            }
        }
    });

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    }

    // Projects Management
    const btnNewProject = document.getElementById('btn-new-project');
    const projectForm = document.getElementById('project-form');
    const btnCancelProject = document.getElementById('btn-cancel-project');
    const formProject = document.getElementById('project-form');

    if (btnNewProject) btnNewProject.addEventListener('click', () => {
        projectForm.style.display = 'block';
        formProject.reset();
    });
    if (btnCancelProject) btnCancelProject.addEventListener('click', () => projectForm.style.display = 'none');

    // Fake AI Description
    const btnAiDesc = document.getElementById('btn-ai-desc');
    if (btnAiDesc) {
        btnAiDesc.addEventListener('click', () => {
            const title = document.getElementById('project-title').value || 'Bu proje';
            const templates = [
                `${title}, modern web teknolojileri kullanılarak geliştirilmiş, kullanıcı deneyimini ön planda tutan dinamik bir uygulamadır. Ölçeklenebilir yapısı ile yüksek performans sunar.`,
                `Yenilikçi arayüzü ve güçlü altyapısıyla ${title}, ihtiyaçlara özel olarak tasarlanmış tam yığın (full-stack) bir çözümdür. Güvenli ve hızlı bir deneyim hedeflenmiştir.`,
                `Gelişmiş mimarisi ile öne çıkan ${title}, sektör standartlarına uygun olarak inşa edilmiştir. Estetik tasarım ve işlevsellik bir arada sunulmaktadır.`
            ];
            const randomDesc = templates[Math.floor(Math.random() * templates.length)];
            document.getElementById('project-description').value = randomDesc;
        });
    }

    // Collaboration Tagging
        const btnCollabSearch = document.getElementById('btn-collab-search');
        const collabSearchInput = document.getElementById('collab-search');
        const collabList = document.getElementById('collab-list');
        let selectedCollabs = [];

        if (btnCollabSearch) {
            btnCollabSearch.addEventListener('click', async () => {
                const email = collabSearchInput.value.trim();
                if (!email) return;

                btnCollabSearch.disabled = true;
                btnCollabSearch.textContent = "...";

                try {
                    const q = query(collection(db, "users"), where("email", "==", email));
                    const snap = await getDocs(q);

                    if (snap.empty) {
                        showToast("Kullanıcı bulunamadı.", "error");
                    } else {
                        const userData = { id: snap.docs[0].id, ...snap.docs[0].data() };
                        if (selectedCollabs.find(c => c.id === userData.id)) {
                            showToast("Bu kişi zaten eklendi.", "info");
                        } else if (userData.id === auth.currentUser.uid) {
                            showToast("Kendinizi ortak olarak ekleyemezsiniz.", "info");
                        } else {
                            selectedCollabs.push(userData);
                            renderCollabs();
                            collabSearchInput.value = '';
                            showToast(`${userData.displayName || userData.email} eklendi!`, "success");
                        }
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Arama sırasında hata oluştu.", "error");
                } finally {
                    btnCollabSearch.disabled = false;
                    btnCollabSearch.textContent = "Ara";
                }
            });
        }

        function renderCollabs() {
            if (!collabList) return;
            collabList.innerHTML = selectedCollabs.map(c => `
            <span class="tag" style="background: rgba(59, 130, 246, 0.2); padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px;">
                ${c.displayName || c.email}
                <i class="fas fa-times" style="cursor: pointer;" onclick="window.removeCollab('${c.id}')"></i>
            </span>
        `).join('');
        }

        window.removeCollab = (id) => {
            selectedCollabs = selectedCollabs.filter(c => c.id !== id);
            renderCollabs();
        };

        if (formProject) {
            formProject.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btnSubmit = formProject.querySelector('button[type="submit"]');
                btnSubmit.textContent = "Kaydediliyor...";
                btnSubmit.disabled = true;

                try {
                    let imageUrl = document.getElementById('project-image-url').value;

                    const data = {
                        title: document.getElementById('project-title').value,
                        description: document.getElementById('project-description').value,
                        imageUrl: imageUrl || '',
                        videoUrl: document.getElementById('project-video-url').value,
                        fileUrl: document.getElementById('project-file-url').value,
                        technologies: document.getElementById('project-techs').value.split(',').map(t => t.trim()).filter(t => t),
                        githubUrl: document.getElementById('project-github').value,
                        liveUrl: document.getElementById('project-live').value,
                        collaborators: selectedCollabs.map(c => ({ id: c.id, name: c.displayName || c.email }))
                    };

                    const newProjectId = await addProject(data);

                    // İş ortaklarına bildirim gönder
                    for (const collab of selectedCollabs) {
                        await sendNotification(collab.id, {
                            senderName: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
                            message: `sizi "${data.title}" projesinde iş ortağı olarak etiketledi.`,
                            link: `project-detail.html?slug=${data.slug || ''}`, // Slug henüz yoksa detail sayfasında slug ile arayacak
                            type: 'tag'
                        });
                    }

                    projectForm.style.display = 'none';
                    selectedCollabs = [];
                    renderCollabs();
                    formProject.reset();
                    const currentUser = auth.currentUser;
                    if (currentUser) loadAdminProjects(currentUser.uid);
                    loadDashboardStats();
                    showToast("Proje başarıyla eklendi!", "success");
                } catch (err) {
                    console.error(err);
                    showToast("Proje eklenirken bir hata oluştu.", "error");
                } finally {
                    btnSubmit.textContent = "Kaydet";
                    btnSubmit.disabled = false;
                }
            });
        }

        // Blog Management
        const btnNewPost = document.getElementById('btn-new-post');
        const postForm = document.getElementById('post-form');
        const btnCancelPost = document.getElementById('btn-cancel-post');
        const formPost = document.getElementById('post-form');

        if (btnNewPost) btnNewPost.addEventListener('click', () => {
            postForm.style.display = 'block';
            formPost.reset();
        });
        if (btnCancelPost) btnCancelPost.addEventListener('click', () => postForm.style.display = 'none');

        if (formPost) {
            formPost.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btnSubmit = formPost.querySelector('button[type="submit"]');
                btnSubmit.textContent = "Kaydediliyor...";
                btnSubmit.disabled = true;

                try {
                    const data = {
                        title: document.getElementById('post-title').value,
                        content: document.getElementById('post-content').value,
                        tags: document.getElementById('post-tags').value.split(',').map(t => t.trim()).filter(t => t)
                    };

                    await addPost(data);
                    postForm.style.display = 'none';
                    formPost.reset();
                    const currentUser = auth.currentUser;
                    if (currentUser) loadAdminBlog(currentUser.uid);
                    loadDashboardStats();
                    showToast("Yazı başarıyla eklendi!", "success");
                } catch (err) {
                    console.error(err);
                    showToast("Yazı eklenirken bir hata oluştu.", "error");
                } finally {
                    btnSubmit.textContent = "Kaydet";
                    btnSubmit.disabled = false;
                }
            });
        }

    // Helper Functions
    async function loadAdminProjects(uid) {
        if (!uid) return;
        const tbody = document.getElementById('admin-projects-list');
        if (!tbody) return;

        try {
            const projects = await getUserProjects(uid);
            tbody.innerHTML = '';
            if (projects.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Proje bulunamadı.</td></tr>';
                return;
            }

            projects.forEach(p => {
                const tr = document.createElement('tr');
                const dateStr = p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-';
                tr.innerHTML = `
                <td>${p.title}</td>
                <td>${dateStr}</td>
                <td>
                    <button class="btn btn-sm btn-outline btn-delete-project" data-id="${p.id}"><i class="fas fa-trash"></i> Sil</button>
                </td>
            `;
                tbody.appendChild(tr);
            });

            // Delete handlers
            document.querySelectorAll('.btn-delete-project').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const confirmed = await showConfirm("Projeyi Sil", "Bu projeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.");
                    if (confirmed) {
                        const id = e.currentTarget.getAttribute('data-id');
                        await deleteProject(id);
                        const currentUser = auth.currentUser;
                        if (currentUser) loadAdminProjects(currentUser.uid);
                        loadDashboardStats();
                        showToast("Proje başarıyla silindi.", "success");
                    }
                });
            });
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="3">Yükleme hatası.</td></tr>';
        }
    }

    async function loadAdminBlog(uid) {
        if (!uid) return;
        const tbody = document.getElementById('admin-blog-list');
        if (!tbody) return;

        try {
            const posts = await getUserPosts(uid);
            tbody.innerHTML = '';
            if (posts.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Yazı bulunamadı.</td></tr>';
                return;
            }

            posts.forEach(p => {
                const tr = document.createElement('tr');
                const dateStr = p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-';
                tr.innerHTML = `
                <td>${p.title}</td>
                <td>${dateStr}</td>
                <td>
                    <button class="btn btn-sm btn-outline btn-delete-post" data-id="${p.id}"><i class="fas fa-trash"></i> Sil</button>
                </td>
            `;
                tbody.appendChild(tr);
            });

            // Delete handlers
            document.querySelectorAll('.btn-delete-post').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const confirmed = await showConfirm("Yazıyı Sil", "Bu blog yazısını silmek istediğinize emin misiniz?");
                    if (confirmed) {
                        const id = e.currentTarget.getAttribute('data-id');
                        await deletePost(id);
                        const currentUser = auth.currentUser;
                        if (currentUser) loadAdminBlog(currentUser.uid);
                        loadDashboardStats();
                        showToast("Yazı başarıyla silindi.", "success");
                    }
                });
            });
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="3">Yükleme hatası.</td></tr>';
        }
    }

    async function loadAdminConnections(uid) {
        if (!uid) return;
        const tbody = document.getElementById('admin-connections-list');
        if (!tbody) return;

        try {
            const connections = await getUserConnections(uid);
            tbody.innerHTML = '';
            if (connections.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3">Henüz bir bağlantınız yok.</td></tr>';
                return;
            }

            for (const conn of connections) {
                // Get user info for name
                const userSnap = await getDoc(doc(db, "users", conn.followedId));
                const userData = userSnap.exists() ? userSnap.data() : { displayName: 'Bilinmeyen Kullanıcı' };
                
                const tr = document.createElement('tr');
                const dateStr = conn.createdAt ? new Date(conn.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-';
                tr.innerHTML = `
                <td><a href="profile.html?uid=${conn.followedId}" style="color: var(--primary-color); font-weight: 600;">${userData.displayName || userData.email}</a></td>
                <td>${dateStr}</td>
                <td>
                    <button class="btn btn-sm btn-outline btn-delete-conn" data-target="${conn.followedId}"><i class="fas fa-user-minus"></i> Bağlantıyı Kes</button>
                </td>
            `;
                tbody.appendChild(tr);
            }

            // Delete handlers
            document.querySelectorAll('.btn-delete-conn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (await showConfirm("Bağlantıyı Kes", "Bu kişiyle bağlantınızı kesmek istediğinize emin misiniz?")) {
                        const targetId = e.currentTarget.getAttribute('data-target');
                        await toggleConnection(targetId);
                        loadAdminConnections(uid);
                        showToast("Bağlantı kesildi.", "info");
                    }
                });
            });
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="3">Yükleme hatası.</td></tr>';
        }
    }

    let visitorsChartInstance = null;

    async function loadDashboardStats() {
        const uid = auth.currentUser ? auth.currentUser.uid : null;
        if (!uid) return;

        try {
            // Count projects & posts
            const projects = await getUserProjects(uid);
            document.getElementById('stat-projects').textContent = projects.length;

            const posts = await getUserPosts(uid);
            document.getElementById('stat-blog').textContent = posts.length;

            // Fetch visitors
            const q = query(collection(db, "visitors"), orderBy("timestamp", "asc"));
            const snap = await getDocs(q);
            document.getElementById('stat-visitors').textContent = snap.docs.length;

            // Prepare chart data (group by date)
            const dateCounts = {};
            snap.docs.forEach(doc => {
                const data = doc.data();
                if (data.timestamp) {
                    const dateStr = new Date(data.timestamp.seconds * 1000).toLocaleDateString('tr-TR');
                    dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
                }
            });

            const labels = Object.keys(dateCounts);
            const dataValues = Object.values(dateCounts);

            const ctx = document.getElementById('visitorsChart');
            if (!ctx) return;

            if (visitorsChartInstance) {
                visitorsChartInstance.destroy();
            }

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const textColor = isDark ? '#f8fafc' : '#1e293b';

            visitorsChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels.length ? labels : ['Henüz veri yok'],
                    datasets: [{
                        label: 'Günlük Ziyaretçi',
                        data: dataValues.length ? dataValues : [0],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: textColor } }
                    },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } },
                        y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } }
                    }
                }
            });
        } catch(e) {
            console.error("Dashboard verileri yüklenemedi:", e);
        }
    }
});
