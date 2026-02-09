document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    // Helper for Monday
    function getMonday(d) {
        d = new Date(d);
        var day = d.getDay(),
            diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
        return new Date(d.setDate(diff));
    }
    
    function isToday(someDate) {
        const today = new Date();
        return someDate.getDate() == today.getDate() &&
            someDate.getMonth() == today.getMonth() &&
            someDate.getFullYear() == today.getFullYear();
    }
    const state = {
        habits: JSON.parse(localStorage.getItem('habits')) || [
            { id: 1, name: 'Drink Water', icon: '💧', width: 150, checks: {} },
            { id: 2, name: 'Exercise', icon: '🏃', width: 150, checks: {} }
        ],
        currentMonth: new Date().getMonth(),
        currentYear: new Date().getFullYear(),
        view: 'weekly', // Default to weekly
        viewDate: getMonday(new Date()) // Start date of currently viewed week
    };
    
    // Migration: Ensure all habits have icons and width
    state.habits.forEach(h => {
        if (!h.icon) h.icon = '✨';
        if (!h.width) h.width = 150; // Default width
    });

    // --- DOM ELEMENTS ---
    const elements = {
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

    // --- INITIALIZATION ---
    function init() {
        populateDateSelectors();
        renderGrid();
        updateStats();
        setupEventListeners();
        // updateWeekLabel(); // Removed as it's now handled in renderGrid
    }

    // --- HELPERS ---
    function getDaysInMonth(month, year) {
        return new Date(year, month + 1, 0).getDate();
    }

    function formatDateKey(date) {
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    function saveState() {
        localStorage.setItem('habits', JSON.stringify(state.habits));
    }

    function updateWeekLabel() {
        if (state.view === 'weekly') {
            const end = new Date(state.currentWeekStart);
            end.setDate(end.getDate() + 6);
            
            const options = { month: 'short', day: 'numeric' };
            const startStr = state.currentWeekStart.toLocaleDateString('en-US', options);
            const endStr = end.toLocaleDateString('en-US', options);
            
            if (elements.currentWeekLabel) elements.currentWeekLabel.innerText = `${startStr} - ${endStr}`;
            if (elements.weekControls) elements.weekControls.style.display = 'flex';
        } else {
            if (elements.weekControls) elements.weekControls.style.display = 'none';
        }
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

 // --- RENDER GRID (TRANSPOSED) ---
function renderGrid() {
    const habitsHeader = document.getElementById('habitsHeader');
    const daysRowsContainer = document.getElementById('daysRowsContainer');
    
    if (!habitsHeader || !daysRowsContainer) return;

    habitsHeader.innerHTML = '';
    daysRowsContainer.innerHTML = '';

    // Initialize viewDate if missing
    if (!state.viewDate) state.viewDate = new Date();
    
    // Determine Start Date and Number of Days based on View
    let startDate, daysCount;
    
    if (state.view === 'weekly') {
        startDate = getMonday(new Date(state.viewDate));
        daysCount = 7;
        // Update Label
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        updateLabel(`${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
        // Ensure week controls are visible
        if(elements.weekControls) elements.weekControls.style.display = 'flex';
    } else {
        // Monthly or Yearly (treating Yearly as Monthly for now to handle grid size)
        startDate = new Date(state.currentYear, state.currentMonth, 1);
        daysCount = getDaysInMonth(state.currentMonth, state.currentYear);
        updateLabel(`${startDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`);
        // Hide week controls in monthly view
        if(elements.weekControls) elements.weekControls.style.display = 'none';
    }

    // 1. Render Habits Header (Columns)
    state.habits.forEach(habit => {
        const col = document.createElement('div');
        col.className = 'habit-col-title';
        if (habit.width < 80) col.classList.add('collapsed');
        col.style.width = `${habit.width}px`;
        col.dataset.id = habit.id;
        
        // Icon Input
        const iconInput = document.createElement('input');
        iconInput.className = 'habit-icon-input';
        iconInput.value = habit.icon;
        iconInput.maxLength = 2; // Limit to 1-2 chars (emoji)
        iconInput.onchange = (e) => updateHabitIcon(habit.id, e.target.value);
        
        // Name Input
        const input = document.createElement('input');
        input.className = 'habit-name-input';
        input.value = habit.name;
        input.onchange = (e) => updateHabitName(habit.id, e.target.value);
        
        const del = document.createElement('button');
        del.className = 'delete-habit-btn';
        del.innerText = '×';
        del.onclick = () => deleteHabit(habit.id);
        
        // Resize Handle
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.onmousedown = (e) => initResize(e, habit.id);

        col.appendChild(iconInput);
        col.appendChild(input);
        col.appendChild(del);
        col.appendChild(handle);
        habitsHeader.appendChild(col);
    });

    // 2. Render Day Rows
    for (let i = 0; i < daysCount; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        const dateKey = formatDateKey(d);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNum = d.getDate();
        
        const row = document.createElement('div');
        row.className = 'day-row';
        
        // Day Label (Left Column)
        const labelCell = document.createElement('div');
        labelCell.className = 'day-label-cell';
        labelCell.innerHTML = `<span>${dayName}</span><span class="date-num">${dayNum}</span>`;
        
        const todayKey = formatDateKey(new Date());
        if (dateKey === todayKey) {
            labelCell.style.color = 'var(--accent-light)';
            labelCell.style.fontWeight = 'bold';
        }
        
        row.appendChild(labelCell);
        
        // Checkboxes (Columns)
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
    
    // Update Stats based on this view
    updateStats();
}

function updateLabel(text) {
    if (elements.currentWeekLabel) elements.currentWeekLabel.innerText = text;
}        

    function updateStats() {
        // Stats Logic:
        // Calculate completion based on the Current Week displayed if in Weekly view
        // Or global stats? Let's make it reflect the current view.
        
        let totalChecks = 0;
        let checkedCount = 0;
        let bestStreak = 0; // Simplified for now
        
        // Helper to check if a date string is within the current viewing window
        // For simplicity, just count ALL checks for stats or current month checks.
        // Let's stick to Current Month like before for consistency, 
        // OR better: if View is Weekly, show stats for THIS WEEK.
        
        if (state.view === 'weekly') {
            const start = new Date(state.currentWeekStart);
            for (let i = 0; i < 7; i++) {
                const d = new Date(start);
                d.setDate(start.getDate() + i);
                const key = formatDateKey(d);
                
                state.habits.forEach(habit => {
                    totalChecks++;
                    if (habit.checks[key]) checkedCount++;
                });
            }
        } else {
             // Fallback to monthly stats (generic)
             const daysCount = getDaysInMonth(state.currentMonth, state.currentYear);
             state.habits.forEach(habit => {
                 for(let d=1; d<=daysCount; d++) {
                     // Note: this assumes we only track by currentYear-currentMonth-d, 
                     // but formatDateKey might use d.getMonth() which is 0-indexed. 
                     // My previous logic was Year-Month-Day. 
                     // formatDateKey uses getMonth() (0-11).
                     // Previous logic: `${state.currentYear}-${state.currentMonth}-${d}`.
                     // formatDateKey: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`.
                     // Consistently use 0-indexed months.
                     const key = `${state.currentYear}-${state.currentMonth}-${d}`;
                     totalChecks++;
                     if (habit.checks[key]) checkedCount++;
                 }
             });
        }

        const percent = totalChecks === 0 ? 0 : Math.round((checkedCount / totalChecks) * 100);
        
        // Update Progress Bar
        elements.progressBar.style.width = `${percent}%`;
        elements.progressText.innerText = `${percent}%`;
        elements.chartPercentage.innerText = `${percent}%`;

        // Update Insight Text
        const weeklyVal = Math.round(percent); 
        const weeklyEl = document.getElementById('weeklyStats');
        if(weeklyEl) weeklyEl.innerText = `${weeklyVal}%`;

        document.getElementById('monthlyVal').innerText = `${percent}%`; // Reusing same calc for now as placeholder
        
        // Best Streak (Global calculation is expensive, let's just use current week streak)
        // A real streak calc would need to sort all keys.
        document.getElementById('bestStreak').innerText = `CALC...`; // Placeholder

        drawChart(percent);
    }

    function drawChart(percent) {
        const ctx = elements.canvas.getContext('2d');
        const centerX = elements.canvas.width / 2;
        const centerY = elements.canvas.height / 2;
        const radius = 70;

        ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);

        // Background Circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; 
        ctx.stroke();

        // Progress Arc
        const startAngle = -0.5 * Math.PI;
        const endAngle = (2 * Math.PI * (percent / 100)) - (0.5 * Math.PI);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#4361ee'; // Accent color Blue
        ctx.lineCap = 'round';
        // Add Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4cc9f0';
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset
    }

    // --- ACTIONS ---
    function toggleCheck(habitId, dayKey) {
        const habit = state.habits.find(h => h.id === habitId);
        if (habit) {
            habit.checks[dayKey] = !habit.checks[dayKey];
            saveState(); // Auto-save
            renderGrid(); // Re-render to update UI state
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
        
        // Trigger a render
        renderGrid();
    }
    
    // Removed old updateWeekLabel as it's now handled in renderGrid
    // Removed updateHabitName (duplicate) if any? No, checking.

    // --- EVENT LISTENERS ---
    let listenersAttached = false;
    function setupEventListeners() {
        if (listenersAttached) return;
        listenersAttached = true;

        elements.monthSelect.addEventListener('change', (e) => {
            state.currentMonth = parseInt(e.target.value);
            // reset view date to start of that month
            state.viewDate = new Date(state.currentYear, state.currentMonth, 1);
            renderGrid();
        });
        
        elements.yearSelect.addEventListener('change', (e) => {
            state.currentYear = parseInt(e.target.value);
            state.viewDate = new Date(state.currentYear, state.currentMonth, 1);
            renderGrid();
        });

        // Week Navigation
        if(elements.prevWeekBtn) elements.prevWeekBtn.addEventListener('click', () => changeWeek(-1));
        if(elements.nextWeekBtn) elements.nextWeekBtn.addEventListener('click', () => changeWeek(1));

        elements.addHabitBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent any default action
            e.stopPropagation(); // Stop bubbling
            addHabit();
        });
        
        elements.saveBtn.addEventListener('click', () => {
            saveState();
            // Custom Toast
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

    // Global Resize Listeners
    window.addEventListener('mousemove', (e) => {
        if (!resizeState.isResizing) return;
        
        const deltaX = e.clientX - resizeState.startX;
        let newWidth = resizeState.startWidth + deltaX;
        
        // Constraints
        if (newWidth < 50) newWidth = 50; // Min width (icon size)
        if (newWidth > 400) newWidth = 400; // Max width

        const habit = state.habits.find(h => h.id === resizeState.habitId);
        if (habit) {
            habit.width = newWidth;
            // Immediate DOM update for performance (skip full render)
            updateColumnWidth(habit.id, newWidth);
        }
    });

    window.addEventListener('mouseup', () => {
        if (resizeState.isResizing) {
            resizeState.isResizing = false;
            document.body.style.cursor = 'default';
            saveState(); // Persist new width
            renderGrid(); // Final render to ensure clean state
        }
    });

    function updateColumnWidth(habitId, width) {
        // Update Header
        const headerCol = document.querySelector(`.habit-col-title[data-id="${habitId}"]`);
        if (headerCol) {
            headerCol.style.width = `${width}px`;
            if (width < 80) headerCol.classList.add('collapsed');
            else headerCol.classList.remove('collapsed');
        }

        // Update All Cells in Rows
        const cells = document.querySelectorAll(`.check-cell[data-id="${habitId}"]`);
        cells.forEach(cell => {
            cell.style.width = `${width}px`;
        });
    }

    // Start App
    // Check if already initialized to prevent double-run
    if (!window.appInitialized) {
        window.appInitialized = true;
        init();
    }
});
