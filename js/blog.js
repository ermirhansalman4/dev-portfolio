import { db, auth } from './firebase.js';
import { collection, addDoc, getDocs, doc, deleteDoc, query, orderBy, limit, where } from "firebase/firestore";

const collectionName = "posts";

export const getAllPosts = async () => {
    const q = query(collection(db, collectionName), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUserPosts = async (uid) => {
    const q = query(collection(db, collectionName), where("authorId", "==", uid));
    const snap = await getDocs(q);
    const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Hafızada sıralama
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
};

export const getPostBySlug = async (slug) => {
    const q = query(collection(db, collectionName), where("slug", "==", slug), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const addPost = async (data) => {
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

export const deletePost = async (id) => {
    await deleteDoc(doc(db, collectionName, id));
};
