import { db, auth } from './firebase.js';
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, limit, where, updateDoc, increment, serverTimestamp, getDoc, setDoc } from "firebase/firestore";

const collectionName = "projects";

export const getAllProjects = async () => {
    const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getLatestProjects = async (count) => {
    const q = query(collection(db, collectionName), orderBy("createdAt", "desc"), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUserProjects = async (uid) => {
    const q = query(collection(db, collectionName), where("authorId", "==", uid));
    const snap = await getDocs(q);
    const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Hafızada sıralama (Endeks gerektirmez)
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

export const getProjectBySlug = async (slug) => {
    const q = query(collection(db, collectionName), where("slug", "==", slug), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const addProject = async (data) => {
    // Generate slug from title
    data.slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    data.createdAt = new Date();
    
    // Yazar bilgilerini ekle
    const user = auth.currentUser;
    if (user) {
        data.authorId = user.uid;
        data.authorName = user.displayName || user.email.split('@')[0];
    }

    return await addDoc(collection(db, collectionName), data);
};

export const deleteProject = async (id) => {
    await deleteDoc(doc(db, collectionName, id));
};

// --- Sosyal Etkileşim Fonksiyonları ---

// Beğeni Ekle/Kaldır
export const toggleLike = async (projectId) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Giriş yapmalısınız");

    const likeId = `${user.uid}_${projectId}`;
    const likeRef = doc(db, "likes", likeId);
    const projectRef = doc(db, collectionName, projectId);
    
    const likeDoc = await getDoc(likeRef);
    
    if (likeDoc.exists()) {
        await deleteDoc(likeRef);
        await updateDoc(projectRef, { likesCount: increment(-1) });
        return false; // Beğeni kaldırıldı
    } else {
        await setDoc(likeRef, { userId: user.uid, projectId, createdAt: serverTimestamp() });
        await updateDoc(projectRef, { likesCount: increment(1) });
        
        // Bildirim Gönder
        const projectDoc = await getDoc(projectRef);
        if (projectDoc.exists() && projectDoc.data().authorId !== user.uid) {
            await sendNotification(projectDoc.data().authorId, {
                senderName: user.displayName || user.email.split('@')[0],
                message: `"${projectDoc.data().title}" projenizi beğendi.`,
                link: `project-detail.html?slug=${projectDoc.data().slug}`,
                type: 'like'
            });
        }
        return true; // Beğenildi
    }
};

// Yorum Ekle
export const addComment = async (projectId, text) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Giriş yapmalısınız");

    await addDoc(collection(db, "comments"), {
        projectId,
        userId: user.uid,
        userName: user.displayName || user.email.split('@')[0],
        text,
        createdAt: serverTimestamp()
    });
    
    const projectRef = doc(db, collectionName, projectId);
    await updateDoc(projectRef, { commentsCount: increment(1) });

    // Bildirim Gönder
    const projectDoc = await getDoc(projectRef);
    if (projectDoc.exists() && projectDoc.data().authorId !== user.uid) {
        await sendNotification(projectDoc.data().authorId, {
            senderName: user.displayName || user.email.split('@')[0],
            message: `projenize yorum yaptı: "${text.substring(0, 30)}..."`,
            link: `project-detail.html?slug=${projectDoc.data().slug}`,
            type: 'comment'
        });
    }
};

// Bağlantı Kur (Takip)
export const toggleConnection = async (targetUserId) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Giriş yapmalısınız");
    if (user.uid === targetUserId) throw new Error("Kendinizle bağlantı kuramazsınız");

    const connId = `${user.uid}_${targetUserId}`;
    const connRef = doc(db, "connections", connId);
    const connDoc = await getDoc(connRef);

    if (connDoc.exists()) {
        await deleteDoc(connRef);
        return false;
    } else {
        await setDoc(connRef, { followerId: user.uid, followedId: targetUserId, createdAt: serverTimestamp() });
        
        // Bildirim Gönder
        await sendNotification(targetUserId, {
            senderName: user.displayName || user.email.split('@')[0],
            message: `sizinle bağlantı kurdu.`,
            link: `profile.html?uid=${user.uid}`,
            type: 'connection'
        });
        return true;
    }
};

// Akıllı Keşfet Algoritması
export const getDiscoveryProjects = async (filterType = 'popular') => {
    const user = auth.currentUser;
    const snap = await getDocs(collection(db, collectionName));
    let projects = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Eğer giriş yapmışsa bağlantılarını çek
    let myConnections = [];
    if (user) {
        try {
            const connSnap = await getDocs(query(collection(db, "connections"), where("followerId", "==", user.uid)));
            myConnections = connSnap.docs.map(d => d.data().followedId);
        } catch (connErr) {
            console.warn("Bağlantılar çekilemedi (Muhtemelen Rules güncellenmedi):", connErr);
            // Hata olsa da devam et, sadece bağlantı önceliği çalışmaz
        }
    }

    // Sıralama Mantığı
    projects.sort((a, b) => {
        // 1. Bağlantı Önceliği
        if (user) {
            const aConn = myConnections.includes(a.authorId) ? 1 : 0;
            const bConn = myConnections.includes(b.authorId) ? 1 : 0;
            if (aConn !== bConn) return bConn - aConn;
        }

        // 2. Filtreye Göre Sıralama
        if (filterType === 'popular') {
            return (b.likesCount || 0) - (a.likesCount || 0);
        } else {
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        }
    });

    return projects;
};

export const getProjectComments = async (projectId) => {
    const q = query(collection(db, "comments"), where("projectId", "==", projectId));
    const snap = await getDocs(q);
    const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Hafızada sıralama (Endeks gerektirmez)
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

// Bildirim Yardımcı Fonksiyonu
export const sendNotification = async (recipientId, data) => {
    if (!recipientId || recipientId === auth.currentUser?.uid) return;
    try {
        await addDoc(collection(db, "notifications"), {
            recipientId,
            senderId: auth.currentUser.uid,
            senderName: data.senderName,
            message: data.message,
            link: data.link,
            type: data.type,
            isRead: false,
            createdAt: serverTimestamp()
        });
    } catch (err) {
        console.error("Bildirim gönderme hatası:", err);
    }
};
