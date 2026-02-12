document.addEventListener('DOMContentLoaded', async () => {
    // --- FIREBASE CONFIGURATION ---
    // User requested: Login "Sandeep" / "Sandeep@123"
    // To enable Cross-Device Sync, you MUST replace these placeholders with your actual Firebase Project config.
    const firebaseConfig = {
    apiKey: "AIzaSyDNsyEiW5zmlSa7wbqZSnp7-Kz4t2NTQ90",
    authDomain: "habit-tracker-login-9972.firebaseapp.com",
    projectId: "habit-tracker-login-9972",
    storageBucket: "habit-tracker-login-9972.firebasestorage.app",
    messagingSenderId: "829866636156",
    appId: "1:829866636156:web:1a7b3e15561f04c6ffeaf9",
    measurementId: "G-VY5FWZR71R"
};

    let db = null;
    let auth = null;
    let isFirebaseActive = false;
    let currentUser = null;

    // --- DOM ELEMENTS ---
    const elements = {
        loginOverlay: document.getElementById('loginOverlay'),
        loginForm: document.getElementById('loginForm'),
        usernameInput: document.getElementById('username'),
        passwordInput: document.getElementById('password'),
        loginError: document.getElementById('loginError'),
        appContainer: document.getElementById('appContainer'),
        
        monthSelect: document.getElementById('monthSelect'),
        yearSelect: document.getElementById('yearSelect'),
        daysHeader: document.getElementById('daysHeader'),
        habitList: document.getElementById('habitList'),
        addHabitBtn: document.getElementById('addHabitBtn'),
        saveBtn: document.getElementById('saveBtn'),
        progressBar: document.getElementById('progressBar'),
        progressText: document.getElementById('progressText'),
        chartPercentage: document.getElementById('chartPercentage'),
        canvas: document.getElementById('statsChart'),
        tabs: document.querySelectorAll('.tab-btn'),
        duplicateBtn: document.getElementById('duplicateBtn'),
        exportBtn: document.getElementById('exportBtn'),
        prevWeekBtn: document.getElementById('prevWeekBtn'),
        nextWeekBtn: document.getElementById('nextWeekBtn'),
        currentWeekLabel: document.getElementById('currentWeekLabel'),
        weekControls: document.getElementById('weekControls')
    };

    // Initialize Firebase
    function initFirebase() {
        if (firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_API_KEY" && typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                db = firebase.firestore();
                auth = firebase.auth();
                isFirebaseActive = true;
                console.log("Firebase initialized successfully.");
            } catch (e) {
                console.error("Firebase initialization failed:", e);
                showLoginError("Firebase Error: Check console for details.");
            }
        } else {
            console.log("Firebase config missing or SDK not loaded. using Local Mode.");
        }
    }

    // --- STATE MANAGEMENT ---
    function getMonday(d) {
        d = new Date(d);
        var day = d.getDay(),
            diff = d.getDate() - day + (day == 0 ? -6 : 1); 
        return new Date(d.setDate(diff));
    }

    const defaultHabits = [
        { id: 1, name: 'Drink Water', icon: '💧', width: 150, checks: {} },
        { id: 2, name: 'Exercise', icon: '🏃', width: 150, checks: {} }
    ];

    const state = {
        habits: [],
        currentMonth: new Date().getMonth(),
        currentYear: new Date().getFullYear(),
        view: 'weekly',
        viewDate: getMonday(new Date())
    };


    // --- LOGIN LOGIC ---
    // Toggle Password Visibility
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', () => {
            const type = elements.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            elements.passwordInput.setAttribute('type', type);
            togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }

    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = elements.usernameInput.value.trim();
        const password = elements.passwordInput.value;
        
        elements.loginError.innerText = "";
        elements.loginError.style.display = 'none';

        // HARDCODED CREDENTIAL CHECK (As requested)
        // Correct Credentials: Master / Sandeep@9972
        if (username !== "Master" || password !== "Sandeep@9972") {
            showLoginError("Invalid username or password.");
            return;
        }

        // Use a NEW email purely for this new "Master" identity
        // This ensures the new password works without conflict
        const email = "master@tracker.app"; 

        if (isFirebaseActive) {
            try {
                // STRATEGY: Create User First (Ensures account exists)
                await auth.createUserWithEmailAndPassword(email, password);
                
                // Success! Update profile
                await auth.currentUser.updateProfile({ displayName: username });
                console.log("Account created & logged in!");

            } catch (error) {
                // If email already in use -> Try Signing In
                if (error.code === 'auth/email-already-in-use') {
                    try {
                        await auth.signInWithEmailAndPassword(email, password);
                        console.log("Logged in successfully!");
                    } catch (signInError) {
                         // Wrong password or other sign-in issue
                         console.error("Sign-in error:", signInError);
                         let msg = signInError.message;
                         if (signInError.code === 'auth/wrong-password' || signInError.message.includes("INVALID_LOGIN_CREDENTIALS")) {
                             msg = "Invalid password.";
                         }
                         showLoginError(msg);
                         return;
                    }
                } else {
                    // Other creation error
                    console.error("Creation error:", error);
                    showLoginError("Login Error: " + error.message);
                    return;
                }
            }
        } else {
            // Local Mode Login
            console.warn("Firebase not configured. Using local session.");
        }

        // Successful Login (if we reached here without returning)
        onLoginSuccess(username);
    });

    function showLoginError(msg) {
        elements.loginError.innerText = msg;
        elements.loginError.style.display = 'block';
    }

    async function onLoginSuccess(username) {
        // Hide Overlay
        elements.loginOverlay.style.opacity = '0';
        setTimeout(() => {
            elements.loginOverlay.style.display = 'none';
        }, 500);

        // Show App
        elements.appContainer.style.display = 'flex';
        // Trigger reflow/animation if needed
        
        // Load Data
        state.habits = await loadData();
        
        // Initialize App
        initApp();
    }


    // --- STORAGE MANAGER ---
    async function loadData() {
        // Ensure defaults have icons/width
        function validate(habits) {
            if (!Array.isArray(habits)) return defaultHabits;
            habits.forEach(h => {
                if (!h.icon) h.icon = '✨';
                if (!h.width) h.width = 150;
            });
            return habits;
        }

        if (isFirebaseActive && auth.currentUser) {
            try {
                const uid = auth.currentUser.uid;
                const docRef = db.collection('habits').doc(uid);
                const doc = await docRef.get();
                
                if (doc.exists) {
                    return validate(doc.data().habits);
                } else {
                    // First time for this cloud user? Try to sync local data or use default
                    const localData = JSON.parse(localStorage.getItem('habits_sandeep')); // separate key
                    const initialData = localData || defaultHabits;
                    await docRef.set({ habits: initialData });
                    return validate(initialData);
                }
            } catch (e) {
                console.error("Cloud load failed:", e);
                return validate(JSON.parse(localStorage.getItem('habits_sandeep')) || defaultHabits);
            }
        } else {
            // Local fallback (Keyed by user to simulate multitenancy locally)
            return validate(JSON.parse(localStorage.getItem('habits_sandeep')) || defaultHabits);
        }
    }

    async function saveData() {
        // Save to LocalStorage (Always backup)
        localStorage.setItem('habits_sandeep', JSON.stringify(state.habits));

        if (isFirebaseActive && auth.currentUser) {
            try {
                const uid = auth.currentUser.uid;
                await db.collection('habits').doc(uid).set({
                    habits: state.habits,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log("Saved to Cloud");
            } catch (e) {
                console.error("Cloud save failed:", e);
            }
        }
    }
    
    // --- MAIN APP LOGIC ---
    function initApp() {
        populateDateSelectors();
        renderGrid();
        updateStats();
        setupEventListeners();
    }

    // --- HELPERS ---
    function getDaysInMonth(month, year) {
        return new Date(year, month + 1, 0).getDate();
    }

    function formatDateKey(date) {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    function saveState() {
        saveData(); 
    }

    // --- RENDERING ---
    function populateDateSelectors() {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        elements.monthSelect.innerHTML = '';
        months.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = m;
            if (i === state.currentMonth) opt.selected = true;
            elements.monthSelect.appendChild(opt);
        });

        const year = new Date().getFullYear();
        elements.yearSelect.innerHTML = '';
        for (let y = year - 2; y <= year + 5; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.text = y;
            if (y === state.currentYear) opt.selected = true;
            elements.yearSelect.appendChild(opt);
        }
    }

    function renderGrid() {
        const habitsHeader = document.getElementById('habitsHeader');
        const daysRowsContainer = document.getElementById('daysRowsContainer');
        
        if (!habitsHeader || !daysRowsContainer) return;

        habitsHeader.innerHTML = '';
        daysRowsContainer.innerHTML = '';

        if (!state.viewDate) state.viewDate = new Date();
        
        let startDate, daysCount;
        
        if (state.view === 'weekly') {
            startDate = getMonday(new Date(state.viewDate));
            daysCount = 7;
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            updateLabel(`${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
            if(elements.weekControls) elements.weekControls.style.display = 'flex';
        } else {
            startDate = new Date(state.currentYear, state.currentMonth, 1);
            daysCount = getDaysInMonth(state.currentMonth, state.currentYear);
            updateLabel(`${startDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`);
            if(elements.weekControls) elements.weekControls.style.display = 'none';
        }

        // Render Habits Header
        state.habits.forEach(habit => {
            const col = document.createElement('div');
            col.className = 'habit-col-title';
            if (habit.width < 80) col.classList.add('collapsed');
            col.style.width = `${habit.width}px`;
            col.dataset.id = habit.id;
            
            const iconInput = document.createElement('input');
            iconInput.className = 'habit-icon-input';
            iconInput.value = habit.icon;
            iconInput.maxLength = 2;
            iconInput.onchange = (e) => updateHabitIcon(habit.id, e.target.value);
            
            const input = document.createElement('input');
            input.className = 'habit-name-input';
            input.value = habit.name;
            input.onchange = (e) => updateHabitName(habit.id, e.target.value);
            
            const del = document.createElement('button');
            del.className = 'delete-habit-btn';
            del.innerText = '×';
            del.onclick = () => deleteHabit(habit.id);
            
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            handle.onmousedown = (e) => initResize(e, habit.id);

            col.appendChild(iconInput);
            col.appendChild(input);
            col.appendChild(del);
            col.appendChild(handle);
            habitsHeader.appendChild(col);
        });

        // Render Rows
        for (let i = 0; i < daysCount; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateKey = formatDateKey(d);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = d.getDate();
            
            const row = document.createElement('div');
            row.className = 'day-row';
            
            const labelCell = document.createElement('div');
            labelCell.className = 'day-label-cell';
            labelCell.innerHTML = `<span>${dayName}</span><span class="date-num">${dayNum}</span>`;
            
            const todayKey = formatDateKey(new Date());
            if (dateKey === todayKey) {
                labelCell.style.color = 'var(--accent-light)';
                labelCell.style.fontWeight = 'bold';
            }
            
            row.appendChild(labelCell);
            
            state.habits.forEach(habit => {
                const cell = document.createElement('div');
                cell.className = 'check-cell';
                cell.style.width = `${habit.width}px`;
                cell.dataset.id = habit.id;
                
                const checkbox = document.createElement('div');
                checkbox.className = 'custom-checkbox';
                if (habit.checks && habit.checks[dateKey]) {
                    checkbox.classList.add('checked');
                }
                checkbox.onclick = () => toggleCheck(habit.id, dateKey);
                
                cell.appendChild(checkbox);
                row.appendChild(cell);
            });
            
            daysRowsContainer.appendChild(row);
        }
        
        updateStats();
    }

    function updateLabel(text) {
        if (elements.currentWeekLabel) elements.currentWeekLabel.innerText = text;
    }        

    function calculateStreak(habit) {
        if (!habit.checks || Object.keys(habit.checks).length === 0) return 0;
        const dates = Object.keys(habit.checks)
            .filter(k => habit.checks[k]) 
            .map(k => new Date(k))
            .sort((a, b) => a - b);
        
        if (dates.length === 0) return 0;

        let maxStreak = 1;
        let currentStreak = 1;

        for (let i = 1; i < dates.length; i++) {
            const prev = dates[i-1];
            const curr = dates[i];
            const diffTime = Math.abs(curr - prev);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            if (diffDays === 1) {
                currentStreak++;
            } else if (diffDays > 1) {
                if (currentStreak > maxStreak) maxStreak = currentStreak;
                currentStreak = 1;
            }
        }
        if (currentStreak > maxStreak) maxStreak = currentStreak;
        return maxStreak;
    }

    function updateStats() {
        function calcStats(startDate, days) {
            let total = 0;
            let checked = 0;
            for (let i = 0; i < days; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                const key = formatDateKey(d);
                state.habits.forEach(habit => {
                    total++;
                    if (habit.checks && habit.checks[key]) checked++;
                });
            }
            return total === 0 ? 0 : Math.round((checked / total) * 100);
        }

        const daysInMonth = getDaysInMonth(state.currentMonth, state.currentYear);
        const monthStart = new Date(state.currentYear, state.currentMonth, 1);
        const monthlyPercent = calcStats(monthStart, daysInMonth);

        const currentWeekStart = getMonday(new Date());
        const currentWeekPercent = calcStats(currentWeekStart, 7);

        let mainPercent = 0;
        if (state.view === 'weekly') {
            const viewWeekStart = getMonday(new Date(state.viewDate));
            mainPercent = calcStats(viewWeekStart, 7);
        } else {
            mainPercent = monthlyPercent;
        }

        if (elements.progressBar) elements.progressBar.style.width = `${mainPercent}%`;
        if (elements.progressText) elements.progressText.innerText = `${mainPercent}%`;
        if (elements.chartPercentage) elements.chartPercentage.innerText = `${mainPercent}%`;

        const weeklyEl = document.getElementById('weeklyStats');
        if (weeklyEl) weeklyEl.innerText = `${currentWeekPercent}%`;

        const monthlyEl = document.getElementById('monthlyVal');
        if (monthlyEl) monthlyEl.innerText = `${monthlyPercent}%`;
        
        let globalBestStreak = 0;
        state.habits.forEach(h => {
            const s = calculateStreak(h);
            if (s > globalBestStreak) globalBestStreak = s;
        });
        const streakEl = document.getElementById('bestStreak');
        if(streakEl) streakEl.innerText = `${globalBestStreak} days`;

        drawChart(mainPercent);
    }

    function drawChart(percent) {
        const ctx = elements.canvas.getContext('2d');
        const centerX = elements.canvas.width / 2;
        const centerY = elements.canvas.height / 2;
        const radius = 70;

        ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; 
        ctx.stroke();

        const startAngle = -0.5 * Math.PI;
        const endAngle = (2 * Math.PI * (percent / 100)) - (0.5 * Math.PI);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#4361ee'; 
        ctx.lineCap = 'round';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4cc9f0';
        ctx.stroke();
        ctx.shadowBlur = 0; 
    }

    function toggleCheck(habitId, dayKey) {
        const habit = state.habits.find(h => h.id === habitId);
        if (habit) {
            habit.checks[dayKey] = !habit.checks[dayKey];
            saveState();
            renderGrid();
            updateStats();
        }
    }

    function addHabit() {
        const icons = ['✨', '🔥', '💧', '📚', '🧘', '💪', '💤', '🌱'];
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        
        const newHabit = {
            id: Date.now(),
            name: 'New Habit',
            icon: randomIcon,
            width: 150,
            checks: {}
        };
        state.habits.push(newHabit);
        saveState();
        renderGrid();
        updateStats(); 
    }

    function deleteHabit(id) {
        if (confirm('Delete this habit?')) {
            state.habits = state.habits.filter(h => h.id !== id);
            saveState();
            renderGrid();
            updateStats();
        }
    }

    function updateHabitName(id, newName) {
        const habit = state.habits.find(h => h.id === id);
        if (habit) {
            habit.name = newName;
            saveState();
        }
    }
    
    function updateHabitIcon(id, newIcon) {
        const habit = state.habits.find(h => h.id === id);
        if (habit) {
            habit.icon = newIcon;
            saveState();
        }
    }

    function changeWeek(offset) {
        if (!state.viewDate) state.viewDate = new Date();
        const newDate = new Date(state.viewDate);
        newDate.setDate(newDate.getDate() + (offset * 7));
        state.viewDate = newDate;
        renderGrid();
    }

    // --- EVENT LISTENERS ---
    let listenersAttached = false;
    function setupEventListeners() {
        if (listenersAttached) return;
        listenersAttached = true;

        elements.monthSelect.addEventListener('change', (e) => {
            state.currentMonth = parseInt(e.target.value);
            state.viewDate = new Date(state.currentYear, state.currentMonth, 1);
            renderGrid();
        });
        
        elements.yearSelect.addEventListener('change', (e) => {
            state.currentYear = parseInt(e.target.value);
            state.viewDate = new Date(state.currentYear, state.currentMonth, 1);
            renderGrid();
        });

        if(elements.prevWeekBtn) elements.prevWeekBtn.addEventListener('click', () => changeWeek(-1));
        if(elements.nextWeekBtn) elements.nextWeekBtn.addEventListener('click', () => changeWeek(1));

        elements.addHabitBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            e.stopPropagation(); 
            addHabit();
        });
        
        elements.saveBtn.addEventListener('click', () => {
            saveState();
            const btn = elements.saveBtn;
            const originalText = btn.innerText;
            btn.innerText = 'Saved!';
            btn.style.background = '#3cffb3';
            btn.style.color = '#000';
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.background = '';
                btn.style.color = '';
            }, 1000);
        });

        elements.duplicateBtn.addEventListener('click', () => {
            if (confirm('Duplicate this tracker configuration? (Resets checks)')) {
                state.habits.forEach(h => h.checks = {});
                saveState();
                renderGrid();
                updateStats();
                alert('Tracker duplicated!');
            }
        });
        
        elements.exportBtn.addEventListener('click', () => {
            window.print();
        });

        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                elements.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                state.view = tab.dataset.tab;
                renderGrid();
            });
        });
    }

    // --- RESIZE LOGIC ---
    let resizeState = {
        isResizing: false,
        habitId: null,
        startX: 0,
        startWidth: 0
    };

    function initResize(e, habitId) {
        e.preventDefault();
        e.stopPropagation();
        const habit = state.habits.find(h => h.id === habitId);
        if (!habit) return;

        resizeState = {
            isResizing: true,
            habitId: habitId,
            startX: e.clientX,
            startWidth: habit.width || 150
        };
        
        document.body.style.cursor = 'col-resize';
    }

    window.addEventListener('mousemove', (e) => {
        if (!resizeState.isResizing) return;
        
        const deltaX = e.clientX - resizeState.startX;
        let newWidth = resizeState.startWidth + deltaX;
        if (newWidth < 50) newWidth = 50; 
        if (newWidth > 400) newWidth = 400; 

        const habit = state.habits.find(h => h.id === resizeState.habitId);
        if (habit) {
            habit.width = newWidth;
            updateColumnWidth(habit.id, newWidth);
        }
    });

    window.addEventListener('mouseup', () => {
        if (resizeState.isResizing) {
            resizeState.isResizing = false;
            document.body.style.cursor = 'default';
            saveState(); 
            renderGrid(); 
        }
    });

    function updateColumnWidth(habitId, width) {
        const headerCol = document.querySelector(`.habit-col-title[data-id="${habitId}"]`);
        if (headerCol) {
            headerCol.style.width = `${width}px`;
            if (width < 80) headerCol.classList.add('collapsed');
            else headerCol.classList.remove('collapsed');
        }
        const cells = document.querySelectorAll(`.check-cell[data-id="${habitId}"]`);
        cells.forEach(cell => {
            cell.style.width = `${width}px`;
        });
    }

    // MAIN ENTRY
    initFirebase();
    // (Note: We wait for user login in the UI before initializing app content)
});
