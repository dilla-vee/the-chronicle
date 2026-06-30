// app.js - SPA Router, State Manager, and Interactions for The Chronicle

// --- FIREBASE CONFIGURATION & INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDxbx8Tp5-VI5hHGv-6oU4oZv0rmPrNWJg",
  authDomain: "the-chronicle-70db1.firebaseapp.com",
  projectId: "the-chronicle-70db1",
  storageBucket: "the-chronicle-70db1.firebasestorage.app",
  messagingSenderId: "21600753974",
  appId: "1:21600753974:web:4acf378a7c830dbe61fb97",
  measurementId: "G-J3YWY03755"
};

// Initialize Firebase with proper error handling
let auth = null;
let db = null;
let firebaseReady = false;

try {
  if (window.firebase && firebase.initializeApp) {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseReady = true;
    console.log("Firebase initialized successfully - using cloud storage");
    
    // Configure Firebase Auth to be more forgiving
    if (auth) {
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch((error) => {
          console.warn("Could not set auth persistence:", error);
        });
    }
  }
} catch (err) {
  console.warn("Firebase unavailable, using local demo mode:", err.message);
  auth = null;
  db = null;
  firebaseReady = false;
}

const DEMO_USERS = [
  {
    uid: 'demo-admin',
    name: 'System Admin',
    email: 'admin@thechronicle.com',
    password: 'admin123',
    role: 'Admin',
    authorTitle: 'Publication Administrator',
    bookmarks: []
  },
  {
    uid: 'demo-author-julian',
    name: 'Julian Thorne',
    email: 'julian@thechronicle.com',
    password: 'password123',
    role: 'Author',
    authorTitle: 'Culture Correspondent',
    bookmarks: []
  },
  {
    uid: 'demo-author-eleanor',
    name: 'Eleanor Jenkins',
    email: 'eleanor@thechronicle.com',
    password: 'password123',
    role: 'Author',
    authorTitle: 'Political Analyst',
    bookmarks: []
  },
  {
    uid: 'demo-reader-elena',
    name: 'Elena Rossi',
    email: 'elena@reader.com',
    password: 'password123',
    role: 'Reader',
    authorTitle: '',
    bookmarks: []
  }
];

function getLocalUsers() {
  const savedUsers = localStorage.getItem('chronicle_local_users');
  let users = [];
  if (savedUsers) {
    try {
      users = JSON.parse(savedUsers);
    } catch (e) {
      users = [];
    }
  }

  DEMO_USERS.forEach(demoUser => {
    if (!users.some(user => user.email.toLowerCase() === demoUser.email.toLowerCase())) {
      users.push({ ...demoUser });
    }
  });

  localStorage.setItem('chronicle_local_users', JSON.stringify(users));
  console.log('Local users loaded:', users.map(u => ({ email: u.email, role: u.role })));
  return users;
}

function stripPrivateUserFields(user) {
  if (!user) return null;
  const { password, ...publicUser } = user;
  return { ...publicUser, localOnly: true };
}

function findLocalUser(email, password) {
  return getLocalUsers().find(user =>
    user.email.toLowerCase() === email.toLowerCase() && user.password === password
  );
}

function createLocalUser({ name, email, password, role, authorTitle }) {
  const users = getLocalUsers();
  if (users.some(user => user.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("An account with this email already exists.");
  }

  const user = {
    uid: `local-${Date.now()}`,
    name,
    email,
    password,
    role,
    authorTitle: role === 'Author' ? authorTitle : '',
    bookmarks: []
  };
  users.push(user);
  localStorage.setItem('chronicle_local_users', JSON.stringify(users));
  return stripPrivateUserFields(user);
}

function getLocalArticles() {
  const savedArticles = localStorage.getItem('chronicle_articles');
  if (savedArticles) {
    try {
      return JSON.parse(savedArticles);
    } catch (e) {
      localStorage.removeItem('chronicle_articles');
    }
  }

  const initialArticles = (window.INITIAL_ARTICLES || []).map(article => ({
    ...article,
    images: article.images || [article.image],
    status: article.status || 'Approved',
    reads: article.reads || Math.floor(Math.abs(Math.sin(article.title.charCodeAt(0)) * 400)) + 50,
    reviews: article.reviews || [],
    comments: article.comments || [],
    createdAt: article.createdAt || Date.now()
  }));
  localStorage.setItem('chronicle_articles', JSON.stringify(initialArticles));
  return initialArticles;
}

function loadLocalArticles() {
  state.articles = getLocalArticles();
  renderCurrentView();
}

function updateLocalArticle(articleId, updates) {
  state.articles = getLocalArticles().map(article =>
    article.id === articleId ? { ...article, ...updates } : article
  );
  saveArticlesToStorage();
  renderCurrentView();
  return Promise.resolve();
}

function setLocalArticle(articleId, articleData) {
  const articles = getLocalArticles().filter(article => article.id !== articleId);
  articles.unshift({ ...articleData, id: articleId, createdAt: Date.now() });
  state.articles = articles;
  saveArticlesToStorage();
  renderCurrentView();
  return Promise.resolve();
}

function deleteLocalArticle(articleId) {
  state.articles = getLocalArticles().filter(article => article.id !== articleId);
  saveArticlesToStorage();
  renderCurrentView();
  return Promise.resolve();
}

function isLocalSession() {
  return !db || (state.currentUser && state.currentUser.localOnly);
}

function updateArticleRecord(articleId, updates) {
  if (isLocalSession()) {
    return updateLocalArticle(articleId, updates);
  }
  return db.collection('articles').doc(articleId).update(updates);
}

function setArticleRecord(articleId, articleData) {
  if (isLocalSession()) {
    return setLocalArticle(articleId, articleData);
  }
  return db.collection('articles').doc(articleId).set(articleData);
}

function deleteArticleRecord(articleId) {
  if (isLocalSession()) {
    return deleteLocalArticle(articleId);
  }
  return db.collection('articles').doc(articleId).delete();
}

// 1. APPLICATION STATE & LOCALSTORAGE WRAPPERS
let state = {
  articles: [],
  currentUser: null, // { name, email, role, authorTitle }
  currentView: 'home', // 'home', 'article', 'write', 'admin'
  selectedArticleId: null,
  activeCategory: 'All',
  searchQuery: '',
  adminActiveTab: 'pending', // 'pending', 'published'
  theme: 'light',
  bookmarks: [],
  authorSortBy: 'date',
  homeSortBy: 'date',
  uploadedImageUrl: null
};

function listenToArticles() {
  if (!db) {
    loadLocalArticles();
    return;
  }

  db.collection('articles').orderBy('createdAt', 'desc').onSnapshot(async (snapshot) => {
    if (snapshot.empty) {
      // Seed database if it's completely empty!
      console.log("Firestore articles collection is empty. Seeding INITIAL_ARTICLES...");
      const batch = db.batch();
      const initial = window.INITIAL_ARTICLES || [];
      initial.forEach(art => {
        const docRef = db.collection('articles').doc(art.id);
        batch.set({
          title: art.title,
          subtitle: art.subtitle,
          category: art.category,
          author: art.author,
          date: art.date,
          readTime: art.readTime,
          image: art.image,
          images: art.images || [art.image],
          content: art.content,
          status: 'Approved',
          reads: art.reads || Math.floor(Math.abs(Math.sin(art.title.charCodeAt(0)) * 400)) + 50,
          reviews: art.reviews || [],
          comments: art.comments || [],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      try {
        await batch.commit();
        console.log("Seeding successful!");
      } catch (err) {
        console.error("Error seeding articles:", err);
      }
      return;
    }

    state.articles = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      state.articles.push({
        id: doc.id,
        ...data
      });
    });

    // Re-render based on current view
    if (state.currentView === 'home') {
      renderHomeView();
    } else if (state.currentView === 'admin') {
      renderAdminView();
    } else if (state.currentView === 'write') {
      renderAuthorArticlesList();
    } else if (state.currentView === 'article' && state.selectedArticleId) {
      const activeArticle = state.articles.find(a => a.id === state.selectedArticleId);
      if (activeArticle) {
        renderComments(activeArticle);
        renderReviews(activeArticle);
      }
    }
  }, (err) => {
    console.error("Firestore listener error:", err);
    showToast("Database unavailable. Continuing in local demo mode.");
    loadLocalArticles();
  });
}

function initApp() {
  initScrollObserver(); // Initialize scroll reveal observer

  // Load theme preference
  const savedTheme = localStorage.getItem('chronicle_theme') || 'light';
  state.theme = savedTheme;
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    const moon = document.getElementById('theme-moon-svg');
    const sun = document.getElementById('theme-sun-svg');
    if (moon) moon.classList.add('hidden');
    if (sun) sun.classList.remove('hidden');
  }

  // Bind key listeners and sidebar DOM effects
  setupEventListeners();
  initAuthSidebarEffects();
  setupSignupBadgeSync();

  // Start syncing articles from Firestore
  listenToArticles();

  // Set up Firebase Auth state listener, or restore a local demo session.
  if (!auth) {
    const savedUser = localStorage.getItem('chronicle_user');
    if (savedUser) {
      try {
        state.currentUser = JSON.parse(savedUser);
        state.bookmarks = state.currentUser.bookmarks || [];
      } catch (e) {
        state.currentUser = null;
      }
    }
    updateUserInterface();
    renderCurrentView();
    return;
  }

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
          const udata = doc.data();
          state.currentUser = {
            uid: user.uid,
            name: udata.name,
            email: udata.email,
            role: udata.role,
            authorTitle: udata.authorTitle
          };
          state.bookmarks = udata.bookmarks || [];
        } else {
          // Fallback if user profile doesn't exist in Firestore
          state.currentUser = {
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            role: 'Reader',
            authorTitle: ''
          };
          state.bookmarks = [];
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      }
    } else {
      state.currentUser = null;
      // Load bookmarks from local storage for anonymous session
      const savedBookmarks = localStorage.getItem('chronicle_bookmarks');
      if (savedBookmarks) {
        try {
          state.bookmarks = JSON.parse(savedBookmarks);
        } catch(e) {
          state.bookmarks = [];
        }
      } else {
        state.bookmarks = [];
      }
    }
    updateUserInterface();
    renderCurrentView();
  });
}

function saveArticlesToStorage() {
  localStorage.setItem('chronicle_articles', JSON.stringify(state.articles));
}

