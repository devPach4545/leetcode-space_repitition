import { useState, useEffect } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
// Optional, but doing it manually below to keep deps low

const API_URL = 'http://localhost:3001/api';

function App() {
  const [newQuestion, setNewQuestion] = useState('');
  // selectedDate is for the List view
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  // currentMonth is for the Calendar view navigation
  const [currentMonth, setCurrentMonth] = useState(dayjs()); 
  const [tasks, setTasks] = useState([]);
  const [calendarStats, setCalendarStats] = useState({});
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [editingNotes, setEditingNotes] = useState({});

  // Fetch data
  const fetchData = async () => {
    // Get tasks for the selected date (List view)
    const tasksRes = await axios.get(`${API_URL}/schedule?date=${selectedDate}`);
    setTasks(tasksRes.data);

    // Get stats for dots on the calendar
    const statsRes = await axios.get(`${API_URL}/calendar-stats`);
    const statsMap = {};
    statsRes.data.forEach(item => {
      statsMap[item.due_date] = item.count;
    });
    setCalendarStats(statsMap);
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newQuestion) return;
    await axios.post(`${API_URL}/questions`, { title: newQuestion });
    setNewQuestion('');
    fetchData(); 
  };

  const toggleTask = async (id) => {
    await axios.post(`${API_URL}/schedule/${id}/toggle`);
    fetchData();
  };

  const toggleNotes = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const parseNotes = (notesString) => {
    if (!notesString) return { bruteForce: '', optimized: '' };
    try {
      const parsed = JSON.parse(notesString);
      return {
        bruteForce: parsed.bruteForce || '',
        optimized: parsed.optimized || ''
      };
    } catch {
      return { bruteForce: notesString, optimized: '' };
    }
  };

  const handleNotesChange = (questionId, field, value) => {
    setEditingNotes(prev => {
      const current = prev[questionId] || parseNotes(tasks.find(t => t.question_id === questionId)?.notes || '');
      return {
        ...prev,
        [questionId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const saveNotes = async (questionId) => {
    const notesData = editingNotes[questionId] || parseNotes(tasks.find(t => t.question_id === questionId)?.notes || '');
    const notesString = JSON.stringify(notesData);
    
    try {
      await axios.put(`${API_URL}/questions/${questionId}/notes`, { notes: notesString });
      fetchData();
      // Remove from editing state after save
      setEditingNotes(prev => {
        const newState = { ...prev };
        delete newState[questionId];
        return newState;
      });
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  // --- Calendar Logic ---
  const daysInMonth = currentMonth.daysInMonth();
  const firstDayOfMonth = currentMonth.startOf('month').day(); // 0 (Sun) to 6 (Sat)
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptySlots = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const changeMonth = (val) => {
    setCurrentMonth(currentMonth.add(val, 'month'));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-800 font-sans">
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Calendar & Input */}
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-indigo-700">LeetCode Scheduler</h1>

          {/* Add Question Input */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter Question (e.g. LC 43)"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:border-indigo-500 text-sm"
              />
              <button 
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm font-semibold"
              >
                Add
              </button>
            </form>
          </div>

          {/* REAL CALENDAR UI */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            {/* Calendar Header */}
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded">&larr;</button>
              <h2 className="font-bold text-lg">
                {currentMonth.format('MMMM YYYY')}
              </h2>
              <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded">&rarr;</button>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 text-center mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-xs text-gray-400 font-bold">{d}</div>
              ))}
            </div>

            {/* The Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty slots for days before the 1st */}
              {emptySlots.map((_, i) => <div key={`empty-${i}`} />)}

              {/* Actual Days */}
              {daysArray.map(day => {
                const dateStr = currentMonth.date(day).format('YYYY-MM-DD');
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === dayjs().format('YYYY-MM-DD');
                const count = calendarStats[dateStr] || 0;

                return (
                  <div 
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`
                      h-10 w-10 mx-auto flex flex-col items-center justify-center rounded-full cursor-pointer text-sm relative transition-all
                      ${isSelected ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'}
                      ${isToday && !isSelected ? 'border border-indigo-600 font-bold text-indigo-600' : ''}
                    `}
                  >
                    <span>{day}</span>
                    {/* The Dot for tasks */}
                    {count > 0 && (
                      <span className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}`}></span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Task List for Selected Date */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
          <div className="mb-6 border-b pb-4">
            <h2 className="text-xl font-bold text-gray-800">
              {dayjs(selectedDate).format('dddd, MMM D')}
            </h2>
            <p className="text-gray-500 text-sm">
              You have {tasks.filter(t => !t.completed).length} tasks remaining
            </p>
          </div>

          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p>No tasks for this day.</p>
                <p className="text-xs mt-2">Add a new question or select another date.</p>
              </div>
            ) : (
              tasks.map(task => {
                const isExpanded = expandedTasks.has(task.id);
                const notes = parseNotes(task.notes || '');
                const editingNote = editingNotes[task.question_id] || notes;
                const hasUnsavedChanges = JSON.stringify(editingNote) !== JSON.stringify(notes);

                return (
                  <div 
                    key={task.id} 
                    className={`rounded-lg border transition-all ${
                      task.completed 
                        ? 'bg-gray-50 border-gray-100' 
                        : 'bg-white border-gray-200 hover:border-indigo-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div 
                          onClick={() => toggleTask(task.id)}
                          className={`w-5 h-5 rounded-full border cursor-pointer flex items-center justify-center transition-colors ${
                            task.completed ? 'bg-green-500 border-green-500' : 'border-gray-400 hover:border-indigo-500'
                          }`}
                        >
                          {task.completed && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className={`text-sm flex-1 ${task.completed ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>
                          {task.title}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleNotes(task.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1"
                      >
                        {isExpanded ? 'Hide Notes' : 'Show Notes'}
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-3 mt-2">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Brute Force Approach
                            </label>
                            <textarea
                              value={editingNote.bruteForce}
                              onChange={(e) => handleNotesChange(task.question_id, 'bruteForce', e.target.value)}
                              placeholder="Write your brute force approach here..."
                              className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-indigo-500 resize-none"
                              rows={4}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              Optimized Approach
                            </label>
                            <textarea
                              value={editingNote.optimized}
                              onChange={(e) => handleNotesChange(task.question_id, 'optimized', e.target.value)}
                              placeholder="Write your optimized approach here..."
                              className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-indigo-500 resize-none"
                              rows={4}
                            />
                          </div>
                          {hasUnsavedChanges && (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingNotes(prev => {
                                    const newState = { ...prev };
                                    delete newState[task.question_id];
                                    return newState;
                                  });
                                }}
                                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveNotes(task.question_id)}
                                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                              >
                                Save Notes
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;