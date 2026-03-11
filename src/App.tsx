import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  HelpCircle, 
  Menu,
  Zap, 
  Phone, 
  RefreshCw, 
  ChevronLeft, 
  Camera,
  Download,
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
  const [clickTracker, setClickTracker] = useState<{ [id: number]: number }>({});
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const gameRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Toast Helper ---
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Randomize Questions ---
  const fetchQuestions = () => {
    const randomized: Question[] = [];
    for (let i = 1; i <= 16; i++) {
      const pool = QUESTIONS.filter(q => q.difficulty === i);
      if (pool.length > 0) {
        const randomQ = pool[Math.floor(Math.random() * pool.length)];
        randomized.push(randomQ);
      }
    }
    if (randomized.length > 0) {
      setCurrentQuestions(randomized);
      setIsLoadingQuestions(false);
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

  const handleUsernameClick = async (id: number, username: string) => {
    const newCount = (clickTracker[id] || 0) + 1;
    if (newCount >= 5) {
      try {
        const { error } = await supabase
          .from('leaderboard')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        showToast(`تم حذف بيانات ${username}`, 'success');
        fetchLeaderboard();
        setClickTracker(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } catch (e) {
        console.error('Delete failed', e);
        showToast('فشل الحذف', 'error');
      }
    } else {
      setClickTracker(prev => ({ ...prev, [id]: newCount }));
    }
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
  const takeScreenshot = async (label: string) => {
    if (!gameRef.current) return;
    try {
      await html2canvas(gameRef.current, {
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      console.log(`Screenshot taken: ${label}`);
    } catch (e) {
      console.error('Screenshot failed', e);
    }
  };

  const downloadCertificate = async () => {
    const certElement = document.getElementById('certificate');
    if (!certElement) return;
    try {
      const canvas = await html2canvas(certElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${playerName}_Ramadan_Certificate.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error generating certificate:', error);
    }
  };

  // --- Render Helpers ---
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
                          className="text-white font-bold cursor-pointer select-none hover:text-ramadan-gold transition-colors"
                          onClick={() => handleUsernameClick(entry.id, entry.username)}
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
              src="https://github.com/zueitera-cloud/Ramadan/blob/main/Fashkol.png?raw=true" 
              alt="Fashkol" 
              className="w-40 h-40 mx-auto rounded-full border-4 border-ramadan-gold shadow-2xl object-cover bg-ramadan-teal/50"
              referrerPolicy="no-referrer"
            />
            <Moon className="absolute -bottom-2 -right-2 w-12 h-12 text-ramadan-gold fill-ramadan-gold drop-shadow-lg" />
            <Star className="absolute -top-2 -left-2 w-8 h-8 text-ramadan-gold fill-ramadan-gold animate-pulse" />
          </div>
          
          <div className="space-y-2">
            <h1 className="arabic-title">مسابقة رمضان</h1>
            <p className="text-ramadan-gold text-sm tracking-widest uppercase font-bold">Ramadan Trivia</p>
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
              <button onClick={downloadCertificate} className="flex items-center justify-center gap-2 bg-ramadan-gold text-ramadan-teal px-6 py-2 rounded-full font-bold mx-auto">
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