function saveUserSession(user) {
  state.currentUser = user;
  if (user) {
    localStorage.setItem('chronicle_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('chronicle_user');
  }
  updateUserInterface();
}

// 2. ROUTING & VIEW CONTROLLERS
function navigateTo(view, articleId = null) {
  // Cancel speech synthesis immediately
  window.speechSynthesis.cancel();

  const views = {
    'home': document.getElementById('home-view'),
    'article': document.getElementById('article-view'),
    'write': document.getElementById('write-view'),
    'admin': document.getElementById('admin-view')
  };

  const currentActiveView = views[state.currentView];
  
  // Close any modal or popups
  document.getElementById('auth-modal').classList.add('hidden');
  
  // Start fade-out on current view
  if (currentActiveView) {
    currentActiveView.classList.add('fade-out');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  state.currentView = view;
  state.selectedArticleId = articleId;

  // Render after brief transition timeout
  setTimeout(() => {
    Object.keys(views).forEach(key => {
      views[key].classList.add('hidden');
      views[key].classList.remove('fade-out', 'fade-in');
    });

    const newActiveView = views[view];
    if (newActiveView) {
      newActiveView.classList.remove('hidden');
      newActiveView.classList.add('fade-in');

      // Trigger Skeleton Screens
      if (view === 'home') {
        renderSkeletonHome();
        setTimeout(() => {
          renderHomeView();
          newActiveView.classList.remove('fade-in');
        }, 250);
      } else if (view === 'article') {
        renderSkeletonArticle();
        setTimeout(() => {
          renderArticleDetailView();
          newActiveView.classList.remove('fade-in');
        }, 250);
      } else {
        renderCurrentView();
        newActiveView.classList.remove('fade-in');
      }
    }
  }, 150);
}

function renderCurrentView() {
  // Toggle visibility of top level sections
  const views = {
    'home': document.getElementById('home-view'),
    'article': document.getElementById('article-view'),
    'write': document.getElementById('write-view'),
    'admin': document.getElementById('admin-view')
  };

  Object.keys(views).forEach(key => {
    if (key === state.currentView) {
      views[key].classList.remove('hidden');
    } else {
      views[key].classList.add('hidden');
    }
  });

  // Render content depending on active view
  if (state.currentView === 'home') {
    renderHomeView();
  } else if (state.currentView === 'article') {
    renderArticleDetailView();
  } else if (state.currentView === 'write') {
    renderWriteView();
  } else if (state.currentView === 'admin') {
    renderAdminView();
  }
}

// 3. UI RENDERING ENGINES
function renderHomeView() {
  const featuredContainer = document.getElementById('featured-article-container');
  const gridContainer = document.getElementById('trending-articles-grid');
  const newsContainer = document.getElementById('latest-news-container');

  // Sync visual sort tabs
  document.querySelectorAll('.sort-tab').forEach(tab => {
    if (tab.dataset.sort === state.homeSortBy) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Filter articles based on active category, search query, and status (approved only)
  let filtered = state.articles.filter(a => a.status === 'Approved');

  if (state.activeCategory !== 'All') {
    filtered = filtered.filter(a => a.category.toLowerCase() === state.activeCategory.toLowerCase());
  }

  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(a => 
      a.title.toLowerCase().includes(q) || 
      a.subtitle.toLowerCase().includes(q) ||
      (a.content && a.content.toLowerCase().includes(q))
    );
  }

  // Sort based on homeSortBy state
  if (state.homeSortBy === 'date') {
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (state.homeSortBy === 'reads') {
    filtered.sort((a, b) => (b.reads || 0) - (a.reads || 0));
  } else if (state.homeSortBy === 'reviews') {
    filtered.sort((a, b) => (b.reviews ? b.reviews.length : 0) - (a.reviews ? a.reviews.length : 0));
  }

  // Render Sidebar (Latest News list - approved only)
  const latestApproved = state.articles.filter(a => a.status === 'Approved');
  const latestNews = [...latestApproved].slice(0, 5);
  newsContainer.innerHTML = latestNews.map(a => `
    <li class="latest-news-item" data-id="${a.id}">
      <div class="latest-news-category">${a.category}</div>
      <div class="latest-news-headline">${a.title}</div>
      <div class="latest-news-time">${a.date}</div>
    </li>
  `).join('');

  if (filtered.length === 0) {
    featuredContainer.innerHTML = `
      <div class="no-results">
        <h3 class="serif-title">No Articles Found</h3>
        <p>Try clearing your search query or selecting a different category.</p>
      </div>
    `;
    gridContainer.innerHTML = '';
    return;
  }

  // First item is Featured Hero
  const featured = filtered[0];
  featuredContainer.innerHTML = `
    <article class="featured-card" data-id="${featured.id}">
      <div class="featured-img-wrapper">
        <span class="headline-news-badge">HEADLINE NEWS</span>
        <img src="${optimizeCloudinaryUrl(featured.image)}" alt="${featured.title}" onerror="this.src='https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80'">
      </div>
      <div>
        <span class="category-tag">${featured.category}</span>
        <h2 class="featured-title">${featured.title}</h2>
        <p class="featured-desc">${featured.subtitle}</p>
        <div class="author-meta-row" style="margin-top: 1rem;">
          <div class="avatar-circle">${getInitials(featured.author.name)}</div>
          <div class="author-details-text">
            <div class="author-name">${featured.author.name}</div>
            <div class="author-meta-sub">
              ${featured.author.role} &bull; ${featured.readTime} &bull; 
              <span style="font-weight: 650; color: var(--color-brand);">${featured.reads || 0} reads</span> &bull; 
              <span style="font-weight: 650;">${featured.reviews ? featured.reviews.length : 0} reviews</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;

  // Remainder are standard grid stories
  const trending = filtered.slice(1);
  gridContainer.innerHTML = trending.map(a => `
    <article class="story-card" data-id="${a.id}">
      <div class="story-img-wrapper">
        <img src="${optimizeCloudinaryUrl(a.image)}" alt="${a.title}" onerror="this.src='https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80'">
      </div>
      <div>
        <span class="category-tag">${a.category}</span>
        <h3 class="story-title">${a.title}</h3>
        <p class="story-desc">${a.subtitle}</p>
        <div class="author-meta-row" style="margin-top: 0.75rem;">
          <div class="avatar-circle" style="width:28px; height:28px; font-size:0.7rem;">${getInitials(a.author.name)}</div>
          <div class="author-details-text">
            <span class="author-name" style="font-size:0.75rem;">${a.author.name}</span>
            <span class="author-meta-sub" style="font-size:0.7rem;">
              &bull; ${a.readTime} &bull; 
              <span style="font-weight: 600; color: var(--color-brand);">${a.reads || 0} reads</span> &bull; 
              <span style="font-weight: 600;">${a.reviews ? a.reviews.length : 0} reviews</span>
            </span>
          </div>
        </div>
      </div>
    </article>
  `).join('');

  // Attach card navigation events
  document.querySelectorAll('.featured-card, .story-card, .latest-news-item').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo('article', el.dataset.id);
    });
  });

  // Apply premium 3D Hover Tilt effect and Scroll Entry animations
  document.querySelectorAll('.featured-card, .story-card').forEach(el => {
    apply3DTilt(el);
  });
  observeScrollElements();
}

function renderArticleDetailView() {
  const article = state.articles.find(a => a.id === state.selectedArticleId);
  if (!article) {
    navigateTo('home');
    return;
  }

  // Increment views count on read
  article.reads = (article.reads || 0) + 1;
  saveArticlesToStorage();

  // Guard access to pending articles (only author and admin can view)
  const isAuthor = state.currentUser && state.currentUser.name && article.author && article.author.name && state.currentUser.name.toLowerCase() === article.author.name.toLowerCase();
  const isAdmin = state.currentUser && state.currentUser.role === 'Admin';
  
  if (article.status === 'Pending' && !isAuthor && !isAdmin) {
    showToast("This publication is pending administrator approval and is not publicly accessible.");
    navigateTo('home');
    return;
  }

  let noticeBar = '';
  if (article.status === 'Pending') {
    noticeBar = `
      <div style="margin-top: 0; margin-bottom: 2rem; background-color: #fff1e5; border: 1px solid #ffdec2; border-radius: 6px; padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <span class="status-badge status-pending" style="font-size: 0.7rem;">Pending Review</span>
          <span style="font-size: 0.85rem; color: var(--color-brand); font-weight: 600;">This publication is awaiting moderation. Only you and administrators can view this page.</span>
        </div>
        ${isAdmin ? `<button class="btn-approve" id="quick-approve-btn" style="padding: 0.4rem 0.8rem; font-size: 0.7rem;">Authorize Now</button>` : ''}
      </div>
    `;
  }

  const hasMultipleImages = article.images && article.images.length > 1;
  let heroHTML = '';

  if (hasMultipleImages) {
    heroHTML = `
      <div class="article-detail-3d-deck-container">
        <div class="deck-frame">
          ${article.images.map((img, idx) => `
            <div class="deck-card" data-index="${idx}">
              <img src="${optimizeCloudinaryUrl(img)}" alt="${article.title} Image ${idx+1}" onerror="this.src='https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80'">
            </div>
          `).join('')}
        </div>
        <div class="deck-controls">
          <button class="deck-control-btn prev-btn">&larr; PREV</button>
          <span class="deck-indicator">1 / ${article.images.length}</span>
          <button class="deck-control-btn next-btn">NEXT &rarr;</button>
        </div>
      </div>
    `;
  } else {
    heroHTML = `
      <div class="article-detail-hero">
        <img src="${optimizeCloudinaryUrl(article.image) || 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80'}" alt="${article.title}" onerror="this.src='https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80'">
      </div>
    `;
  }

  const isBookmarked = state.bookmarks.includes(article.id);
  const bookmarkBtnHTML = `
    <button id="article-bookmark-btn" class="bookmark-action-btn ${isBookmarked ? 'active' : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-2px"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      <span>${isBookmarked ? 'Saved' : 'Save Story'}</span>
    </button>
  `;

  const narratorHTML = `
    <div class="narrator-player" id="narrator-player">
      <div class="narrator-info">
        <div class="narrator-icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </div>
        <div class="narrator-details">
          <span class="narrator-title">Audio Narrative</span>
          <span class="narrator-status" id="narrator-status-text">Listen to Thorne's cultural analysis</span>
        </div>
      </div>
      
      <div class="narrator-controls">
        <div class="narrator-wave" id="narrator-wave-bars">
          <div class="narrator-wave-bar"></div>
          <div class="narrator-wave-bar"></div>
          <div class="narrator-wave-bar"></div>
          <div class="narrator-wave-bar"></div>
          <div class="narrator-wave-bar"></div>
        </div>
        <select class="narrator-speed-select" id="narrator-rate-select" aria-label="Playback Speed">
          <option value="0.8">0.8x</option>
          <option value="1" selected>1.0x</option>
          <option value="1.2">1.2x</option>
          <option value="1.5">1.5x</option>
        </select>
        <button class="narrator-play-btn" id="narrator-play-btn" aria-label="Play Narrative">
          <svg id="narrator-play-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          <svg id="narrator-pause-icon" class="hidden" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="4" x2="18" y2="20"></line><line x1="6" y1="4" x2="6" y2="20"></line></svg>
        </button>
      </div>
    </div>
  `;

  // Main content insertion
  const container = document.getElementById('article-detail-content');
  container.innerHTML = `
    ${noticeBar}
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem; flex-wrap:wrap; gap:1rem;">
      <span class="category-tag" style="text-transform: uppercase;">Long Form / ${article.category}</span>
      ${bookmarkBtnHTML}
    </div>
    <h2 class="serif-title" style="font-size: 2.8rem; font-weight: 800; margin-bottom: 1.5rem; line-height: 1.2;">
      ${article.title}
    </h2>
    
    ${heroHTML}

    <div class="article-details-meta">
      <div class="article-meta-left">
        <div class="avatar-circle">${getInitials(article.author.name)}</div>
        <div>
          <div class="article-meta-author-name">${article.author.name}</div>
          <div class="article-meta-author-title">${article.author.role}</div>
        </div>
      </div>
      <div class="article-meta-right">
        <span class="article-meta-date">${article.date}</span>
        <span class="article-meta-divider">&bull;</span>
        <span class="article-meta-read">${article.readTime}</span>
      </div>
    </div>

    <div class="article-body-content">
      ${article.content}
    </div>
    ${narratorHTML}
  `;

  if (hasMultipleImages) {
    const deckContainer = container.querySelector('.article-detail-3d-deck-container');
    if (deckContainer) {
      init3DDeck(deckContainer, article.images);
    }
  }

  // Bookmark Toggle action
  const artBookmarkBtn = document.getElementById('article-bookmark-btn');
  if (artBookmarkBtn) {
    artBookmarkBtn.addEventListener('click', () => {
      toggleBookmark(article.id);
    });
  }

  // Quick Approval Event for Admin
  if (article.status === 'Pending' && isAdmin) {
    const quickApproveBtn = document.getElementById('quick-approve-btn');
    if (quickApproveBtn) {
      quickApproveBtn.addEventListener('click', () => {
        updateArticleRecord(article.id, {
          status: 'Approved'
        })
        .then(() => {
          showToast(`Article "${article.title}" approved and published!`);
          renderArticleDetailView();
        })
        .catch(err => {
          console.error("Error approving article:", err);
          showToast("Error approving article: " + err.message);
        });
      });
    }
  }

  // Render Reviews and score
  renderReviews(article);

  // Render Comments
  renderComments(article);

  // Text-To-Speech Narrator bindings
  const playBtn = document.getElementById('narrator-play-btn');
  const rateSelect = document.getElementById('narrator-rate-select');
  const statusText = document.getElementById('narrator-status-text');
  const waveBars = document.getElementById('narrator-wave-bars');
  const playIcon = document.getElementById('narrator-play-icon');
  const pauseIcon = document.getElementById('narrator-pause-icon');

  let speaking = false;
  let utterance = null;

  // Extract clean text from article paragraphs
  const paragraphs = Array.from(container.querySelectorAll('.article-body-content p')).map(p => p.textContent);
  // Take first 3 paragraphs for a concise narrative summary
  const readingText = paragraphs.slice(0, 3).join(' ');

  if (statusText) {
    statusText.textContent = `Listen to ${article.author.name.split(' ')[0]}'s analysis`;
  }

  function stopSpeaking() {
    window.speechSynthesis.cancel();
    speaking = false;
    if (playIcon) playIcon.classList.remove('hidden');
    if (pauseIcon) pauseIcon.classList.add('hidden');
    if (waveBars) waveBars.classList.remove('playing');
    if (statusText) statusText.textContent = `Listen to ${article.author.name.split(' ')[0]}'s analysis`;
  }

  function startSpeaking() {
    window.speechSynthesis.cancel(); // clear queue first
    utterance = new SpeechSynthesisUtterance(readingText);
    utterance.rate = parseFloat(rateSelect.value || '1.0');
    
    // Choose voice
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Natural') || v.lang.startsWith('en'));
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }

    utterance.onend = () => {
      stopSpeaking();
    };

    utterance.onerror = () => {
      stopSpeaking();
    };

    window.speechSynthesis.speak(utterance);
    speaking = true;
    if (playIcon) playIcon.classList.add('hidden');
    if (pauseIcon) pauseIcon.classList.remove('hidden');
    if (waveBars) waveBars.classList.add('playing');
    if (statusText) statusText.textContent = "Playing narration (Synthesized Speech)...";
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (speaking) {
        stopSpeaking();
      } else {
        startSpeaking();
      }
    });
  }

  if (rateSelect) {
    rateSelect.addEventListener('change', () => {
      if (speaking) {
        startSpeaking(); // restart with new rate
      }
    });
  }
}

