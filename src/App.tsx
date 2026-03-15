import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2,
  Edit,
  CheckSquare,
  Square,
  Trophy, 
  HelpCircle, 
  Menu,
  Zap, 
  Phone, 
  RefreshCw, 
  ChevronLeft, 
  Camera,
  Download,
  Upload,
  User,
  X,
  Star,
  Moon
} from 'lucide-react';
import html2canvas from 'html2canvas';
import confetti from 'canvas-confetti';
import { createClient } from '@supabase/supabase-js';

// استيراد بيانات الأسئلة من ملف البيانات المحلي
import { QUESTIONS, BACKUP_QUESTIONS, PRIZE_LEVELS_AR, POINTS_LEVELS, Question } from './data/questions';

// --- إعداد اتصال Supabase ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hbdybpnzgpttbhvygvbg.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhiZHlicG56Z3B0dGJodnlndmJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzUyMjQsImV4cCI6MjA4ODgxMTIyNH0.F90XOJr9Wz0Uay76Igj-HcaWerRd13H3jhiPNqicWeU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'WAITING' | 'RESULT' | 'WIN' | 'LOSE';
type SelectionState = 'NONE' | 'SELECTED' | 'CONFIRMED';

// --- Sounds ---
const SOUNDS = {
  START: 'https://github.com/zueitera-cloud/Ramadan/raw/refs/heads/main/start.mp3',
  TICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  CORRECT: 'https://github.com/zueitera-cloud/Ramadan/raw/refs/heads/main/Good.mp3',
  INCORRECT: 'https://github.com/zueitera-cloud/Ramadan/raw/refs/heads/main/Bad.mp3',
  HEARTBEAT: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
};

// --- Decorative Components ---
const Mandala = () => (
  <svg viewBox="0 0 100 100" className="w-32 h-32 text-ramadan-gold opacity-80">
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" />
    {[...Array(12)].map((_, i) => (
      <g key={i} transform={`rotate(${i * 30} 50 50)`}>
        <path d="M50 5 Q55 25 50 45 Q45 25 50 5" fill="currentColor" opacity="0.4" />
        <circle cx="50" cy="15" r="2" fill="currentColor" />
      </g>
    ))}
    <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const Lantern = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 100" className={`w-10 h-24 text-ramadan-gold ${className}`}>
    <line x1="20" y1="0" x2="20" y2="20" stroke="currentColor" strokeWidth="1" />
    <path d="M10 20 L30 20 L35 40 L20 50 L5 40 Z" fill="none" stroke="currentColor" strokeWidth="1" />
    <rect x="12" y="25" width="16" height="15" fill="currentColor" opacity="0.2" />
    <path d="M5 40 L35 40 L30 80 L10 80 Z" fill="none" stroke="currentColor" strokeWidth="1" />
    <path d="M10 80 L30 80 L25 95 L15 95 Z" fill="currentColor" opacity="0.4" />
  </svg>
);

export default function App() {
  // --- Helper to Generate Randomized Questions ---
  const generateRandomQuestions = (pool: Question[]) => {
    const randomized: Question[] = [];
    for (let i = 1; i <= 16; i++) {
      const levelPool = pool.filter(q => q.difficulty === i);
      if (levelPool.length > 0) {
        randomized.push(levelPool[Math.floor(Math.random() * levelPool.length)]);
      } else {
        // Fallback to backup questions if specific level is missing in pool
        const backupPool = QUESTIONS.filter(q => q.difficulty === i);
        if (backupPool.length > 0) {
          randomized.push(backupPool[Math.floor(Math.random() * backupPool.length)]);
        }
      }
    }
    return randomized;
  };

  const [gameState, setGameState] = useState<GameState>('START');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('ramadan_player_name') || '');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectionState, setSelectionState] = useState<SelectionState>('NONE');
  const [timer, setTimer] = useState(30);
  const [lifelines, setLifelines] = useState({
    fiftyFifty: true,
    aiHint: true,
    call: true,
    switch: true,
  });
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const [aiHintText, setAiHintText] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardType, setLeaderboardType] = useState<'all' | 'week' | 'month'>('all');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>(() => {
    // Initialize with local questions immediately to avoid delay
    const randomized: Question[] = [];
    for (let i = 1; i <= 16; i++) {
      const pool = QUESTIONS.filter(q => q.difficulty === i);
      if (pool.length > 0) {
        randomized.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    return randomized;
  });
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminAccess, setAdminAccess] = useState<'NONE' | 'ADMIN' | 'VISITOR'>('NONE');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
  const [selectedLeaderboardIds, setSelectedLeaderboardIds] = useState<(number | string)[]>([]);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [pendingCsvQuestions, setPendingCsvQuestions] = useState<any[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    answer: 0,
    difficulty: 1,
    hint: ''
  });

  const gameRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Toast Helper ---
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Randomize Questions ---
  const fetchQuestions = async () => {
    // No longer setting isLoadingQuestions to true here to avoid blocking the UI
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .order('difficulty', { ascending: true });
      
      if (!error && data && data.length > 0) {
        setAllQuestions(data);
        console.log('Loaded questions from Supabase');
        
        // Only update currentQuestions if the game hasn't started yet
        // This avoids changing questions while the user is playing
        setGameState(current => {
          if (current === 'START') {
            const randomized = generateRandomQuestions(data);
            if (randomized.length > 0) {
              setCurrentQuestions(randomized);
            }
          }
          return current;
        });
      } else {
        setAllQuestions([]);
        console.log('Using local backup questions');
      }
    } catch (e) {
      console.error('Error fetching questions:', e);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleAdminClick = () => {
    const newCount = adminClickCount + 1;
    setAdminClickCount(newCount);
    if (newCount >= 5) {
      setShowAdminAuth(true);
      setAdminClickCount(0);
    }
    // إعادة التعيين بعد ثانيتين من عدم النقر
    setTimeout(() => setAdminClickCount(0), 2000);
  };

  const verifyAdminCode = () => {
    if (adminPasscode === '123456') {
      setAdminAccess('ADMIN');
      setIsAdminOpen(true);
      setShowAdminAuth(false);
      setAdminPasscode('');
      showToast('تم الدخول بصلاحيات كاملة', 'success');
    } else {
      showToast('الكود غير صحيح', 'error');
    }
  };

  const enterAsVisitor = () => {
    setAdminAccess('VISITOR');
    setIsAdminOpen(true);
    setShowAdminAuth(false);
    setAdminPasscode('');
    showToast('تم الدخول كزائر (عرض فقط)', 'success');
  };

  const addQuestionToDb = async () => {
    if (adminAccess !== 'ADMIN') {
      showToast('عذراً، لا تملك صلاحية التعديل', 'error');
      return;
    }
    if (!newQuestion.question || newQuestion.options.some(o => !o)) {
      showToast('يرجى ملء جميع الحقول', 'error');
      return;
    }

    if (editingId) {
      setConfirmModal({
        isOpen: true,
        title: 'تأكيد التعديل',
        message: 'هل أنت متأكد من حفظ التعديلات على هذا السؤال؟',
        onConfirm: async () => {
          try {
            const { error } = await supabase
              .from('questions')
              .update(newQuestion)
              .eq('id', editingId);
            if (error) throw error;
            showToast('تم تحديث السؤال بنجاح', 'success');
            resetForm();
            fetchQuestions();
          } catch (e) {
            console.error('Error updating question:', e);
            showToast('فشل تحديث السؤال', 'error');
          }
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      try {
        const { error } = await supabase
          .from('questions')
          .insert([newQuestion]);
        if (error) throw error;
        showToast('تم إضافة السؤال بنجاح', 'success');
        resetForm();
        fetchQuestions();
      } catch (e) {
        console.error('Error adding question:', e);
        showToast('فشل إضافة السؤال', 'error');
      }
    }
  };

  const resetForm = () => {
    setNewQuestion({
      question: '',
      options: ['', '', '', ''],
      answer: 0,
      difficulty: 1,
      hint: ''
    });
    setEditingId(null);
  };

  const deleteSelectedQuestions = async () => {
    if (adminAccess !== 'ADMIN') {
      showToast('عذراً، لا تملك صلاحية الحذف', 'error');
      return;
    }
    if (selectedIds.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف ${selectedIds.length} سؤال مختار؟ لا يمكن التراجع عن هذه الخطوة.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('questions')
            .delete()
            .in('id', selectedIds);
          
          if (error) throw error;
          showToast('تم حذف الأسئلة المختارة', 'success');
          setSelectedIds([]);
          fetchQuestions();
        } catch (e) {
          console.error('Error deleting questions:', e);
          showToast('فشل الحذف - تأكد من الاتصال بقاعدة البيانات', 'error');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const deleteAllQuestions = async () => {
    if (adminAccess !== 'ADMIN') {
      showToast('عذراً، لا تملك صلاحية المسح الشامل', 'error');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'تأكيد المسح الشامل',
      message: '⚠️ تحذير: هل أنت متأكد من مسح جميع الأسئلة من قاعدة البيانات؟ سيتم حذف كل شيء نهائياً.',
      onConfirm: async () => {
        try {
          // استخدام فلتر يضمن حذف جميع السجلات
          const { error } = await supabase
            .from('questions')
            .delete()
            .not('id', 'is', null);
          
          if (error) throw error;
          showToast('تم مسح جميع الأسئلة بنجاح', 'success');
          setSelectedIds([]);
          fetchQuestions();
        } catch (e) {
          console.error('Error clearing database:', e);
          showToast('فشل مسح قاعدة البيانات', 'error');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const startEditing = (q: any) => {
    setNewQuestion({
      question: q.question,
      options: q.options,
      answer: q.answer,
      difficulty: q.difficulty,
      hint: q.hint || ''
    });
    setEditingId(q.id);
    // Scroll to form
    const formElement = document.getElementById('question-form');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleSelect = (id: number | string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === allQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allQuestions.map(q => q.id));
    }
  };

  const uploadOldQuestions = async () => {
    if (adminAccess !== 'ADMIN') {
      showToast('عذراً، لا تملك صلاحية الرفع', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('questions')
        .insert(QUESTIONS.map(({ id, ...rest }) => rest));
      
      if (error) throw error;
      showToast('تم رفع الأسئلة القديمة بنجاح', 'success');
      fetchQuestions();
    } catch (e) {
      console.error('Error uploading questions:', e);
      showToast('فشل الرفع (ربما الجدول موجود مسبقاً)', 'error');
    }
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/);
      
      const questionLines = lines.slice(1, 17);
      const parsedQuestions = questionLines.map((line, index) => {
        const parts = line.split(';');
        if (parts.length < 6) return null;

        return {
          question: parts[0].trim(),
          options: [parts[1].trim(), parts[2].trim(), parts[3].trim(), parts[4].trim()],
          answer: parseInt(parts[5].trim()) - 1,
          difficulty: index + 1,
          hint: parts[6] ? parts[6].trim() : ''
        };
      }).filter(q => q !== null);

      if (parsedQuestions.length === 0) {
        showToast('لم يتم العثور على أسئلة صالحة في الملف', 'error');
        return;
      }

      setPendingCsvQuestions(parsedQuestions);
      showToast(`تم قراءة ${parsedQuestions.length} سؤال. يرجى المراجعة والضغط على تأكيد الحفظ.`, 'success');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const confirmCsvUpload = async () => {
    if (adminAccess !== 'ADMIN') {
      showToast('عذراً، لا تملك صلاحية الحفظ', 'error');
      return;
    }
    if (pendingCsvQuestions.length === 0) return;

    try {
      // 1. جلب الأسئلة الموجودة حالياً لتجنب التكرار
      const { data: existingQuestions, error: fetchError } = await supabase
        .from('questions')
        .select('question');
      
      if (fetchError) throw fetchError;

      const existingTexts = new Set(existingQuestions?.map(q => q.question.trim()) || []);
      
      // 2. تصفية الأسئلة الجديدة (فقط التي لا توجد في قاعدة البيانات)
      const uniqueNewQuestions = pendingCsvQuestions.filter(q => !existingTexts.has(q.question.trim()));

      if (uniqueNewQuestions.length === 0) {
        showToast('جميع الأسئلة في الملف موجودة مسبقاً في قاعدة البيانات', 'error');
        setPendingCsvQuestions([]);
        return;
      }

      // 3. إدخال الأسئلة الفريدة فقط
      const { error } = await supabase
        .from('questions')
        .insert(uniqueNewQuestions);
      
      if (error) throw error;
      
      const skippedCount = pendingCsvQuestions.length - uniqueNewQuestions.length;
      showToast(
        `تم حفظ ${uniqueNewQuestions.length} سؤال بنجاح${skippedCount > 0 ? ` (تم تخطي ${skippedCount} مكرر)` : ''}`, 
        'success'
      );
      setPendingCsvQuestions([]);
      fetchQuestions();
    } catch (err) {
      console.error('Error importing CSV:', err);
      showToast('فشل حفظ الملف في قاعدة البيانات', 'error');
    }
  };

  useEffect(() => {
    fetchQuestions();
    fetchLeaderboard('all');
  }, []);

  useEffect(() => {
    if (showLeaderboard) {
      fetchLeaderboard(leaderboardType);
    }
  }, [showLeaderboard, leaderboardType]);

  const currentQuestion = currentQuestions[currentLevel] || QUESTIONS[0];

  // --- Supabase Leaderboard Logic ---
  const fetchLeaderboard = async (type: 'all' | 'week' | 'month' = leaderboardType) => {
    setIsLeaderboardLoading(true);
    try {
      let query = supabase
        .from('leaderboard')
        .select('id, username, score, created_at')
        .order('score', { ascending: false })
        .limit(10);

      if (type === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('created_at', weekAgo.toISOString());
      } else if (type === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte('created_at', monthAgo.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeaderboardData(data || []);
    } catch (e) {
      console.error('Failed to fetch leaderboard', e);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  const submitScore = async (score: number) => {
    if (score <= 0 || !playerName.trim()) return false;
    try {
      const { error } = await supabase
        .from('leaderboard')
        .insert([{ 
          username: playerName.trim(), 
          score: score,
          created_at: new Date().toISOString()
        }]);
      
      if (error) throw error;
      
      showToast('تم حفظ النتيجة بنجاح!', 'success');
      if (showLeaderboard) fetchLeaderboard();
      return true;
    } catch (e) {
      console.error('Error saving score:', e);
      showToast('فشل حفظ النتيجة', 'error');
      return false;
    }
  };

  const deleteSelectedLeaderboard = async () => {
    if (adminAccess !== 'ADMIN') {
      showToast('عذراً، لا تملك صلاحية الحذف', 'error');
      return;
    }
    if (selectedLeaderboardIds.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'تأكيد حذف النتائج',
      message: `هل أنت متأكد من حذف ${selectedLeaderboardIds.length} من النتائج المختارة؟`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('leaderboard')
            .delete()
            .in('id', selectedLeaderboardIds);
          
          if (error) throw error;
          
          showToast('تم حذف النتائج بنجاح', 'success');
          setSelectedLeaderboardIds([]);
          fetchLeaderboard();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        } catch (e) {
          console.error('Delete failed', e);
          showToast('فشل الحذف من قاعدة البيانات', 'error');
        }
      }
    });
  };

  const playSound = (url: string, loop = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.loop = loop;
    audio.play().catch(e => console.log('Audio play blocked', e));
    audioRef.current = audio;
  };

  const playResultSound = (url: string) => {
    const audio = new Audio(url);
    audio.play().catch(e => console.log('Audio play blocked', e));
  };

  // --- Game Logic ---
  const startGame = () => {
    if (!playerName.trim() || isLoadingQuestions) return;
    localStorage.setItem('ramadan_player_name', playerName.trim());
    setGameState('PLAYING');
    setTimer(30);
    playResultSound(SOUNDS.START);
  };

  const handleAnswerClick = (index: number) => {
    if (gameState !== 'PLAYING' || hiddenOptions.includes(index)) return;

    if (selectedAnswer === index) {
      setSelectionState('CONFIRMED');
      setGameState('WAITING');
      setTimer(5); // Suspense timer
      playSound(SOUNDS.HEARTBEAT, true);
    } else {
      setSelectedAnswer(index);
      setSelectionState('SELECTED');
      playSound(SOUNDS.TICK);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if ((gameState === 'WAITING' || gameState === 'PLAYING') && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
        if (gameState === 'PLAYING') {
          playSound(SOUNDS.TICK);
        }
      }, 1000);
    } else if (gameState === 'WAITING' && timer === 0) {
      checkAnswer();
    } else if (gameState === 'PLAYING' && timer === 0) {
      const finalPoints = currentLevel > 0 ? POINTS_LEVELS[currentLevel - 1] : 0;
      setGameState('LOSE');
      playResultSound(SOUNDS.INCORRECT);
      submitScore(finalPoints);
    }
    return () => clearInterval(interval);
  }, [gameState, timer]);

  const checkAnswer = async () => {
    if (audioRef.current) audioRef.current.pause();
    
    const isCorrect = selectedAnswer === currentQuestion.answer;
    setGameState('RESULT');

    setTimeout(async () => {
      await takeScreenshot(isCorrect ? 'Correct' : 'Incorrect');
    }, 500);

    if (isCorrect) {
      playResultSound(SOUNDS.CORRECT);
      if (currentLevel === 15) {
        setTimeout(() => {
          setGameState('WIN');
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
          submitScore(POINTS_LEVELS[15]);
        }, 3500);
      } else {
        setTimeout(() => {
          nextLevel();
        }, 3500);
      }
    } else {
      playResultSound(SOUNDS.INCORRECT);
      const finalPoints = currentLevel > 0 ? POINTS_LEVELS[currentLevel - 1] : 0;
      setTimeout(() => {
        setGameState('LOSE');
        submitScore(finalPoints);
      }, 4000);
    }
  };

  const nextLevel = () => {
    setCurrentLevel(prev => prev + 1);
    setSelectedAnswer(null);
    setSelectionState('NONE');
    setGameState('PLAYING');
    setTimer(30);
    setHiddenOptions([]);
    setAiHintText(null);
    playResultSound(SOUNDS.START);
  };

  // --- Lifelines ---
  const useFiftyFifty = () => {
    if (!lifelines.fiftyFifty || gameState !== 'PLAYING') return;
    const wrongIndices = currentQuestion.options
      .map((_, i) => i)
      .filter(i => i !== currentQuestion.answer);
    const toHide = wrongIndices.sort(() => 0.5 - Math.random()).slice(0, 2);
    setHiddenOptions(toHide);
    setLifelines(prev => ({ ...prev, fiftyFifty: false }));
    setTimer(30);
  };

  const useAiHint = () => {
    if (!lifelines.aiHint || gameState !== 'PLAYING') return;
    setIsAiLoading(true);
    const hint = currentQuestion.hint || "فكر جيداً في الخيارات المتاحة، الإجابة قد تكون أقرب مما تتصور!";
    setTimeout(() => {
      setAiHintText(hint);
      setIsAiLoading(false);
      setLifelines(prev => ({ ...prev, aiHint: false }));
      setTimer(30);
    }, 800);
  };

  const useSwitchQuestion = () => {
    if (!lifelines.switch || gameState !== 'PLAYING') return;
    const backup = BACKUP_QUESTIONS[0];
    const newQuestions = [...currentQuestions];
    newQuestions[currentLevel] = { ...backup, difficulty: currentLevel + 1 };
    setCurrentQuestions(newQuestions);
    setLifelines(prev => ({ ...prev, switch: false }));
    setHiddenOptions([]);
    setAiHintText(null);
    setSelectedAnswer(null);
    setSelectionState('NONE');
    setTimer(30);
  };

  const useCallHelp = () => {
    if (!lifelines.call || gameState !== 'PLAYING') return;
    setAiHintText("صديقك يقول: 'أنا متأكد بنسبة 80% أنها " + currentQuestion.options[currentQuestion.answer] + "!'");
    setLifelines(prev => ({ ...prev, call: false }));
    setTimer(30);
  };

  // --- Screenshots & Certificate ---
  const downloadCertificate = async () => {
    const element = document.getElementById('certificate');
    if (!element) return;
    
    try {
      showToast('جاري تحضير الشهادة...', 'success');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `شهادة_رمضان_${playerName}.png`;
      link.click();
      showToast('تم تحميل الشهادة بنجاح', 'success');
    } catch (e) {
      console.error('Download error:', e);
      showToast('فشل تحميل الشهادة', 'error');
    }
  };

  const takeScreenshot = async (label: string) => {
    if (!gameRef.current) return;
    try {
      // html2canvas logic was here but seems broken or incomplete
      // await html2canvas(gameRef.current);
      console.log('Screenshot requested for:', label);
    } catch (e) {
      console.error('Screenshot error:', e);
    }
  };

  const renderAdminPanel = () => (
    <>
      <AnimatePresence>
        {showAdminAuth && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[400] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-ramadan-teal border-2 border-ramadan-gold w-full max-w-md rounded-3xl p-8 text-center space-y-6"
            >
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-ramadan-gold/20 rounded-full flex items-center justify-center">
                  <Zap className="w-8 h-8 text-ramadan-gold" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-ramadan-gold">لوحة التحكم المحمية</h3>
              <p className="text-ramadan-cream text-sm">أدخل الكود السري للتحكم التام أو ادخل كزائر للمشاهدة فقط</p>
              
              <input 
                type="password"
                placeholder="أدخل الكود السري"
                value={adminPasscode}
                onChange={(e) => setAdminPasscode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && verifyAdminCode()}
                className="w-full bg-black/40 border border-ramadan-gold/40 rounded-xl py-3 px-4 text-center text-white text-xl tracking-[0.5em] focus:border-ramadan-gold outline-none"
              />

              <div className="flex flex-col gap-3">
                <button 
                  onClick={verifyAdminCode}
                  className="w-full bg-ramadan-gold text-ramadan-teal font-black py-3 rounded-xl hover:bg-ramadan-cream transition-all flex items-center justify-center gap-2"
                >
                  <CheckSquare className="w-5 h-5" />
                  دخول (تحكم كامل)
                </button>
                <button 
                  onClick={enterAsVisitor}
                  className="w-full bg-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <User className="w-5 h-5 text-ramadan-gold" />
                  دخول كزائر (مشاهدة فقط)
                </button>
                <button 
                  onClick={() => setShowAdminAuth(false)}
                  className="w-full text-white/50 hover:text-white text-sm transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-ramadan-teal border-2 border-ramadan-gold w-full max-w-md rounded-3xl p-6 text-center"
            >
              <h3 className="text-xl font-black text-ramadan-gold mb-4">{confirmModal.title}</h3>
              <p className="text-white mb-8">{confirmModal.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    confirmModal.onConfirm();
                  }}
                  className="flex-1 bg-ramadan-gold text-ramadan-teal font-black py-3 rounded-xl hover:bg-ramadan-cream transition-all"
                >
                  تأكيد
                </button>
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 bg-white/10 text-white font-bold py-3 rounded-xl hover:bg-white/20 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdminOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-ramadan-teal border-2 border-ramadan-gold w-full max-w-2xl rounded-3xl p-4 md:p-8 relative my-4 md:my-8 max-h-[95vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => {
                  setIsAdminOpen(false);
                  setAdminAccess('NONE');
                }}
                className="absolute top-2 md:top-4 left-2 md:left-4 p-2 text-ramadan-gold hover:bg-white/10 rounded-full z-10"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              <h2 className="text-xl md:text-3xl font-black text-ramadan-gold text-center mb-1 md:mb-2">لوحة تحكم المسابقة</h2>
              <p className="text-center text-[10px] md:text-xs text-ramadan-cream/60 mb-4 md:mb-8">
                {adminAccess === 'ADMIN' ? 'وضع التحكم الكامل' : 'وضع الزائر (للمشاهدة فقط)'}
              </p>

              {/* Leaderboard Management */}
              <div className="mb-6 md:mb-10 bg-black/30 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-ramadan-gold/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <h3 className="text-ramadan-gold text-sm md:text-base font-bold flex items-center gap-2">
                    <Trophy className="w-4 h-4 md:w-5 md:h-5" />
                    إدارة لائحة الأوائل ({leaderboardData.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    {selectedLeaderboardIds.length > 0 && adminAccess === 'ADMIN' && (
                      <button 
                        onClick={deleteSelectedLeaderboard}
                        className="text-[10px] md:text-xs bg-ramadan-red/80 px-2 md:px-3 py-1 rounded-lg hover:bg-ramadan-red transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        حذف المختار ({selectedLeaderboardIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-40 md:max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {isLeaderboardLoading ? (
                    <div className="flex flex-col items-center justify-center py-4">
                      <RefreshCw className="w-5 h-5 text-ramadan-gold animate-spin" />
                    </div>
                  ) : leaderboardData.length === 0 ? (
                    <p className="text-white/40 text-center text-xs py-4">لا توجد نتائج حالياً</p>
                  ) : (
                    leaderboardData.map((entry) => (
                      <div key={entry.id} className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl border transition-all ${selectedLeaderboardIds.includes(entry.id) ? 'bg-ramadan-gold/10 border-ramadan-gold' : 'bg-black/20 border-white/5'}`}>
                        {adminAccess === 'ADMIN' && (
                          <button 
                            onClick={() => {
                              setSelectedLeaderboardIds(prev => 
                                prev.includes(entry.id) ? prev.filter(id => id !== entry.id) : [...prev, entry.id]
                              );
                            }} 
                            className="text-ramadan-gold"
                          >
                            {selectedLeaderboardIds.includes(entry.id) ? <CheckSquare className="w-4 h-4 md:w-5 md:h-5" /> : <Square className="w-4 h-4 md:w-5 md:h-5" />}
                          </button>
                        )}
                        <div className="flex-1 min-w-0 flex justify-between items-center">
                          <p className="text-white text-xs md:text-sm font-bold truncate">{entry.username}</p>
                          <p className="text-ramadan-gold text-[10px] md:text-xs font-black">{entry.score} نقطة</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {pendingCsvQuestions.length > 0 && adminAccess === 'ADMIN' && (
                <div className="mb-6 md:mb-8 p-3 md:p-4 bg-ramadan-gold/10 border border-ramadan-gold rounded-2xl">
                  <h3 className="text-ramadan-gold text-sm md:text-base font-bold mb-3 md:mb-4 flex items-center gap-2">
                    <Moon className="w-4 h-4 md:w-5 md:h-5" />
                    مراجعة الأسئلة المستوردة ({pendingCsvQuestions.length})
                  </h3>
                  <div className="max-h-[30vh] md:max-h-[40vh] overflow-y-auto space-y-2 mb-4 pr-2 custom-scrollbar bg-black/20 p-2 md:p-3 rounded-xl border border-white/10">
                    {pendingCsvQuestions.map((q, i) => (
                      <div key={i} className="text-[10px] md:text-xs bg-black/30 p-2 rounded-lg border border-white/5">
                        <p className="text-white font-bold mb-1">{i + 1}. {q.question}</p>
                        <p className="text-ramadan-cream opacity-70">المستوى: {q.difficulty} | الإجابة: {q.options[q.answer]}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={confirmCsvUpload}
                      className="flex-1 bg-ramadan-gold text-ramadan-teal font-black py-2 rounded-xl hover:bg-ramadan-cream transition-all text-sm"
                    >
                      تأكيد وحفظ الكل
                    </button>
                    <button 
                      onClick={() => setPendingCsvQuestions([])}
                      className="px-3 md:px-4 py-2 bg-ramadan-red text-white rounded-xl hover:bg-opacity-80 transition-all text-sm"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* Question Management List */}
              <div className="mb-6 md:mb-10 bg-black/30 rounded-2xl md:rounded-3xl p-3 md:p-6 border border-ramadan-gold/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                  <h3 className="text-ramadan-gold text-sm md:text-base font-bold flex items-center gap-2">
                    <Star className="w-4 h-4 md:w-5 md:h-5" />
                    الأسئلة الحالية ({allQuestions.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    <button 
                      onClick={toggleSelectAll}
                      className="text-[10px] md:text-xs bg-white/10 px-2 md:px-3 py-1 rounded-lg hover:bg-white/20 transition-all flex items-center gap-1"
                    >
                      {selectedIds.length === allQuestions.length ? <CheckSquare className="w-3 h-3 md:w-4 md:h-4" /> : <Square className="w-3 h-3 md:w-4 md:h-4" />}
                      تحديد الكل
                    </button>
                    {selectedIds.length > 0 && adminAccess === 'ADMIN' && (
                      <button 
                        onClick={deleteSelectedQuestions}
                        className="text-[10px] md:text-xs bg-ramadan-red/80 px-2 md:px-3 py-1 rounded-lg hover:bg-ramadan-red transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        حذف ({selectedIds.length})
                      </button>
                    )}
                    {adminAccess === 'ADMIN' && (
                      <button 
                        onClick={deleteAllQuestions}
                        className="text-[10px] md:text-xs bg-ramadan-red px-2 md:px-3 py-1 rounded-lg hover:bg-opacity-80 transition-all flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        مسح الكل
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-60 md:max-h-80 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {isLoadingQuestions ? (
                    <div className="flex flex-col items-center justify-center py-6 md:py-10 space-y-3">
                      <RefreshCw className="w-6 h-6 md:w-8 md:h-8 text-ramadan-gold animate-spin" />
                      <p className="text-white/60 text-[10px] md:text-sm">جاري تحميل الأسئلة...</p>
                    </div>
                  ) : allQuestions.length === 0 ? (
                    <div className="text-center py-6 md:py-10 bg-black/20 rounded-2xl border border-dashed border-white/10">
                      <HelpCircle className="w-8 h-8 md:w-12 md:h-12 text-white/20 mx-auto mb-2" />
                      <p className="text-white/40 text-xs md:text-sm">لا توجد أسئلة في قاعدة البيانات</p>
                    </div>
                  ) : (
                    allQuestions.map((q) => (
                      <div key={q.id} className={`flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-xl border transition-all ${selectedIds.includes(q.id) ? 'bg-ramadan-gold/10 border-ramadan-gold' : 'bg-black/20 border-white/5'}`}>
                        <button onClick={() => toggleSelect(q.id)} className="text-ramadan-gold">
                          {selectedIds.includes(q.id) ? <CheckSquare className="w-4 h-4 md:w-5 md:h-5" /> : <Square className="w-4 h-4 md:w-5 md:h-5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs md:text-sm font-bold truncate">{q.question}</p>
                          <p className="text-[9px] md:text-[10px] text-ramadan-cream/60">المستوى: {q.difficulty} | {q.options[q.answer]}</p>
                        </div>
                        <div className="flex gap-1 md:gap-2">
                          {adminAccess === 'ADMIN' && (
                            <button 
                              onClick={() => startEditing(q)}
                              className="p-1.5 md:p-2 bg-white/10 rounded-lg hover:bg-ramadan-gold hover:text-ramadan-teal transition-all"
                              title="تعديل"
                            >
                              <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div id="question-form" className="space-y-3 md:space-y-4 bg-black/20 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-ramadan-gold/10">
                <h3 className="text-ramadan-gold text-sm md:text-base font-bold mb-1 md:mb-2">
                  {editingId ? 'تعديل السؤال' : 'إضافة سؤال جديد'}
                </h3>
                <div>
                  <label className="block text-ramadan-gold mb-1 text-xs md:text-sm font-bold">السؤال:</label>
                  <textarea 
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({...newQuestion, question: e.target.value})}
                    className="w-full bg-black/20 border border-ramadan-gold/40 rounded-xl p-2 md:p-3 text-white text-sm focus:border-ramadan-gold outline-none"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                  {newQuestion.options.map((opt, i) => (
                    <div key={i}>
                      <label className="block text-ramadan-gold mb-0.5 md:mb-1 text-[10px] md:text-xs">الخيار {i + 1}:</label>
                      <input 
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const opts = [...newQuestion.options];
                          opts[i] = e.target.value;
                          setNewQuestion({...newQuestion, options: opts});
                        }}
                        className="w-full bg-black/20 border border-ramadan-gold/40 rounded-xl p-1.5 md:p-2 text-white text-sm focus:border-ramadan-gold outline-none"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                  <div>
                    <label className="block text-ramadan-gold mb-0.5 md:mb-1 text-[10px] md:text-xs">الإجابة الصحيحة (0-3):</label>
                    <select 
                      value={newQuestion.answer}
                      onChange={(e) => setNewQuestion({...newQuestion, answer: parseInt(e.target.value)})}
                      className="w-full bg-black/20 border border-ramadan-gold/40 rounded-xl p-1.5 md:p-2 text-white text-sm focus:border-ramadan-gold outline-none"
                    >
                      {[0,1,2,3].map(i => <option key={i} value={i} className="bg-ramadan-teal">الخيار {i + 1}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-ramadan-gold mb-0.5 md:mb-1 text-[10px] md:text-xs">المستوى (1-16):</label>
                    <input 
                      type="number"
                      min="1" max="16"
                      value={newQuestion.difficulty}
                      onChange={(e) => setNewQuestion({...newQuestion, difficulty: parseInt(e.target.value)})}
                      className="w-full bg-black/20 border border-ramadan-gold/40 rounded-xl p-1.5 md:p-2 text-white text-sm focus:border-ramadan-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-ramadan-gold mb-0.5 md:mb-1 text-[10px] md:text-xs">تلميح (Hint):</label>
                    <input 
                      type="text"
                      value={newQuestion.hint}
                      onChange={(e) => setNewQuestion({...newQuestion, hint: e.target.value})}
                      className="w-full bg-black/20 border border-ramadan-gold/40 rounded-xl p-1.5 md:p-2 text-white text-sm focus:border-ramadan-gold outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 md:gap-4 pt-2 md:pt-4">
                  {adminAccess === 'ADMIN' ? (
                    <>
                      <button 
                        onClick={addQuestionToDb}
                        className={`flex-1 font-black py-2.5 md:py-3 rounded-xl transition-all text-sm md:text-base ${editingId ? 'bg-ramadan-cream text-ramadan-teal' : 'bg-ramadan-gold text-ramadan-teal hover:bg-ramadan-cream'}`}
                      >
                        {editingId ? 'تحديث السؤال' : 'إضافة السؤال'}
                      </button>
                      
                      {editingId && (
                        <button 
                          onClick={() => {
                            setEditingId(null);
                            setNewQuestion({
                              question: '',
                              options: ['', '', '', ''],
                              answer: 0,
                              difficulty: 1,
                              hint: ''
                            });
                          }}
                          className="bg-white/10 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl hover:bg-white/20 transition-all text-sm md:text-base"
                        >
                          إلغاء التعديل
                        </button>
                      )}
                      
                      <label className="cursor-pointer bg-ramadan-green text-white px-3 md:px-4 py-2.5 md:py-3 rounded-xl hover:bg-opacity-80 transition-all text-xs md:text-sm flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        رفع ملف CSV
                        <input 
                          type="file" 
                          accept=".csv" 
                          className="hidden" 
                          onChange={handleCsvUpload}
                        />
                      </label>

                      <button 
                        onClick={uploadOldQuestions}
                        className="bg-white/10 text-white px-3 md:px-4 py-2.5 md:py-3 rounded-xl hover:bg-white/20 transition-all text-xs md:text-sm"
                      >
                        رفع الأسئلة القديمة
                      </button>
                    </>
                  ) : (
                    <div className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                      <p className="text-ramadan-cream/60 text-xs md:text-sm">أنت في وضع الزائر، لا يمكنك إضافة أو تعديل الأسئلة</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  const renderLeaderboardModal = () => (
    <AnimatePresence>
      {showLeaderboard && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-ramadan-teal border-2 border-ramadan-gold w-full max-w-lg rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col max-h-[90vh]"
          >
            <button 
              onClick={() => setShowLeaderboard(false)}
              className="absolute top-4 left-4 p-2 text-ramadan-gold hover:bg-white/10 rounded-full z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center space-y-4 md:space-y-6 flex flex-col h-full">
              <div className="flex items-center justify-center gap-4">
                <Trophy className="w-10 h-10 md:w-12 md:h-12 text-ramadan-gold" />
                <button 
                  onClick={() => fetchLeaderboard()}
                  className="p-2 hover:bg-white/10 rounded-full text-ramadan-gold"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-ramadan-gold">لائحة الأوائل</h2>

              <div className="flex gap-2 p-1 bg-black/20 rounded-xl border border-ramadan-gold/20">
                {['all', 'week', 'month'].map((type) => (
                  <button 
                    key={type}
                    onClick={() => setLeaderboardType(type as any)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all text-sm ${leaderboardType === type ? 'bg-ramadan-gold text-ramadan-teal' : 'text-ramadan-cream hover:bg-white/5'}`}
                  >
                    {type === 'all' ? 'الكل' : type === 'week' ? 'الأسبوع' : 'الشهر'}
                  </button>
                ))}
              </div>
              
              <div className="space-y-2 overflow-y-auto pr-1 scrollbar-hide flex-1">
                {isLeaderboardLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <RefreshCw className="w-8 h-8 text-ramadan-gold animate-spin" />
                    <p className="text-ramadan-cream animate-pulse">جاري تحميل النتائج...</p>
                  </div>
                ) : leaderboardData.length > 0 ? (
                  leaderboardData.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-black/20 p-3 md:p-4 rounded-2xl border border-ramadan-gold/20">
                      <div className="flex items-center gap-3 md:gap-4">
                        <span className="text-ramadan-gold font-bold w-6">{idx + 1}</span>
                        <span 
                          className="text-white font-bold select-none"
                        >
                          {entry.username}
                        </span>
                      </div>
                      <span className="text-ramadan-cream font-black">{entry.score} نقطة</span>
                    </div>
                  ))
                ) : (
                  <p className="text-ramadan-cream opacity-60 py-8">لا يوجد نتائج بعد</p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const getAnswerColor = (index: number) => {
    if (hiddenOptions.includes(index)) return 'opacity-0 pointer-events-none';
    
    if (gameState === 'RESULT') {
      if (index === currentQuestion.answer) return 'bg-ramadan-green border-white text-white';
      if (index === selectedAnswer) return 'bg-ramadan-red border-white text-white';
    }

    if (selectedAnswer === index) {
      if (selectionState === 'CONFIRMED') return 'bg-ramadan-orange border-white text-white animate-heartbeat';
      return 'bg-ramadan-grey border-white text-white';
    }

    return '';
  };

  if (gameState === 'START') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-ramadan-teal relative overflow-hidden">
        <div className="absolute top-0 left-0 p-8 opacity-20"><Mandala /></div>
        <div className="absolute bottom-0 right-0 p-8 opacity-20 rotate-180"><Mandala /></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-ramadan-teal/80 border-2 border-ramadan-gold p-8 text-center space-y-8 rounded-3xl shadow-2xl z-10"
        >
          <div className="relative inline-block">
            <motion.img 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              src="https://raw.githubusercontent.com/zueitera-cloud/Ramadan/main/Fashkol.png" 
              alt="Fashkol" 
              loading="eager"
              fetchPriority="high"
              className="w-40 h-40 mx-auto rounded-full border-4 border-ramadan-gold shadow-2xl object-cover bg-ramadan-teal/50"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback to a themed placeholder if the main image fails
                (e.target as HTMLImageElement).src = "https://picsum.photos/seed/ramadan/200/200";
              }}
            />
            <Moon className="absolute -bottom-2 -right-2 w-12 h-12 text-ramadan-gold fill-ramadan-gold drop-shadow-lg" />
            <Star className="absolute -top-2 -left-2 w-8 h-8 text-ramadan-gold fill-ramadan-gold animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h1 
              className="arabic-title cursor-pointer select-none"
              onClick={handleAdminClick}
            >
              مسابقة رمضان
            </h1>
            <p className="text-ramadan-gold text-sm tracking-widest uppercase font-bold">Ramadan Trivia</p>
            <p className="text-ramadan-cream/80 text-xs mt-1 font-bold">برمجة واعداد: أ. أحمد زعيتر</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ramadan-gold/60" />
              <input 
                type="text" 
                placeholder="أدخل اسم المتسابق"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-black/20 border border-ramadan-gold/40 rounded-full py-3 pr-10 pl-4 focus:outline-none focus:border-ramadan-gold transition-colors text-right"
              />
            </div>
            <button 
              onClick={startGame}
              disabled={!playerName.trim() || isLoadingQuestions}
              className="w-full bg-ramadan-gold text-ramadan-teal font-black py-4 rounded-full hover:bg-ramadan-cream transition-colors disabled:opacity-50 text-xl flex items-center justify-center gap-2"
            >
              {isLoadingQuestions ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  جاري تحميل الأسئلة...
                </>
              ) : (
                'ابدأ المسابقة'
              )}
            </button>
            
            <button 
              onClick={() => setShowLeaderboard(true)}
              className="w-full bg-white/10 text-white font-bold py-3 rounded-full hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5 text-ramadan-gold" />
              لائحة الأوائل
            </button>
          </div>
        </motion.div>

        {renderLeaderboardModal()}
        {renderAdminPanel()}
      </div>
    );
  }

  if (gameState === 'WIN' || gameState === 'LOSE') {
    const finalPoints = currentLevel > 0 ? POINTS_LEVELS[currentLevel - 1] : 0;
    const displayPoints = gameState === 'WIN' ? POINTS_LEVELS[15] : finalPoints;
    const showCertificate = gameState === 'WIN' || currentLevel > 0;

    return (
      <div className="min-h-screen flex flex-col items-center justify-start p-4 bg-black/90 overflow-y-auto pt-8 pb-12">
        {showCertificate ? (
          <div className="w-full max-w-4xl">
            <div id="certificate" className="w-full bg-white p-6 sm:p-10 md:p-16 text-[#1a4d4d] rounded-sm border-b-[10px] md:border-b-[15px] border-[#d4af37] shadow-2xl relative flex flex-col justify-center min-h-[400px] md:aspect-[1.414/1]">
              <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 -translate-y-1/2 translate-x-1/2 rotate-45" 
                   style={{ background: 'linear-gradient(to bottom left, rgba(26, 77, 77, 1), rgba(26, 77, 77, 0.8), transparent)' }} />
              
              <div className="absolute top-4 md:top-12 left-4 md:left-12 flex flex-col items-center">
                <Moon className="w-8 md:w-20 h-8 md:h-20 text-[#d4af37] fill-[#d4af37]" />
                <Star className="absolute top-1 md:top-4 right-0 w-3 md:w-8 h-3 md:h-8 text-[#d4af37] fill-[#d4af37]" />
              </div>

              <div className="absolute top-4 md:top-12 right-4 md:right-12 text-[#d4af37] font-serif-arabic text-lg md:text-3xl italic">
                رمضان كريم
              </div>

              <div className="text-center space-y-4 md:space-y-8 relative z-10 py-8">
                <div className="space-y-1 md:space-y-4">
                  <h2 className="text-black font-serif-arabic text-2xl md:text-6xl font-black">شهادة شكر وتقدير</h2>
                  <p className="text-[#1a4d4d] text-base md:text-2xl font-bold">للمتسابق/للمتسابقة</p>
                </div>

                <div className="py-1 md:py-4">
                  <h3 className="text-3xl md:text-6xl font-serif-arabic font-black text-[#1a4d4d] border-b-2 md:border-b-4 border-[#d4af37]/30 inline-block px-4 md:px-12 pb-1 md:pb-2">
                    {playerName}
                  </h3>
                </div>

                <div className="space-y-2 md:space-y-6 text-sm md:text-xl text-gray-700 font-bold max-w-2xl mx-auto leading-relaxed">
                  <p>للمشاركة في مسابقة رمضان الثقافية للعام 2026 م - 1447 هـ</p>
                  
                  <div className="p-4 rounded-2xl border border-[#d4af37]/20 my-4" style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)' }}>
                    <p className="text-[#1a4d4d] mb-2">وقد حصل/ت على الرصيد التالي</p>
                    <div className="flex items-center justify-center gap-2 md:gap-4">
                      <span className="text-3xl md:text-6xl font-black text-[#1a4d4d]">{displayPoints}</span>
                      <span className="text-xl md:text-4xl font-black text-[#1a4d4d]">نقطة</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <button onClick={downloadCertificate} className="flex items-center justify-center gap-2 bg-ramadan-gold text-ramadan-teal px-6 py-2 rounded-full font-bold mx-auto hover:bg-ramadan-cream transition-all shadow-lg">
                <Download className="w-5 h-5" /> تحميل الشهادة
              </button>
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8 bg-ramadan-teal/20 p-12 rounded-3xl border-2 border-ramadan-gold/40"
          >
            <div className="relative inline-block">
              <Moon className="w-24 h-24 text-ramadan-gold mx-auto opacity-50" />
              <X className="absolute inset-0 m-auto w-12 h-12 text-ramadan-red" />
            </div>
            <h2 className="text-4xl font-black text-white">للأسف، انتهت اللعبة!</h2>
            <p className="text-ramadan-cream text-xl">حاول مرة أخرى لتحصل على شهادتك في المرة القادمة</p>
          </motion.div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-4 z-50">
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 bg-ramadan-gold text-ramadan-teal px-8 py-4 rounded-full font-black text-xl hover:bg-ramadan-cream transition-all shadow-xl"
          >
            <RefreshCw className="w-6 h-6" /> العب مرة أخرى
          </button>
          
          <button 
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center justify-center gap-2 bg-white/10 text-white px-8 py-4 rounded-full font-black text-xl hover:bg-white/20 transition-all shadow-xl border border-ramadan-gold/30"
          >
            <Trophy className="w-6 h-6 text-ramadan-gold" /> لائحة الأوائل
          </button>
        </div>

        {renderLeaderboardModal()}
      </div>
    );
  }

  return (
    <div ref={gameRef} className="min-h-screen flex flex-col bg-ramadan-teal overflow-x-hidden relative">
      <div className="absolute top-0 left-0 p-4 pointer-events-none opacity-20 md:opacity-100"><Mandala /></div>
      <div className="absolute top-10 left-40 pointer-events-none hidden md:block"><Lantern /></div>
      <div className="absolute top-20 left-60 pointer-events-none hidden md:block opacity-60 scale-75"><Lantern /></div>
      <div className="absolute top-40 left-10 pointer-events-none hidden md:block">
        <div className="text-ramadan-gold font-serif-arabic text-4xl -rotate-12 opacity-80">رمضان كريم</div>
      </div>

      <div className="flex flex-col md:flex-row flex-1">
        <div className="flex-1 flex flex-col relative z-10">
          <div className="p-3 md:p-6 flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
            <div className="w-full flex justify-between items-center md:hidden">
              <div className="relative">
                <Moon className="w-8 h-8 text-ramadan-gold fill-ramadan-gold" />
                <Star className="absolute top-1 right-0 w-3 h-3 text-ramadan-gold fill-ramadan-gold" />
              </div>
              <h1 className="text-xl font-black text-ramadan-gold">مسابقة رمضان</h1>
              <button 
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-1.5 bg-black/20 rounded-lg border border-ramadan-gold/40 text-ramadan-gold"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="relative">
                <Moon className="w-16 h-16 text-ramadan-gold fill-ramadan-gold" />
                <Star className="absolute top-2 right-0 w-6 h-6 text-ramadan-gold fill-ramadan-gold" />
              </div>
            </div>

            <div className="flex flex-col items-center">
              <h1 className="arabic-title text-center hidden md:block">مسابقة رمضان</h1>
              <div className="mt-1 md:mt-2 relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/10" />
                  <motion.circle 
                    cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
                    strokeDasharray="282.7"
                    animate={{ strokeDashoffset: 282.7 - (282.7 * timer) / (gameState === 'WAITING' ? 5 : 30) }}
                    className={timer <= 5 ? 'text-ramadan-red' : 'text-ramadan-gold'}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </svg>
                <span className={`absolute text-xl md:text-2xl font-black ${timer <= 5 ? 'text-ramadan-red animate-pulse' : 'text-ramadan-gold'}`}>
                  {timer}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-end gap-2 md:gap-4 w-full md:w-auto">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-ramadan-gold font-black text-lg md:text-2xl">{playerName}</span>
                  <span className="text-ramadan-cream font-bold text-sm md:text-lg">{currentLevel > 0 ? POINTS_LEVELS[currentLevel - 1] : 0} نقطة</span>
                </div>
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-full border-2 border-ramadan-gold flex items-center justify-center overflow-hidden bg-black/20">
                  <User className="w-6 h-6 md:w-10 md:h-10 text-ramadan-gold" />
                </div>
              </div>
              <div className="flex gap-1.5 md:gap-2">
                <button onClick={useFiftyFifty} disabled={!lifelines.fiftyFifty || gameState !== 'PLAYING'} className={`lifeline-circle w-10 h-10 md:w-12 md:h-12 ${!lifelines.fiftyFifty && 'opacity-30'}`}>
                  <span className="text-[10px] md:text-xs font-bold">50/50</span>
                </button>
                <button onClick={useAiHint} disabled={!lifelines.aiHint || gameState !== 'PLAYING' || isAiLoading} className={`lifeline-circle w-10 h-10 md:w-12 md:h-12 ${!lifelines.aiHint && 'opacity-30'}`}>
                  {isAiLoading ? <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <span className="text-[10px] md:text-xs font-bold">AI</span>}
                </button>
                <button onClick={useCallHelp} disabled={!lifelines.call || gameState !== 'PLAYING'} className={`lifeline-circle w-10 h-10 md:w-12 md:h-12 ${!lifelines.call && 'opacity-30'}`}>
                  <Phone className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button onClick={useSwitchQuestion} disabled={!lifelines.switch || gameState !== 'PLAYING'} className={`lifeline-circle w-10 h-10 md:w-12 md:h-12 ${!lifelines.switch && 'opacity-30'}`}>
                  <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-start md:justify-center px-4 md:px-6 py-4 md:pb-12 space-y-4 md:space-y-8 max-w-5xl mx-auto w-full overflow-y-auto scrollbar-hide">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentQuestion.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full mosque-frame text-center"
              >
                <h3 className="text-xl md:text-5xl font-bold leading-relaxed text-ramadan-cream drop-shadow-lg px-2">
                  {currentQuestion.question}
                </h3>

                {aiHintText && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 md:mt-8 bg-ramadan-gold/20 border border-ramadan-gold/40 p-2 md:p-4 rounded-2xl text-ramadan-cream text-sm md:text-lg italic flex items-center justify-center gap-4"
                  >
                    <HelpCircle className="w-4 h-4 md:w-6 md:h-6 text-ramadan-gold" />
                    <p>{aiHintText}</p>
                    <button onClick={() => setAiHintText(null)} className="p-1 hover:bg-white/10 rounded-full"><X className="w-4 h-4 md:w-5 md:h-5" /></button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-x-12 md:gap-y-6 w-full max-w-4xl pb-4">
              {currentQuestion.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswerClick(idx)}
                  className={`answer-btn-ramadan ${getAnswerColor(idx)} py-2.5 md:py-4 text-sm md:text-lg`}
                >
                  <div className="flex items-center justify-center gap-2 md:gap-4">
                    <span className="text-ramadan-gold font-bold">{idx + 1} - </span>
                    <span>{option}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`
          fixed md:relative top-0 right-0 h-full w-72 bg-ramadan-teal md:bg-black/30 border-r border-ramadan-gold/20 flex flex-col z-[60] md:z-20
          transition-transform duration-300 ease-in-out
          ${showSidebar ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
          <div className="p-6 text-center border-b border-ramadan-gold/20 flex justify-between items-center md:block">
            <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 text-ramadan-gold">
              <X className="w-6 h-6" />
            </button>
            <div className="inline-block border-2 border-ramadan-gold px-8 py-2 rounded-full bg-ramadan-teal/40">
              <span className="text-2xl font-bold text-ramadan-gold">المستوى {currentLevel + 1}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide py-4">
            {[...PRIZE_LEVELS_AR].reverse().map((prize, idx) => {
              const level = 15 - idx;
              const isCurrent = level === currentLevel;
              const isPassed = level < currentLevel;

              return (
                <div 
                  key={level}
                  className={`sidebar-item ${isCurrent ? 'active' : ''} ${isPassed ? 'opacity-40' : ''}`}
                >
                  <span className="w-8 text-xs opacity-60">{String(level + 1).padStart(2, '0')}</span>
                  <span className="flex-1 text-right pr-4">{prize}</span>
                  {isCurrent && <ChevronLeft className="w-4 h-4 animate-pulse" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/60 z-[55] md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      <div className="fixed bottom-4 left-4 flex flex-col gap-2 z-30">
        <button 
          onClick={() => takeScreenshot('Manual')}
          className="p-3 bg-black/40 hover:bg-ramadan-gold/20 rounded-full border border-ramadan-gold/20 transition-all text-ramadan-gold"
        >
          <Camera className="w-5 h-5" />
        </button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[200] flex items-center gap-3 border-2 ${
              toast.type === 'success' ? 'bg-ramadan-green border-white text-white' : 'bg-ramadan-red border-white text-white'
            }`}
          >
            <Star className={`w-5 h-5 ${toast.type === 'success' ? 'fill-white' : ''}`} />
            <span className="font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {renderLeaderboardModal()}
    </div>
  );
}