function renderWriteView() {
  // Check auth roles
  if (!state.currentUser || state.currentUser.role !== 'Author') {
    showToast("You must be registered as an Author to publish publications.");
    navigateTo('home');
    openAuthModal('signup');
    return;
  }
  
  // Render author's articles tracker
  renderAuthorArticlesList();
}

// 4. REVIEWS SUB-CONTROLLER
function renderReviews(article) {
  const reviews = article.reviews || [];
  const scoreContainer = document.getElementById('average-score-container');
  const listContainer = document.getElementById('reviews-list-container');
  
  // Calculate average
  if (reviews.length === 0) {
    scoreContainer.innerHTML = `<span class="score-text">No reviews yet</span>`;
  } else {
    const sum = reviews.reduce((total, r) => total + r.rating, 0);
    const avg = (sum / reviews.length).toFixed(1);
    
    // stars display
    let starStr = '';
    const roundedAvg = Math.round(avg);
    for (let i = 1; i <= 5; i++) {
      starStr += i <= roundedAvg ? '★' : '☆';
    }
    
    scoreContainer.innerHTML = `
      <div class="star-rating">${starStr}</div>
      <span class="score-text">${avg} / 5</span>
    `;
  }

  // Review cards list
  listContainer.innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-card-header">
        <span class="review-card-title">${escapeHTML(r.title)}</span>
        <div class="star-rating" style="font-size:0.9rem;">${'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}</div>
      </div>
      <p class="review-card-body">"${escapeHTML(r.text)}"</p>
      <div class="review-card-author">— ${escapeHTML(r.reviewer)}</div>
    </div>
  `).join('');
}

// 5. DISCUSSIONS / COMMENTS SUB-CONTROLLER
function renderComments(article) {
  const listContainer = document.getElementById('comments-thread-list');
  const comments = article.comments || [];
  
  if (comments.length === 0) {
    listContainer.innerHTML = `<p class="no-comments" style="color:var(--color-text-muted); font-size:0.9rem; font-style:italic;">No comments yet. Start the conversation below!</p>`;
    return;
  }

  // Sort by upvotes or date if necessary (default order is seeded order)
  listContainer.innerHTML = comments.map(c => renderCommentNode(c, article)).join('');
  attachCommentActionEvents(article);
}

// Recursive function to build comments HTML tree
function renderCommentNode(comment, article, isReply = false) {
  // Check if commenter is the article's actual author to give them the special badge
  const showAuthorBadge = article.author.name.toLowerCase() === comment.authorName.toLowerCase() || comment.isAuthor;
  
  let html = `
    <div class="comment-node" id="node-${comment.id}">
      <div class="comment-main">
        <div class="comment-avatar">
          <div class="avatar-circle" style="width:36px; height:36px; font-size:0.8rem; background-color:${comment.isAuthor ? '#fff1e5' : '#f0efea'}">
            ${getInitials(comment.authorName)}
          </div>
        </div>
        <div class="comment-content">
          <div class="comment-header-row">
            <span class="comment-author-name">${escapeHTML(comment.authorName)}</span>
            ${showAuthorBadge ? `<span class="author-pill-badge">AUTHOR</span>` : ''}
            <span class="comment-time">${comment.timestamp}</span>
          </div>
          <div class="comment-body-text">${escapeHTML(comment.text)}</div>
          
          <div class="comment-actions-row">
            <button class="comment-action-btn upvote-btn" data-comment-id="${comment.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-2px"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
              <span>${comment.upvotes || 0}</span>
            </button>
            <button class="comment-action-btn reply-trigger-btn" data-comment-id="${comment.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-2px"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
              <span>Reply</span>
            </button>
          </div>
        </div>
      </div>
  `;

  // Render replies recursively if they exist
  if (comment.replies && comment.replies.length > 0) {
    html += `
      <div class="comment-replies-list">
        ${comment.replies.map(r => renderCommentNode(r, article, true)).join('')}
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

// Find comment within tree (helper)
function findCommentInTree(commentsList, commentId) {
  for (let c of commentsList) {
    if (c.id === commentId) return c;
    if (c.replies && c.replies.length > 0) {
      const found = findCommentInTree(c.replies, commentId);
      if (found) return found;
    }
  }
  return null;
}

function attachCommentActionEvents(article) {
  // Upvotes event
  document.querySelectorAll('.upvote-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      const updatedComments = JSON.parse(JSON.stringify(article.comments || []));
      const targetComment = findCommentInTree(updatedComments, commentId);
      if (targetComment) {
        targetComment.upvotes = (targetComment.upvotes || 0) + 1;
        
        updateArticleRecord(article.id, {
          comments: updatedComments
        })
        .catch(err => {
          console.error("Error upvoting comment in Firestore:", err);
          showToast("Error upvoting comment: " + err.message);
        });
      }
    });
  });

  // Toggle inline reply textarea box
  document.querySelectorAll('.reply-trigger-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const commentId = btn.dataset.commentId;
      const nodeEl = document.getElementById(`node-${commentId}`);
      
      // Check if reply box already exists in this node
      const existingComposer = nodeEl.querySelector(`.inline-reply-composer[data-parent-id="${commentId}"]`);
      if (existingComposer) {
        existingComposer.remove();
        return;
      }
      
      // Render clean small form
      const formHTML = document.createElement('div');
      formHTML.className = 'inline-reply-composer';
      formHTML.setAttribute('data-parent-id', commentId);
      formHTML.innerHTML = `
        <textarea placeholder="Write a reply..." rows="2" id="reply-textarea-${commentId}"></textarea>
        <div class="inline-reply-actions">
          <button class="text-btn inline-cancel-btn" style="font-size:0.7rem; padding:0.2rem 0.5rem;">Cancel</button>
          <button class="action-btn-small inline-submit-btn" style="font-size:0.7rem; padding:0.25rem 0.6rem;">Submit</button>
        </div>
      `;
      
      // Append right after the main content box (before child replies)
      const mainContentBox = nodeEl.querySelector('.comment-main');
      mainContentBox.parentNode.insertBefore(formHTML, mainContentBox.nextSibling);
      
      // Cancel event
      formHTML.querySelector('.inline-cancel-btn').addEventListener('click', () => formHTML.remove());
      
      // Submit event
      formHTML.querySelector('.inline-submit-btn').addEventListener('click', () => {
        const textVal = document.getElementById(`reply-textarea-${commentId}`).value.trim();
        if (textVal === '') return;

        // Require sign in
        if (!state.currentUser) {
          showToast("Please sign in to write comment replies.");
          openAuthModal('signin');
          return;
        }

        const updatedComments = JSON.parse(JSON.stringify(article.comments || []));
        const targetComment = findCommentInTree(updatedComments, commentId);
        if (targetComment) {
          const newReply = {
            id: 'comm-' + Date.now(),
            authorName: state.currentUser.name,
            role: state.currentUser.role,
            avatar: getInitials(state.currentUser.name),
            isAuthor: state.currentUser.role === 'Author',
            timestamp: "Just now",
            text: textVal,
            upvotes: 0,
            replies: []
          };
          
          if (!targetComment.replies) targetComment.replies = [];
          targetComment.replies.push(newReply);
          
          updateArticleRecord(article.id, {
            comments: updatedComments
          })
          .then(() => {
            formHTML.remove();
            showToast("Reply published.");
          })
          .catch(err => {
            console.error("Error replying to comment in Firestore:", err);
            showToast("Error replying to comment: " + err.message);
          });
        }
      });
    });
  });
}

// 6. AUTH DIALOG & ROLE MAPPINGS
function openAuthModal(pane = 'signin') {
  const modal = document.getElementById('auth-modal');
  const card = modal ? modal.querySelector('.auth-modal-card') : null;
  const signinPane = document.getElementById('signin-pane');
  const signupPane = document.getElementById('signup-pane');

  if (!modal || !signinPane || !signupPane) {
    console.error('Auth modal elements not found');
    return;
  }

  modal.classList.remove('hidden');
  if (pane === 'signin') {
    signinPane.classList.remove('hidden');
    signupPane.classList.add('hidden');
    if (card) card.classList.remove('signup-mode');
  } else {
    signinPane.classList.add('hidden');
    signupPane.classList.remove('hidden');
    if (card) card.classList.add('signup-mode');
    // Hide Author specification by default
    const authorGroup = document.getElementById('author-role-group');
    if (authorGroup) {
      authorGroup.classList.add('hidden');
    }
  }
}

function updateUserInterface() {
  const authBtn = document.getElementById('auth-btn');
  const userBadge = document.getElementById('user-display');
  const writeForUsBtn = document.getElementById('write-for-us-btn');
  const adminPanelBtn = document.getElementById('admin-panel-btn');

  if (state.currentUser) {
    authBtn.textContent = 'SIGN OUT';
    userBadge.textContent = state.currentUser.name;
    userBadge.classList.remove('hidden');
    
    if (state.currentUser.role === 'Author') {
      userBadge.classList.add('author');
      writeForUsBtn.textContent = 'CREATE ARTICLE';
      writeForUsBtn.classList.remove('hidden');
      adminPanelBtn.classList.add('hidden');
    } else if (state.currentUser.role === 'Admin') {
      userBadge.classList.add('author');
      writeForUsBtn.classList.add('hidden');
      adminPanelBtn.classList.remove('hidden');
    } else {
      userBadge.classList.remove('author');
      writeForUsBtn.textContent = 'WRITE FOR US';
      writeForUsBtn.classList.remove('hidden');
      adminPanelBtn.classList.add('hidden');
    }
  } else {
    authBtn.textContent = 'SIGN IN';
    userBadge.classList.add('hidden');
    userBadge.classList.remove('author');
    writeForUsBtn.textContent = 'WRITE FOR US';
    writeForUsBtn.classList.remove('hidden');
    adminPanelBtn.classList.add('hidden');
  }
}

// 7. EVENT ATTACHMENTS & FORMS
function setupEventListeners() {
  // Logo brand navigation
  document.getElementById('logo-btn').addEventListener('click', () => {
    state.activeCategory = 'All';
    state.searchQuery = '';
    document.getElementById('search-input').value = '';
    document.getElementById('search-container').classList.remove('open');
    
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.category === 'All') link.classList.add('active');
      else link.classList.remove('active');
    });

    navigateTo('home');
  });

  // --- SCROLL PROGRESS TRACKER ---
  window.addEventListener('scroll', () => {
    const progressBar = document.getElementById('scroll-progress-bar');
    if (!progressBar) return;
    
    // Only track scroll on Article View
    if (state.currentView !== 'article') {
      progressBar.style.width = '0%';
      return;
    }

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    
    if (docHeight > 0) {
      const scrollPercent = (scrollTop / docHeight) * 100;
      progressBar.style.width = `${scrollPercent}%`;
    } else {
      progressBar.style.width = '0%';
    }
  });

  // --- THEME MODE TOGGLE ACTION ---
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const moon = document.getElementById('theme-moon-svg');
      const sun = document.getElementById('theme-sun-svg');
      
      if (state.theme === 'light') {
        state.theme = 'dark';
        document.body.classList.add('dark-theme');
        if (moon) moon.classList.add('hidden');
        if (sun) sun.classList.remove('hidden');
        localStorage.setItem('chronicle_theme', 'dark');
        showToast("Dark theme enabled.");
      } else {
        state.theme = 'light';
        document.body.classList.remove('dark-theme');
        if (moon) moon.classList.remove('hidden');
        if (sun) sun.classList.add('hidden');
        localStorage.setItem('chronicle_theme', 'light');
        showToast("Light theme enabled.");
      }
    });
  }

  // --- BOOKMARKS DRAWER UI ACTIONS ---
  const bookmarkToggleBtn = document.getElementById('bookmark-toggle-btn');
  const bookmarkDrawer = document.getElementById('bookmark-drawer');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');

  function openBookmarkDrawer() {
    renderBookmarkDrawerList();
    if (bookmarkDrawer) bookmarkDrawer.classList.add('open');
    if (drawerOverlay) drawerOverlay.classList.add('open');
  }

  function closeBookmarkDrawer() {
    if (bookmarkDrawer) bookmarkDrawer.classList.remove('open');
    if (drawerOverlay) drawerOverlay.classList.remove('open');
  }

  if (bookmarkToggleBtn) {
    bookmarkToggleBtn.addEventListener('click', openBookmarkDrawer);
  }
  if (closeDrawerBtn) {
    closeDrawerBtn.addEventListener('click', closeBookmarkDrawer);
  }
  if (drawerOverlay) {
    drawerOverlay.addEventListener('click', closeBookmarkDrawer);
  }

  // Category Filtering navigation
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      e.target.classList.add('active');
      
      state.activeCategory = e.target.dataset.category;
      navigateTo('home');
    });
  });

  // Search input actions
  const searchToggle = document.getElementById('search-toggle-btn');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');

  searchToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    searchContainer.classList.toggle('open');
    if (searchContainer.classList.contains('open')) {
      searchInput.focus();
    }
  });

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    // Perform live filter if in home view
    if (state.currentView === 'home') {
      renderHomeView();
    }
  });

  // Clear search on body click if blank
  document.body.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target) && !searchToggle.contains(e.target)) {
      if (searchInput.value.trim() === '') {
        searchContainer.classList.remove('open');
      }
    }
  });

  // Auth Modals actions
  const authBtn = document.getElementById('auth-btn');
  authBtn.addEventListener('click', () => {
    if (state.currentUser) {
      // Logout
      if (state.currentUser.localOnly || !auth) {
        saveUserSession(null);
        state.bookmarks = [];
        showToast("Signed out successfully.");
        navigateTo('home');
        return;
      }

      auth.signOut()
        .then(() => {
          showToast("Signed out successfully.");
          navigateTo('home');
        })
        .catch((error) => {
          showToast("Error signing out: " + error.message);
        });
    } else {
      openAuthModal('signin');
    }
  });

  document.getElementById('close-auth-modal').addEventListener('click', () => {
    document.getElementById('auth-modal').classList.add('hidden');
  });

  document.getElementById('go-to-signup').addEventListener('click', () => openAuthModal('signup'));
  document.getElementById('go-to-signin').addEventListener('click', () => openAuthModal('signin'));

  // Role details toggle on Register Form
  const roleSelect = document.getElementById('signup-role-type');
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      const authorGroup = document.getElementById('author-role-group');
      if (authorGroup) {
        if (e.target.value === 'Author') {
          authorGroup.classList.remove('hidden');
        } else {
          authorGroup.classList.add('hidden');
        }
      }
    });
  }

  // Demo Credentials Autofill Helper
  const autofillSelect = document.getElementById('demo-profile-autofill');
  autofillSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      const [email, password] = val.split('|');
      document.getElementById('signin-email').value = email;
      document.getElementById('signin-password').value = password;
    }
  });

  // Fully Operational Sign-in action
  const signinForm = document.getElementById('signin-form');
  console.log('Signin form element found:', signinForm);
  
  function handleSignIn(e) {
    console.log('Signin form submitted!');
    e.preventDefault();
    const emailVal = document.getElementById('signin-email').value.trim();
    const passwordVal = document.getElementById('signin-password').value;
    
    console.log('Sign-in attempt:', { email: emailVal, password: '***' });
    
    if (!emailVal || !passwordVal) {
      showToast("Please enter email and password.");
      return;
    }
    
    const localUser = findLocalUser(emailVal, passwordVal);
    console.log('Local user found:', localUser);

    if (localUser) {
      const sessionUser = stripPrivateUserFields(localUser);
      console.log('Session user:', sessionUser);
      saveUserSession(sessionUser);
      state.bookmarks = sessionUser.bookmarks || [];
      loadLocalArticles();
      const modal = document.getElementById('auth-modal');
      if (modal) {
        modal.classList.add('hidden');
      }
      showToast(`Welcome back, ${sessionUser.name}!`);
      setTimeout(() => {
        navigateTo('home');
      }, 500);
      return;
    }

    if (!auth) {
      console.log('No local user found and Firebase disabled');
      showToast("Invalid email or password.");
      return;
    }

    auth.signInWithEmailAndPassword(emailVal, passwordVal)
      .then(async (userCredential) => {
        const user = userCredential.user;
        // Fetch user profile from Firestore to redirect correctly
        const doc = await db.collection('users').doc(user.uid).get();
        let role = 'Reader';
        let name = user.displayName || user.email.split('@')[0];
        
        if (doc.exists) {
          const data = doc.data();
          role = data.role || 'Reader';
          name = data.name || name;
        }
        
        showToast(`Welcome back, ${name}!`);
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.add('hidden');
        setTimeout(() => {
          navigateTo('home');
        }, 500);
      })
      .catch((error) => {
        console.error('Firebase sign-in error:', error.code, error.message);
        
        // Provide user-friendly error messages
        let errorMsg = "Sign-in failed. ";
        
        if (error.code === 'auth/too-many-requests') {
          errorMsg = "Too many failed attempts. Please try again in a few minutes or use a demo account from localStorage.";
        } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          errorMsg = "Invalid email or password.";
        } else if (error.code === 'auth/user-not-found') {
          errorMsg = "No account found with this email. Please sign up first.";
        } else if (error.code === 'auth/invalid-email') {
          errorMsg = "Invalid email format.";
        } else if (error.code === 'auth/network-request-failed') {
          errorMsg = "Network error. Please check your connection.";
        } else {
          errorMsg = error.message;
        }
        
        showToast(errorMsg);
      });
  }
  
  if (signinForm) {
    signinForm.addEventListener('submit', handleSignIn);
  } else {
    console.error('Signin form NOT found! Will retry...');
    // Retry after a delay
    setTimeout(() => {
      const form = document.getElementById('signin-form');
      if (form) {
        console.log('Signin form found on retry');
        form.addEventListener('submit', handleSignIn);
      } else {
        console.error('Signin form still not found after retry!');
      }
    }, 1000);
  }

  // Fully Operational Registration Sign-up action
  const signupForm = document.getElementById('signup-form');
  console.log('Signup form element found:', signupForm);
  
  function handleSignUp(e) {
    console.log('Signup form submitted!');
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email-reg').value.trim();
    const password = document.getElementById('signup-password').value;
    const roleSelect = document.getElementById('signup-role-type');
    const role = roleSelect ? roleSelect.value : 'Reader';
    const authorTitle = document.getElementById('signup-author-role').value.trim() || 'Contributor';

    console.log('Form values:', { name, email, password, role, authorTitle });

    if (name === '' || email === '' || password === '') {
      showToast("Please fill in all required fields.");
      return;
    }

    if (!auth) {
      try {
        console.log('Creating local user...');
        const localUser = createLocalUser({ name, email, password, role, authorTitle });
        console.log('Local user created:', localUser);
        saveUserSession(localUser);
        state.bookmarks = [];
        loadLocalArticles();
        
        // Force close modal
        const modal = document.getElementById('auth-modal');
        if (modal) {
          modal.classList.add('hidden');
        }
        
        showToast(`Account registered successfully. Welcome, ${name}!`);
        
        // Small delay before navigation to ensure toast is visible
        setTimeout(() => {
          if (role === 'Author') {
            navigateTo('write');
          } else {
            navigateTo('home');
          }
        }, 500);
      } catch (error) {
        console.error('Signup error:', error);
        showToast("Error: " + error.message);
      }
      return;
    }

    auth.createUserWithEmailAndPassword(email, password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        
        // Update Firebase auth profile display name
        await user.updateProfile({
          displayName: name
        });

        // Create user document profile in Firestore users collection
        await db.collection('users').doc(user.uid).set({
          name: name,
          email: email,
          role: role,
          authorTitle: role === 'Author' ? authorTitle : '',
          bookmarks: []
        });

        showToast(`Account registered successfully. Welcome, ${name}!`);
        document.getElementById('auth-modal').classList.add('hidden');

        if (role === 'Author') {
          navigateTo('write');
        } else {
          navigateTo('home');
        }
      })
      .catch((error) => {
        console.error('Firebase signup error:', error.code, error.message);
        
        // Provide user-friendly error messages
        let errorMsg = "Sign-up failed. ";
        
        if (error.code === 'auth/email-already-in-use') {
          errorMsg = "An account with this email already exists. Please sign in instead.";
        } else if (error.code === 'auth/invalid-email') {
          errorMsg = "Invalid email format.";
        } else if (error.code === 'auth/weak-password') {
          errorMsg = "Password is too weak. Please use at least 6 characters.";
        } else if (error.code === 'auth/operation-not-allowed') {
          errorMsg = "Email/password accounts are not enabled. Please contact support.";
        } else if (error.code === 'auth/network-request-failed') {
          errorMsg = "Network error. Please check your connection.";
        } else {
          errorMsg = error.message;
        }
        
        showToast(errorMsg);
      });
  }
  
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignUp);
  } else {
    console.error('Signup form NOT found! Will retry...');
    // Retry after a delay
    setTimeout(() => {
      const form = document.getElementById('signup-form');
      if (form) {
        console.log('Signup form found on retry');
        form.addEventListener('submit', handleSignUp);
      } else {
        console.error('Signup form still not found after retry!');
      }
    }, 1000);
  }

  // Write For Us trigger button
  document.getElementById('write-for-us-btn').addEventListener('click', () => {
    if (!state.currentUser) {
      showToast("Please sign in or register as an Author to publish articles.");
      openAuthModal('signup');
    } else if (state.currentUser.role !== 'Author') {
      showToast("Access Denied: Writer Dashboard requires an Author profile.");
      // Prompt option to update role or sign out
      openAuthModal('signup');
    } else {
      navigateTo('write');
    }
  });

  // Admin Dashboard Panel trigger button
  document.getElementById('admin-panel-btn').addEventListener('click', () => {
    if (!state.currentUser || state.currentUser.role !== 'Admin') {
      showToast("Access Denied: Administrator privileges required.");
      navigateTo('home');
    } else {
      navigateTo('admin');
    }
  });

  // Admin Dashboard tab switching
  document.getElementById('tab-pending-btn').addEventListener('click', () => {
    state.adminActiveTab = 'pending';
    document.getElementById('tab-pending-btn').classList.add('active');
    document.getElementById('tab-published-btn').classList.remove('active');
    document.getElementById('admin-pending-pane').classList.remove('hidden');
    document.getElementById('admin-published-pane').classList.add('hidden');
    renderAdminView();
  });

  document.getElementById('tab-published-btn').addEventListener('click', () => {
    state.adminActiveTab = 'published';
    document.getElementById('tab-pending-btn').classList.remove('active');
    document.getElementById('tab-published-btn').classList.add('active');
    document.getElementById('admin-pending-pane').classList.add('hidden');
    document.getElementById('admin-published-pane').classList.remove('hidden');
    renderAdminView();
  });

  // View All News side action
  document.getElementById('view-all-news-btn').addEventListener('click', () => {
    state.activeCategory = 'All';
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.dataset.category === 'All') link.classList.add('active');
      else link.classList.remove('active');
    });
    navigateTo('home');
  });

  // --- SORT CONTROL BUTTON EVENTS ---
  // Homepage Feed sorting
  document.querySelectorAll('.sort-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      state.homeSortBy = e.target.dataset.sort;
      renderHomeView();
    });
  });

  // Author dashboard sorting
  document.querySelectorAll('.author-sort-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      state.authorSortBy = e.target.dataset.sort;
      renderAuthorArticlesList();
    });
  });

  // --- REVIEWS FORMS & STARS ---
  const toggleReviewBtn = document.getElementById('toggle-review-form-btn');
  const reviewForm = document.getElementById('new-review-form');

  toggleReviewBtn.addEventListener('click', () => {
    if (!state.currentUser) {
      showToast("Please sign in to write a reader review.");
      openAuthModal('signin');
      return;
    }
    reviewForm.classList.toggle('hidden');
    toggleReviewBtn.classList.toggle('hidden');
  });

  document.getElementById('cancel-review-btn').addEventListener('click', () => {
    reviewForm.classList.add('hidden');
    toggleReviewBtn.classList.remove('hidden');
    resetReviewForm();
  });

  // Star selector interactives
  const starsOpt = document.querySelectorAll('.star-opt');
  starsOpt.forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.rating);
      document.getElementById('review-rating-value').value = val;
      
      starsOpt.forEach(s => {
        if (parseInt(s.dataset.rating) <= val) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    });
  });

  // Submit Review Action
  reviewForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rating = parseInt(document.getElementById('review-rating-value').value);
    const title = document.getElementById('review-title').value.trim();
    const text = document.getElementById('review-text').value.trim();

    if (!state.currentUser) return;
    
    const article = state.articles.find(a => a.id === state.selectedArticleId);
    if (article) {
      const newReview = {
        id: 'rev-' + Date.now(),
        rating: rating,
        title: title,
        text: text,
        reviewer: `${state.currentUser.name.toUpperCase()}, VERIFIED SUBSCRIBER`
      };

      const reviewUpdate = isLocalSession()
        ? { reviews: [...(article.reviews || []), newReview] }
        : { reviews: firebase.firestore.FieldValue.arrayUnion(newReview) };

      updateArticleRecord(article.id, reviewUpdate)
      .then(() => {
        resetReviewForm();
        reviewForm.classList.add('hidden');
        toggleReviewBtn.classList.remove('hidden');
        showToast("Review submitted successfully.");
      })
      .catch(err => {
        console.error("Error submitting review in Firestore:", err);
        showToast("Error submitting review: " + err.message);
      });
    }
  });

  // --- COMMENTS FORM SUBMISSION ---
  document.getElementById('post-comment-btn').addEventListener('click', () => {
    const textVal = document.getElementById('new-comment-textarea').value.trim();
    if (textVal === '') return;

    if (!state.currentUser) {
      showToast("Please sign in to write comments.");
      openAuthModal('signin');
      return;
    }

    const article = state.articles.find(a => a.id === state.selectedArticleId);
    if (article) {
      const newComment = {
        id: 'comm-' + Date.now(),
        authorName: state.currentUser.name,
        role: state.currentUser.role,
        avatar: getInitials(state.currentUser.name),
        isAuthor: state.currentUser.role === 'Author',
        timestamp: "Just now",
        text: textVal,
        upvotes: 0,
        replies: []
      };

      const commentUpdate = isLocalSession()
        ? { comments: [...(article.comments || []), newComment] }
        : { comments: firebase.firestore.FieldValue.arrayUnion(newComment) };

      updateArticleRecord(article.id, commentUpdate)
      .then(() => {
        document.getElementById('new-comment-textarea').value = '';
        showToast("Comment posted successfully.");
      })
      .catch(err => {
        console.error("Error posting comment in Firestore:", err);
        showToast("Error posting comment: " + err.message);
      });
    }
  });

  // --- ARTICLE WRITER COMPOSER FORM ---
  const presetCards = document.querySelectorAll('.preset-img-card');
  const fileInput = document.getElementById('comp-image-file');
  const fileUploadBox = document.getElementById('file-upload-box');
  const uploadStatus = document.getElementById('upload-status-indicator');
  const uploadPreviewContainer = document.getElementById('upload-preview-container');
  const uploadPreviewImg = document.getElementById('upload-preview-img');
  const removeUploadedImgBtn = document.getElementById('remove-uploaded-img-btn');

  // Drag and drop events for uploader
  if (fileUploadBox) {
    fileUploadBox.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileUploadBox.classList.add('drag-over');
    });

    fileUploadBox.addEventListener('dragleave', () => {
      fileUploadBox.classList.remove('drag-over');
    });

    fileUploadBox.addEventListener('drop', (e) => {
      e.preventDefault();
      fileUploadBox.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImageUpload(files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleImageUpload(e.target.files[0]);
      }
    });
  }

  async function handleImageUpload(file) {
    if (!file) return;
    
    // Show spinner status, hide file upload box and preview
    if (fileUploadBox) fileUploadBox.classList.add('hidden');
    if (uploadStatus) uploadStatus.classList.remove('hidden');
    if (uploadPreviewContainer) uploadPreviewContainer.classList.add('hidden');
    
    try {
      const uploadResult = await uploadFileToCloudinary(file);
      state.uploadedImageUrl = uploadResult.secure_url;
      
      // Update preview UI
      if (uploadPreviewImg) uploadPreviewImg.src = uploadResult.secure_url;
      if (uploadStatus) uploadStatus.classList.add('hidden');
      if (uploadPreviewContainer) uploadPreviewContainer.classList.remove('hidden');
      
      // Clear preset cards
      presetCards.forEach(c => c.classList.remove('active'));
      
      showToast("Cover image uploaded successfully to Cloudinary.");
    } catch (err) {
      console.error(err);
      showToast("Error: " + err.message);
      resetFileUploadUI();
    }
  }

  function resetFileUploadUI() {
    state.uploadedImageUrl = null;
    if (fileInput) fileInput.value = '';
    if (uploadPreviewImg) uploadPreviewImg.src = '';
    
    if (fileUploadBox) fileUploadBox.classList.remove('hidden');
    if (uploadStatus) uploadStatus.classList.add('hidden');
    if (uploadPreviewContainer) uploadPreviewContainer.classList.add('hidden');
  }

  if (removeUploadedImgBtn) {
    removeUploadedImgBtn.addEventListener('click', () => {
      resetFileUploadUI();
      // Reset back to first preset card (Literature) as active default
      presetCards.forEach(c => c.classList.remove('active'));
      if (presetCards[0]) presetCards[0].classList.add('active');
    });
  }

  // Preset Selection Handling
  presetCards.forEach(card => {
    card.addEventListener('click', () => {
      // Single-select presets
      presetCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      
      // Clear custom file upload if selecting preset
      resetFileUploadUI();
    });
  });

  document.getElementById('discard-draft-btn').addEventListener('click', () => {
    if (confirm("Are you sure you want to discard this draft?")) {
      document.getElementById('article-composer-form').reset();
      resetFileUploadUI();
      presetCards.forEach(c => c.classList.remove('active'));
      if (presetCards[0]) presetCards[0].classList.add('active');
      navigateTo('home');
    }
  });

  document.getElementById('article-composer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!state.currentUser || state.currentUser.role !== 'Author') return;

    const title = document.getElementById('comp-title').value.trim();
    const subtitle = document.getElementById('comp-subtitle').value.trim();
    const category = document.getElementById('comp-category').value;
    const readTimeVal = document.getElementById('comp-readtime').value;
    const contentText = document.getElementById('comp-content').value.trim();

    // Image URL resolution
    let coverImage = '';
    let images = [];
    
    if (state.uploadedImageUrl) {
      coverImage = state.uploadedImageUrl;
      images.push(state.uploadedImageUrl);
    } else {
      const activePreset = document.querySelector('.preset-img-card.active');
      if (activePreset) {
        coverImage = activePreset.dataset.url;
        images.push(activePreset.dataset.url);
      }
    }

    if (!coverImage) {
      // Fallback
      coverImage = 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80';
      images.push(coverImage);
    }

    const newArticleId = 'article-' + Date.now();
    const newArticle = {
      id: newArticleId,
      title: title,
      subtitle: subtitle,
      category: category,
      author: {
        name: state.currentUser.name,
        role: state.currentUser.authorTitle || 'Contributor',
        avatar: getInitials(state.currentUser.name)
      },
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      readTime: `${readTimeVal} min read`,
      image: coverImage,
      images: images,
      content: contentText.startsWith('<p>') ? contentText : `<p>${contentText.replace(/\n\n/g, '</p><p>')}</p>`,
      status: 'Pending',
      reviews: [],
      comments: [],
      createdAt: firebaseReady ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
    };

    // Save to Firestore when available, otherwise local demo storage
    setArticleRecord(newArticleId, newArticle)
      .then(() => {
        showToast("Publication submitted. It will be published after administrator review.");
        
        // Reset Form
        document.getElementById('article-composer-form').reset();
        resetFileUploadUI();

        presetCards.forEach(c => c.classList.remove('active'));
        if (presetCards[0]) presetCards[0].classList.add('active');

        // Redirect to the writer dashboard
        navigateTo('write');
      })
      .catch(err => {
        console.error("Error submitting article to Firestore:", err);
        showToast("Error submitting publication: " + err.message);
      });
  });

  // --- INTERACTIVE FOOTER EVENT LISTENERS ---
  
  // Footer Logo Action
  const footerLogo = document.getElementById('footer-logo-btn');
  if (footerLogo) {
    footerLogo.addEventListener('click', () => {
      state.activeCategory = 'All';
      state.searchQuery = '';
      document.getElementById('search-input').value = '';
      document.getElementById('search-container').classList.remove('open');
      
      document.querySelectorAll('.nav-link').forEach(link => {
        if (link.dataset.category === 'All') link.classList.add('active');
        else link.classList.remove('active');
      });

      navigateTo('home');
    });
  }

  // Footer Category Explore links click events
  document.querySelectorAll('.footer-link-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const category = e.target.dataset.category;
      
      // Update primary navigation active state
      document.querySelectorAll('.nav-link').forEach(link => {
        if (link.dataset.category === category) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
      
      state.activeCategory = category;
      navigateTo('home');
    });
  });

  // Newsletter subscription submission handling
  const subscribeForm = document.getElementById('footer-subscribe-form');
  const subscribeFeedback = document.getElementById('subscribe-feedback');
  if (subscribeForm) {
    subscribeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('subscribe-email');
      const email = emailInput.value.trim();
      
      if (email === '') return;
      
      // Simple validation check
      if (!validateEmail(email)) {
        subscribeFeedback.textContent = "Please enter a valid email address.";
        subscribeFeedback.className = "subscribe-feedback error";
        return;
      }
      
      // Success feedback animation
      subscribeFeedback.textContent = "Thank you! You have subscribed successfully.";
      subscribeFeedback.className = "subscribe-feedback success";
      emailInput.value = '';
      showToast("Newsletter subscription successful!");
      
      // Clear message after 5 seconds
      setTimeout(() => {
        subscribeFeedback.textContent = "";
        subscribeFeedback.className = "subscribe-feedback";
      }, 5000);
    });
  }

  // Back to top button action
  const backToTopBtn = document.getElementById('back-to-top-btn');
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // Dynamic parallax interactive mouse hover background movement for footer
  const footerEl = document.querySelector('.main-footer');
  if (footerEl) {
    footerEl.addEventListener('mousemove', (e) => {
      const rect = footerEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const xPct = (x / rect.width) * 100;
      const yPct = (y / rect.height) * 100;
      
      // Subtle background offset transition
      const xOffset = 50 + (xPct - 50) * 0.08;
      const yOffset = 50 + (yPct - 50) * 0.08;
      footerEl.style.backgroundPosition = `${xOffset}% ${yOffset}%`;
    });
    
    footerEl.addEventListener('mouseleave', () => {
      footerEl.style.backgroundPosition = 'center';
    });
  }
}

// 8. HELPERS
function apply3DTilt(el) {
  if (!el.classList.contains('featured-card') && !el.classList.contains('story-card')) return;
  
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    
    const rotateY = ((x / w) - 0.5) * 16;
    const rotateX = (0.5 - (y / h)) * 16;
    
    el.style.transition = 'none';
    el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
    
    const shadowX = -rotateY * 0.8;
    const shadowY = rotateX * 0.8;
    el.style.boxShadow = `${shadowX}px ${shadowY}px 25px rgba(0, 0, 0, 0.12)`;
    
    const img = el.querySelector('img');
    if (img) {
      img.style.transition = 'none';
      img.style.transform = `translate3d(${-rotateY * 0.4}px, ${-rotateX * 0.4}px, 0) scale(1.08)`;
    }
  });
  
  el.addEventListener('mouseleave', () => {
    el.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    el.style.boxShadow = '';
    
    const img = el.querySelector('img');
    if (img) {
      img.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
      img.style.transform = '';
    }
  });
}

let scrollObserver;
function initScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();
  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        scrollObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -40px 0px'
  });
}

function observeScrollElements() {
  document.querySelectorAll('.featured-card, .story-card').forEach(el => {
    el.classList.add('scroll-reveal');
    if (scrollObserver) {
      scrollObserver.observe(el);
    }
  });
}

function init3DDeck(container, images) {
  const frame = container.querySelector('.deck-frame');
  const prevBtn = container.querySelector('.prev-btn');
  const nextBtn = container.querySelector('.next-btn');
  const indicator = container.querySelector('.deck-indicator');
  
  let currentIndex = 0;
  const N = images.length;
  
  function updateDeckClasses() {
    const cards = frame.querySelectorAll('.deck-card');
    cards.forEach((card, idx) => {
      card.className = 'deck-card';
      const diff = (idx - currentIndex + N) % N;
      
      if (diff === 0) {
        card.classList.add('state-active');
      } else if (diff === 1 && N > 1) {
        card.classList.add('state-next-1');
      } else if (diff === 2 && N > 2) {
        card.classList.add('state-next-2');
      } else {
        card.classList.add('state-hidden');
      }
    });
    
    if (indicator) {
      indicator.textContent = `${currentIndex + 1} / ${N}`;
    }
  }
  
  function goNext() {
    const cards = frame.querySelectorAll('.deck-card');
    const activeCard = frame.querySelector(`.deck-card[data-index="${currentIndex}"]`);
    
    if (activeCard) {
      activeCard.className = 'deck-card state-outgoing';
    }
    
    const prevIndex = currentIndex;
    currentIndex = (currentIndex + 1) % N;
    
    cards.forEach((card, idx) => {
      if (idx === prevIndex) return;
      
      const diff = (idx - currentIndex + N) % N;
      card.className = 'deck-card';
      if (diff === 0) {
        card.classList.add('state-active');
      } else if (diff === 1 && N > 1) {
        card.classList.add('state-next-1');
      } else if (diff === 2 && N > 2) {
        card.classList.add('state-next-2');
      } else {
        card.classList.add('state-hidden');
      }
    });
    
    if (indicator) {
      indicator.textContent = `${currentIndex + 1} / ${N}`;
    }
    
    setTimeout(() => {
      const card = frame.querySelector(`.deck-card[data-index="${prevIndex}"]`);
      if (card && card.classList.contains('state-outgoing')) {
        card.className = 'deck-card state-hidden';
      }
    }, 600);
  }

  function goPrev() {
    currentIndex = (currentIndex - 1 + N) % N;
    updateDeckClasses();
  }
  
  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);
  
  frame.querySelectorAll('.deck-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index);
      if (idx === currentIndex) return;
      
      currentIndex = idx;
      updateDeckClasses();
    });
  });
  
  updateDeckClasses();
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function resetReviewForm() {
  document.getElementById('review-title').value = '';
  document.getElementById('review-text').value = '';
  document.getElementById('review-rating-value').value = '5';
  
  const starsOpt = document.querySelectorAll('.star-opt');
  starsOpt.forEach(s => s.classList.remove('selected'));
  // select first 5 stars by default
  starsOpt.forEach(s => s.classList.add('selected'));
}

function showToast(message) {
  console.log('Toast message:', message);
  const toast = document.getElementById('toast-notification');
  toast.textContent = message;
  toast.classList.remove('hidden');
  
  // Clear any existing timeout
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  
  window.toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.toLowerCase());
}

// --- CLOUDINARY INTEGRATION HELPERS ---
const CLOUDINARY_CONFIG = {
  cloudName: 'dvempuvvz',
  apiKey: '286167645161612',
  apiSecret: 'KoR2VXYFvlgQjD4YLOwDKEBEYlI'
};

async function generateCloudinarySignature(timestamp) {
  const message = `timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function uploadFileToCloudinary(file) {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = await generateCloudinarySignature(timestamp);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error?.message || 'Failed to upload image to Cloudinary.');
  }
  
  return await response.json();
}

function optimizeCloudinaryUrl(url) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) return url;
  if (url.includes('f_auto') || url.includes('q_auto')) return url;
  return url.replace('/image/upload/', '/image/upload/f_auto,q_auto/');
}

// --- MISSING VIEW IMPLEMENTATIONS ---

function renderAuthorArticlesList() {
  const container = document.getElementById('author-articles-list');
  if (!container) return;

  if (!state.currentUser) {
    container.innerHTML = '';
    return;
  }

  // Sync visual author sort tabs
  document.querySelectorAll('.author-sort-tab').forEach(tab => {
    if (tab.dataset.sort === state.authorSortBy) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const authorArticles = state.articles.filter(a => 
    a.author && a.author.name && a.author.name.toLowerCase() === state.currentUser.name.toLowerCase()
  );

  if (authorArticles.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; border: 1px dashed var(--color-border); border-radius: 4px; background-color: var(--color-card-bg);">
        <p style="color: var(--color-text-secondary); font-style: italic; font-size: 0.9rem; margin-bottom: 0;">You haven't written any publications yet.</p>
      </div>
    `;
    return;
  }

  // Sort author publications
  let sortedArticles = [...authorArticles];
  if (state.authorSortBy === 'date') {
    sortedArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
  } else if (state.authorSortBy === 'reads') {
    sortedArticles.sort((a, b) => (b.reads || 0) - (a.reads || 0));
  } else if (state.authorSortBy === 'reviews') {
    sortedArticles.sort((a, b) => (b.reviews ? b.reviews.length : 0) - (a.reviews ? a.reviews.length : 0));
  }

  container.innerHTML = sortedArticles.map(a => {
    let statusClass = 'status-pending';
    let statusLabel = 'Pending Review';
    if (a.status === 'Approved') {
      statusClass = 'status-approved';
      statusLabel = 'Published';
    }

    return `
      <div class="admin-item" style="padding: 1rem 1.25rem;">
        <div class="admin-item-header" style="margin-bottom: 0; align-items: center;">
          <div style="flex-grow: 1;">
            <span class="category-tag" style="font-size: 0.65rem;">${a.category}</span>
            <h4 style="font-size: 1.1rem; margin-top: 0.15rem; font-family: var(--font-serif); font-weight: 700; margin-bottom: 0;">
              <a href="#" class="author-pub-link" data-id="${a.id}" style="color: var(--color-text-primary); transition: var(--transition-fast);">${escapeHTML(a.title)}</a>
            </h4>
            <div class="admin-item-meta" style="margin-top: 0.35rem; font-size: 0.7rem; display: flex; gap: 0.8rem; align-items: center; color: var(--color-text-muted); flex-wrap: wrap;">
              <span>Submitted: ${a.date}</span>
              <span>&bull;</span>
              <span>${a.readTime}</span>
              <span>&bull;</span>
              <span style="display: inline-flex; align-items: center; gap: 0.2rem; color: var(--color-text-secondary); font-weight: 600;">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-1px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                ${a.reads || 0} reads
              </span>
              <span>&bull;</span>
              <span style="display: inline-flex; align-items: center; gap: 0.2rem; color: var(--color-text-secondary); font-weight: 600;">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-1px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                ${a.reviews ? a.reviews.length : 0} reviews
              </span>
            </div>
          </div>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
      </div>
    `;
  }).join('');

  // Attach navigation click events for writer drafts
  container.querySelectorAll('.author-pub-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('article', link.dataset.id);
    });
  });
}

function renderAdminView() {
  if (!state.currentUser || state.currentUser.role !== 'Admin') {
    showToast("Access Denied: Administrator privileges required.");
    navigateTo('home');
    return;
  }

  const pendingCountEl = document.getElementById('pending-count');
  const pendingListEl = document.getElementById('admin-pending-list');
  const publishedListEl = document.getElementById('admin-published-list');

  const pendingArticles = state.articles.filter(a => a.status === 'Pending');
  const approvedArticles = state.articles.filter(a => a.status === 'Approved');

  if (pendingCountEl) {
    pendingCountEl.textContent = pendingArticles.length;
  }

  if (state.adminActiveTab === 'pending') {
    if (pendingArticles.length === 0) {
      pendingListEl.innerHTML = `
        <div class="no-results" style="padding: 2.5rem; text-align: center; background-color: var(--color-card-bg); border: 1px solid var(--color-border); border-radius: 6px;">
          <p style="color: var(--color-text-secondary); font-style: italic; margin-bottom: 0;">No pending publications to review.</p>
        </div>
      `;
    } else {
      pendingListEl.innerHTML = pendingArticles.map(a => `
        <div class="admin-item" id="admin-item-${a.id}">
          <div class="admin-item-header">
            <div>
              <span class="category-tag">${a.category}</span>
              <h3 class="admin-item-title" style="margin-top: 0.25rem; font-family: var(--font-serif); font-weight: 700;">${escapeHTML(a.title)}</h3>
              <p style="font-size: 0.9rem; color: var(--color-text-secondary); margin-top: 0.25rem; font-family: var(--font-sans);">${escapeHTML(a.subtitle)}</p>
              <div class="admin-item-meta" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; color: var(--color-text-muted); font-size: 0.75rem;">
                <span>By <strong>${escapeHTML(a.author.name)}</strong> (${escapeHTML(a.author.role)})</span>
                <span>&bull;</span>
                <span>Submitted: ${a.date}</span>
                <span>&bull;</span>
                <span>${a.readTime}</span>
              </div>
            </div>
            <span class="status-badge status-pending">Pending Review</span>
          </div>
          <div class="admin-item-actions" style="display: flex; gap: 0.75rem; margin-top: 1rem;">
            <button class="btn-review" data-action="review" data-id="${a.id}">Review & Preview</button>
            <button class="btn-approve" data-action="approve" data-id="${a.id}">Authorize Publication</button>
            <button class="btn-reject" data-action="reject" data-id="${a.id}">Reject</button>
          </div>
          <div class="admin-item-preview hidden" id="preview-${a.id}" style="margin-top: 1rem;"></div>
        </div>
      `).join('');
    }
  } else {
    // published tab
    if (approvedArticles.length === 0) {
      publishedListEl.innerHTML = `
        <div class="no-results" style="padding: 2.5rem; text-align: center; background-color: var(--color-card-bg); border: 1px solid var(--color-border); border-radius: 6px;">
          <p style="color: var(--color-text-secondary); font-style: italic; margin-bottom: 0;">No published publications.</p>
        </div>
      `;
    } else {
      publishedListEl.innerHTML = approvedArticles.map(a => `
        <div class="admin-item">
          <div class="admin-item-header" style="margin-bottom: 0;">
            <div>
              <span class="category-tag">${a.category}</span>
              <h3 class="admin-item-title" style="margin-top: 0.25rem; font-family: var(--font-serif); font-weight: 700;">${escapeHTML(a.title)}</h3>
              <div class="admin-item-meta" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; color: var(--color-text-muted); font-size: 0.75rem;">
                <span>By <strong>${escapeHTML(a.author.name)}</strong></span>
                <span>&bull;</span>
                <span>Published: ${a.date}</span>
                <span>&bull;</span>
                <span>${a.readTime}</span>
              </div>
            </div>
            <span class="status-badge status-approved">Approved</span>
          </div>
          <div class="admin-item-actions" style="display: flex; gap: 0.75rem; margin-top: 1rem;">
            <button class="btn-review" data-action="view-pub" data-id="${a.id}">View Live</button>
            <button class="btn-reject" data-action="unpublish" data-id="${a.id}">Unpublish</button>
          </div>
        </div>
      `).join('');
    }
  }

  attachAdminActionEvents();
}

function attachAdminActionEvents() {
  document.querySelectorAll('#admin-view button[data-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const action = btn.dataset.action;
      const articleId = btn.dataset.id;
      const article = state.articles.find(a => a.id === articleId);

      if (!article) return;

      if (action === 'review') {
        const previewEl = document.getElementById(`preview-${articleId}`);
        if (previewEl.classList.contains('hidden')) {
          previewEl.innerHTML = `
            <div class="admin-item-preview" style="background-color: var(--color-bg-paper); border: 1px solid var(--color-border); border-radius: 4px; padding: 1.5rem; margin-top: 1rem;">
              <img src="${optimizeCloudinaryUrl(article.image)}" alt="Cover image" style="max-width: 100%; max-height: 250px; object-fit: cover; border-radius: 4px; margin-bottom: 1rem; display: block;" onerror="this.style.display='none'">
              <div class="admin-item-preview-content">
                <h4 style="font-family: var(--font-serif); font-size: 1.3rem; margin-bottom: 0.5rem; color: var(--color-text-primary);">${escapeHTML(article.title)}</h4>
                <p style="font-style: italic; font-size: 0.9rem; margin-bottom: 1rem; color: var(--color-text-secondary);">${escapeHTML(article.subtitle)}</p>
                <div class="article-body-content" style="font-family: var(--font-sans); font-size: 0.95rem; color: var(--color-text-primary); line-height: 1.6;">
                  ${article.content}
                </div>
              </div>
            </div>
          `;
          previewEl.classList.remove('hidden');
          btn.textContent = 'Collapse Preview';
        } else {
          previewEl.classList.add('hidden');
          btn.textContent = 'Review & Preview';
        }
      } else if (action === 'approve') {
        updateArticleRecord(articleId, {
          status: 'Approved'
        })
        .then(() => {
          showToast(`Article "${article.title}" approved and published!`);
          renderAdminView();
        })
        .catch(err => {
          console.error("Error approving article:", err);
          showToast("Error approving article: " + err.message);
        });
      } else if (action === 'reject') {
        if (confirm(`Are you sure you want to reject and delete the submission "${article.title}"?`)) {
          deleteArticleRecord(articleId)
            .then(() => {
              showToast(`Submission "${article.title}" was rejected and deleted.`);
              renderAdminView();
            })
            .catch(err => {
              console.error("Error rejecting article:", err);
              showToast("Error deleting article: " + err.message);
            });
        }
      } else if (action === 'view-pub') {
        navigateTo('article', articleId);
      } else if (action === 'unpublish') {
        if (confirm(`Are you sure you want to unpublish "${article.title}"? It will be moved back to the moderation queue.`)) {
          updateArticleRecord(articleId, {
            status: 'Pending'
          })
          .then(() => {
            showToast(`Article "${article.title}" unpublished.`);
            renderAdminView();
          })
          .catch(err => {
            console.error("Error unpublishing article:", err);
            showToast("Error unpublishing article: " + err.message);
          });
        }
      }
    });
  });
}

// Global initialization trigger
window.addEventListener('DOMContentLoaded', initApp);

// --- BOOKMARK DRAWER & SKELETON HELPERS ---

function renderBookmarkDrawerList() {
  const listContainer = document.getElementById('bookmark-drawer-list');
  if (!listContainer) return;

  if (state.bookmarks.length === 0) {
    listContainer.innerHTML = `
      <div class="bookmark-empty-state">
        <p>No saved articles yet. Bookmark a story to read it later.</p>
      </div>
    `;
    return;
  }

  // Find bookmarked articles
  const bookmarkedArticles = state.articles.filter(a => state.bookmarks.includes(a.id));

  listContainer.innerHTML = bookmarkedArticles.map(a => `
    <div class="bookmark-item" data-id="${a.id}">
      <img src="${optimizeCloudinaryUrl(a.image)}" alt="${escapeHTML(a.title)}" class="bookmark-item-img" onerror="this.src='https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=150&q=80'">
      <div class="bookmark-item-details">
        <span class="bookmark-item-category">${a.category}</span>
        <h4 class="bookmark-item-title" data-id="${a.id}">${escapeHTML(a.title)}</h4>
        <div class="bookmark-item-meta">${a.readTime}</div>
      </div>
      <span class="remove-bookmark-btn" data-id="${a.id}" title="Remove Bookmark">&times;</span>
    </div>
  `).join('');

  // Attach navigation events
  listContainer.querySelectorAll('.bookmark-item-title').forEach(titleEl => {
    titleEl.addEventListener('click', () => {
      const articleId = titleEl.dataset.id;
      // Close drawer first
      const bookmarkDrawer = document.getElementById('bookmark-drawer');
      const drawerOverlay = document.getElementById('drawer-overlay');
      if (bookmarkDrawer) bookmarkDrawer.classList.remove('open');
      if (drawerOverlay) drawerOverlay.classList.remove('open');
      
      navigateTo('article', articleId);
    });
  });

  // Attach remove events
  listContainer.querySelectorAll('.remove-bookmark-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const articleId = btn.dataset.id;
      toggleBookmark(articleId);
      renderBookmarkDrawerList(); // Re-render inside drawer
    });
  });
}

function toggleBookmark(articleId) {
  const index = state.bookmarks.indexOf(articleId);
  if (index === -1) {
    state.bookmarks.push(articleId);
    showToast("Story saved to bookmarks.");
  } else {
    state.bookmarks.splice(index, 1);
    showToast("Story removed from bookmarks.");
  }
  
  if (state.currentUser) {
    state.currentUser.bookmarks = state.bookmarks;
    localStorage.setItem('chronicle_user', JSON.stringify(state.currentUser));

    if (!state.currentUser.localOnly && db) {
      db.collection('users').doc(state.currentUser.uid).update({
        bookmarks: state.bookmarks
      })
      .catch(err => {
        console.error("Error updating user bookmarks in Firestore:", err);
      });
    }
  } else {
    localStorage.setItem('chronicle_bookmarks', JSON.stringify(state.bookmarks));
  }
  
  // Refresh bookmark button indicator if on article view
  if (state.currentView === 'article' && state.selectedArticleId === articleId) {
    const btn = document.getElementById('article-bookmark-btn');
    if (btn) {
      const isBookmarked = state.bookmarks.includes(articleId);
      if (isBookmarked) {
        btn.classList.add('active');
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-2px"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <span>Saved</span>
        `;
      } else {
        btn.classList.remove('active');
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-2px"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <span>Save Story</span>
        `;
      }
    }
  }
}

function renderSkeletonHome() {
  const featuredContainer = document.getElementById('featured-article-container');
  const gridContainer = document.getElementById('trending-articles-grid');

  featuredContainer.innerHTML = `
    <div class="skeleton-card" style="gap: 1.5rem;">
      <div class="skeleton-image" style="aspect-ratio: 16 / 9;"></div>
      <div class="skeleton-line meta" style="width: 10%;"></div>
      <div class="skeleton-line title" style="width: 60%; height: 32px;"></div>
      <div class="skeleton-line desc"></div>
      <div class="skeleton-line desc" style="width: 80%;"></div>
    </div>
  `;

  gridContainer.innerHTML = Array(3).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-image"></div>
      <div class="skeleton-line meta"></div>
      <div class="skeleton-line title"></div>
      <div class="skeleton-line desc"></div>
    </div>
  `).join('');
}

function renderSkeletonArticle() {
  const container = document.getElementById('article-detail-content');
  container.innerHTML = `
    <div class="skeleton-line meta" style="width: 15%; margin-bottom: 1.5rem;"></div>
    <div class="skeleton-line title" style="width: 85%; height: 40px; margin-bottom: 2rem;"></div>
    <div class="skeleton-image" style="aspect-ratio: 21 / 9; margin-bottom: 2.5rem;"></div>
    <div class="skeleton-line desc" style="margin-bottom: 1rem;"></div>
    <div class="skeleton-line desc" style="margin-bottom: 1rem;"></div>
    <div class="skeleton-line desc" style="width: 90%; margin-bottom: 1rem;"></div>
    <div class="skeleton-line desc" style="width: 75%; margin-bottom: 1rem;"></div>
  `;
}

function initAuthSidebarEffects() {
  const sidebar = document.querySelector('.auth-sidebar');
  const card = document.querySelector('.auth-sidebar-3d-card-inner');
  if (!sidebar || !card) return;

  sidebar.addEventListener('mousemove', (e) => {
    const rect = sidebar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Set custom property for dynamic moving glow gradient
    const glowX = (x / rect.width) * 100;
    const glowY = (y / rect.height) * 100;
    sidebar.style.setProperty('--glow-x', `${glowX}%`);
    sidebar.style.setProperty('--glow-y', `${glowY}%`);
    
    // 3D rotation logic for card
    const cardRect = card.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;
    
    const mouseXFromCardCenter = e.clientX - cardCenterX;
    const mouseYFromCardCenter = e.clientY - cardCenterY;
    
    // Normalize relative to sidebar dimensions to limit rotation angle
    const rotateY = (mouseXFromCardCenter / rect.width) * 35; // max 35deg
    const rotateX = -(mouseYFromCardCenter / rect.height) * 35; // max 35deg
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    card.style.boxShadow = `${-rotateY * 0.5}px ${rotateX * 0.5}px 30px rgba(0, 0, 0, 0.4)`;
  });

  sidebar.addEventListener('mouseleave', () => {
    // Reset values smoothly
    card.style.transition = 'transform 0.5s ease, box-shadow 0.5s ease';
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    card.style.boxShadow = '';
    
    sidebar.style.setProperty('--glow-x', '50%');
    sidebar.style.setProperty('--glow-y', '50%');
    
    setTimeout(() => {
      card.style.transition = '';
    }, 500);
  });
}

function setupSignupBadgeSync() {
  const nameInput = document.getElementById('signup-name');
  const badgeName = document.getElementById('badge-display-name');
  const roleSelect = document.getElementById('signup-role-type');
  const authorRoleInput = document.getElementById('signup-author-role');
  const badgeRole = document.getElementById('badge-display-role');

  if (nameInput && badgeName) {
    nameInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      badgeName.textContent = val !== '' ? val : 'Anonymous Member';
    });
  }

  function updateBadgeRole() {
    if (!badgeRole) return;
    const roleVal = roleSelect ? roleSelect.value : 'Reader';
    if (roleVal === 'Author') {
      const specVal = authorRoleInput ? authorRoleInput.value.trim() : '';
      badgeRole.textContent = specVal !== '' ? specVal : 'Journalist / Author';
    } else {
      badgeRole.textContent = 'Reader / Subscriber';
    }
  }

  if (roleSelect) {
    roleSelect.addEventListener('change', updateBadgeRole);
  }
  if (authorRoleInput) {
    authorRoleInput.addEventListener('input', updateBadgeRole);
  }

  // Also sync with the custom role cards click inside index.html's inline script
  const roleCards = document.querySelectorAll('.role-card');
  roleCards.forEach(card => {
    card.addEventListener('click', () => {
      // Small timeout to let the inline select sync complete
      setTimeout(updateBadgeRole, 50);
    });
  });
}
