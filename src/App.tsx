import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Code2, 
  ChevronRight, 
  Play, 
  RotateCcw, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Command as CommandIcon,
  Info,
  History,
  HelpCircle,
  X,
  FileText,
  Folder,
  Cpu,
  Globe,
  Copy,
  Check,
  Terminal,
  Braces,
  Package,
  Layers
} from 'lucide-react';
import { PYTHON_TOPICS, TOPIC_CATEGORIES, APP_THEME } from './constants';
import { AppState, Challenge, GradingResult, SessionState, Difficulty } from './types';
import { generateChallenge, gradeSubmission } from './services/aiService';
import { makeTopicDifficultyKey, fingerprintChallenge } from './utils/challengeFingerprint';

const MAX_GENERATION_RETRIES = 3;
const MAX_RECENT_CHALLENGES_TO_AVOID = 5;

export default function App() {
  const [appState, setAppState] = useState<AppState>('DASHBOARD');
  const [session, setSession] = useState<SessionState>({
    selectedTopic: null,
    currentChallenge: null,
    lastResult: null,
    history: [],
    recentChallengesByKey: {},
    seenChallengeFingerprintsByKey: {},
  });
  const [userInput, setUserInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('BEGINNER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredTopics = PYTHON_TOPICS.filter(topic => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch =
      normalizedQuery.length === 0 ||
      topic.name.toLowerCase().includes(normalizedQuery) ||
      topic.description.toLowerCase().includes(normalizedQuery);

    const matchesCategory =
      normalizedQuery.length > 0 ? true : !selectedCategory || topic.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    if (appState === 'PRACTICE' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [appState]);

  const generateNonRepeatingChallenge = async (topicId: string) => {
    const key = makeTopicDifficultyKey(topicId, selectedDifficulty);
    const avoidExactChallenges = (session.recentChallengesByKey[key] ?? []).slice(-MAX_RECENT_CHALLENGES_TO_AVOID);
    const seen = new Set(session.seenChallengeFingerprintsByKey[key] ?? []);

    let lastChallenge: Challenge | null = null;
    for (let attempt = 0; attempt < MAX_GENERATION_RETRIES; attempt++) {
      const challenge = await generateChallenge(topicId, selectedDifficulty, { avoidExactChallenges });
      lastChallenge = challenge;
      const fp = fingerprintChallenge(challenge);
      if (!seen.has(fp)) return challenge;
    }

    return lastChallenge ?? generateChallenge(topicId, selectedDifficulty, { avoidExactChallenges });
  };

  const handleSelectTopic = async (topicId: string) => {
    setIsLoading(true);
    setAppState('LOADING_CHALLENGE');
    setError(null);
    try {
      const challenge = await generateNonRepeatingChallenge(topicId);
      setSession(prev => ({
        ...prev,
        selectedTopic: topicId,
        currentChallenge: challenge,
        lastResult: null,
        recentChallengesByKey: (() => {
          const key = makeTopicDifficultyKey(topicId, selectedDifficulty);
          const existing = prev.recentChallengesByKey[key] ?? [];
          const next = [...existing, { description: challenge.description, context: challenge.context }];
          return { ...prev.recentChallengesByKey, [key]: next.slice(-MAX_RECENT_CHALLENGES_TO_AVOID) };
        })(),
        seenChallengeFingerprintsByKey: (() => {
          const key = makeTopicDifficultyKey(topicId, selectedDifficulty);
          const fp = fingerprintChallenge(challenge);
          const existing = prev.seenChallengeFingerprintsByKey[key] ?? [];
          return {
            ...prev.seenChallengeFingerprintsByKey,
            [key]: existing.includes(fp) ? existing : [...existing, fp],
          };
        })(),
      }));
      setAppState('PRACTICE');
      setUserInput('');
    } catch (err) {
      setError("The Python tutor is currently unavailable. Please try again.");
      setAppState('DASHBOARD');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'FileText': return <FileText className="w-4 h-4" />;
      case 'Folder': return <Folder className="w-4 h-4" />;
      case 'Cpu': return <Cpu className="w-4 h-4" />;
      case 'Globe': return <Globe className="w-4 h-4" />;
      case 'Terminal': return <Terminal className="w-4 h-4" />;
      case 'Package': return <Package className="w-4 h-4" />;
      case 'Layers': return <Layers className="w-4 h-4" />;
      default: return <Code2 className="w-4 h-4" />;
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || !session.currentChallenge || isLoading) return;

    setIsLoading(true);
    setAppState('GRADING');
    try {
      const result = await gradeSubmission(session.currentChallenge, userInput);
      setSession(prev => ({
        ...prev,
        lastResult: result,
        history: [...prev.history, { 
          challenge: prev.currentChallenge!, 
          result, 
          submission: userInput 
        }]
      }));
      setAppState('FEEDBACK');
    } catch (err) {
      setError("Grading failed. Please try again.");
      setAppState('PRACTICE');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextChallenge = async () => {
    if (!session.selectedTopic) return;
    setIsLoading(true);
    setAppState('LOADING_CHALLENGE');
    try {
      const challenge = await generateNonRepeatingChallenge(session.selectedTopic);
      setSession(prev => ({
        ...prev,
        currentChallenge: challenge,
        lastResult: null,
        recentChallengesByKey: (() => {
          const key = makeTopicDifficultyKey(prev.selectedTopic || session.selectedTopic!, selectedDifficulty);
          const existing = prev.recentChallengesByKey[key] ?? [];
          const next = [...existing, { description: challenge.description, context: challenge.context }];
          return { ...prev.recentChallengesByKey, [key]: next.slice(-MAX_RECENT_CHALLENGES_TO_AVOID) };
        })(),
        seenChallengeFingerprintsByKey: (() => {
          const key = makeTopicDifficultyKey(prev.selectedTopic || session.selectedTopic!, selectedDifficulty);
          const fp = fingerprintChallenge(challenge);
          const existing = prev.seenChallengeFingerprintsByKey[key] ?? [];
          return {
            ...prev.seenChallengeFingerprintsByKey,
            [key]: existing.includes(fp) ? existing : [...existing, fp],
          };
        })(),
      }));
      setAppState('PRACTICE');
      setUserInput('');
    } catch (err) {
      setError("Failed to load next challenge.");
      setAppState('FEEDBACK');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuit = () => {
    setAppState('DASHBOARD');
    setSession({
      selectedTopic: null,
      currentChallenge: null,
      lastResult: null,
      history: [],
      recentChallengesByKey: {},
      seenChallengeFingerprintsByKey: {},
    });
    setUserInput('');
    setError(null);
  };

  return (
    <div className={`min-h-screen ${APP_THEME.bg} ${APP_THEME.text} ${APP_THEME.fontMono} p-4 md:p-8 flex flex-col items-center`}>
      {/* Header */}
      <header className="w-full max-w-4xl mb-8 flex justify-between items-center border-b border-blue-900/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Code2 className="w-8 h-8 text-blue-400" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter uppercase text-white">PythonMaster AI</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowHelp(true)}
            className="text-blue-500/50 hover:text-blue-400 transition-colors"
            title="How to use"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          {appState !== 'DASHBOARD' && (
            <button 
              onClick={handleQuit}
              className="flex items-center gap-2 px-3 py-1 border border-blue-900/50 hover:bg-blue-900/20 transition-colors text-sm text-blue-400"
            >
              <LogOut className="w-4 h-4" />
              EXIT
            </button>
          )}
        </div>
      </header>

      <main className="w-full max-w-4xl flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {appState === 'DASHBOARD' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <div className="col-span-full mb-8 flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl mb-2 flex items-center gap-2 text-white">
                      <Braces className="w-5 h-5 text-blue-400" />
                      Python Training Grounds
                    </h2>
                    <p className="text-slate-400 text-md">Master Python through AI-generated coding challenges.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Difficulty Selector */}
                    <div className="flex bg-blue-900/10 border border-blue-900/30 p-1 rounded-sm">
                      {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => setSelectedDifficulty(d)}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all ${selectedDifficulty === d ? 'bg-blue-500 text-black' : 'text-blue-500/40 hover:text-blue-400'}`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full md:w-44">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <span className="text-blue-500/80 text-xs">{">>>"}</span>
                      </div>
                      <input
                        type="text"
                        placeholder="search_topic"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-blue-900/10 border border-blue-900/30 py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 placeholder:text-blue-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Category Tabs */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-all ${!selectedCategory ? 'bg-blue-500 text-black border-blue-500' : 'border-blue-900/30 text-slate-400 hover:border-blue-500/50'}`}
                  >
                    All Topics
                  </button>
                  {TOPIC_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest border transition-all ${selectedCategory === cat.id ? 'bg-blue-500 text-black border-blue-500' : 'border-blue-900/30 text-slate-400 hover:border-blue-500/50'}`}
                    >
                      {getCategoryIcon(cat.icon)}
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTopics.length > 0 ? (
                filteredTopics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => handleSelectTopic(topic.id)}
                    disabled={isLoading}
                    className="group relative p-6 border border-blue-900/30 bg-blue-900/5 hover:bg-blue-900/10 hover:border-blue-500/50 transition-all text-left overflow-hidden"
                  >
                    <div className="relative z-10">
                      <h3 className="text-lg font-bold mb-1 group-hover:text-white transition-colors">{topic.name}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{topic.description}</p>
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-blue-400" />
                    </div>
                    {isLoading && session.selectedTopic === topic.id && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="col-span-full py-12 text-center border border-dashed border-blue-900/20">
                  <p className="text-slate-500 italic">No topics matching "{searchQuery}" found.</p>
                </div>
              )}

              {/* History Section */}
              {session.history.length > 0 && (
                <div className="col-span-full mt-12">
                  <div className="flex items-center justify-between mb-6 border-b border-blue-900/30 pb-2">
                    <h2 className="text-xl flex items-center gap-2 text-white">
                      <History className="w-5 h-5 text-blue-400" />
                      Recent Activity
                    </h2>
                    <button 
                      onClick={() => setSession(prev => ({ ...prev, history: [] }))}
                      className="text-[10px] text-blue-500/40 hover:text-blue-400 transition-colors uppercase tracking-widest"
                    >
                      Clear Log
                    </button>
                  </div>
                  <div className="space-y-3">
                    {session.history.slice().reverse().map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-4 border border-blue-900/20 bg-blue-900/5 flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.result.correct ? (
                              <CheckCircle2 className="w-3 h-3 text-blue-400" />
                            ) : (
                              <XCircle className="w-3 h-3 text-amber-500" />
                            )}
                            <span className="text-xs font-bold text-white uppercase tracking-tighter">
                              {item.challenge.description.slice(0, 60)}...
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 truncate">
                            {">>>"} {item.submission.split('\n')[0]}...
                          </div>
                        </div>
                        <div className={`text-[10px] font-bold uppercase tracking-widest ${item.result.correct ? 'text-blue-400' : 'text-amber-500'}`}>
                          {item.result.correct ? 'PASSED' : 'FAILED'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {appState === 'LOADING_CHALLENGE' && (
            <motion.div
              key="loading-challenge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center flex-1 py-20"
            >
              <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-blue-500/20" />
                <Code2 className="w-8 h-8 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <h2 className="mt-8 text-2xl font-bold tracking-tighter uppercase animate-pulse text-white">
                {session.currentChallenge ? 'Compiling Next Task' : 'Initializing Python Environment'}
              </h2>
              <p className="mt-2 text-blue-500/40 text-sm tracking-widest uppercase">
                Importing knowledge modules...
              </p>
            </motion.div>
          )}

          {(appState === 'PRACTICE' || appState === 'GRADING') && session.currentChallenge && (
            <motion.div 
              key="practice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-6 flex-1"
            >
              {/* Challenge Card */}
              <div className="p-6 border border-blue-900/30 bg-blue-900/5 rounded-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs text-blue-500/50 uppercase tracking-widest">
                    <Info className="w-4 h-4" />
                    Topic: {session.selectedTopic}
                  </div>
                  <div className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${
                    session.currentChallenge.difficulty === 'BEGINNER' ? 'border-blue-500/50 text-blue-400' :
                    session.currentChallenge.difficulty === 'INTERMEDIATE' ? 'border-amber-500/50 text-amber-500' :
                    'border-red-500/50 text-red-500'
                  }`}>
                    {session.currentChallenge.difficulty}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-4 text-white leading-tight">
                  {session.currentChallenge.description}
                </h3>
                <div className="bg-black/40 p-4 border-l-2 border-blue-500/50 mb-4">
                  <p className="text-sm italic text-slate-400">
                    {session.currentChallenge.context}
                  </p>
                </div>
                {selectedDifficulty === 'BEGINNER' && (
                  <div className="text-xs text-blue-500/40">
                    Hint: {session.currentChallenge.expectedCommandHint}
                  </div>
                )}
              </div>

              {/* Code Editor */}
              <div className="flex-1 flex flex-col border border-blue-900/30 bg-[#050507] rounded-sm overflow-hidden shadow-2xl">
                <div className="bg-blue-900/10 px-4 py-2 border-b border-blue-900/30 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                    <div className="w-3 h-3 rounded-full bg-blue-500/50" />
                    <span className="ml-2 text-[10px] text-blue-500/40 tracking-widest uppercase">main.py</span>
                  </div>
                  <div className="text-[10px] text-blue-500/40 uppercase tracking-widest">Python 3.x</div>
                </div>
                
                <div className="p-6 flex-1 flex flex-col font-mono text-lg relative">
                  <div className="relative h-full">
                    <textarea
                      ref={inputRef}
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      disabled={appState === 'GRADING'}
                      rows={10}
                      className={`w-full bg-transparent border-none outline-none text-blue-100 caret-blue-400 resize-none leading-7 ${appState === 'GRADING' ? 'opacity-0' : 'opacity-100'}`}
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="# Write your Python code here..."
                    />
                    {appState === 'GRADING' && (
                      <div className="absolute inset-0 bg-[#050507] flex items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                        <span className="text-lg animate-pulse text-blue-400 font-bold uppercase tracking-tighter">Analyzing Syntax...</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleSubmit()}
                      disabled={!userInput.trim() || appState === 'GRADING'}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-black font-bold hover:bg-blue-400 disabled:opacity-50 disabled:hover:bg-blue-500 transition-colors uppercase text-sm tracking-tighter"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Run & Grade
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {appState === 'FEEDBACK' && session.lastResult && (
            <motion.div 
              key="feedback"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-6 items-center justify-center flex-1 py-12"
            >
              <div className={`w-full max-w-2xl p-8 border ${session.lastResult.correct ? 'border-blue-500/50 bg-blue-500/5' : 'border-amber-500/50 bg-amber-500/5'} rounded-sm text-center`}>
                <div className="flex justify-center mb-6">
                  {session.lastResult.correct ? (
                    <CheckCircle2 className="w-16 h-16 text-blue-400" />
                  ) : (
                    <XCircle className="w-16 h-16 text-amber-500" />
                  )}
                </div>
                
                <h2 className={`text-3xl font-bold mb-4 uppercase tracking-tighter ${session.lastResult.correct ? 'text-blue-400' : 'text-amber-500'}`}>
                  {session.lastResult.correct ? 'Code Verified' : 'Syntax Error / Logic Flaw'}
                </h2>
                
                <p className="text-lg text-slate-200 mb-8 leading-relaxed">
                  {session.lastResult.feedback}
                </p>

                {!session.lastResult.correct && (
                  <div className="mb-8 text-left w-full">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs uppercase tracking-widest text-blue-500/50">Reference Solution:</h4>
                      <button 
                        onClick={() => handleCopy(session.lastResult!.solution)}
                        className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-blue-500/40 hover:text-blue-400 transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copy Code' : 'Copy Code'}
                      </button>
                    </div>
                    <div className="bg-black/60 p-4 border border-blue-900/30 font-mono text-blue-300 overflow-x-auto">
                      <pre><code>{session.lastResult.solution}</code></pre>
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleNextChallenge}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-500 text-black font-bold hover:bg-blue-400 transition-colors uppercase text-sm tracking-tighter"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {session.lastResult.correct ? 'Next Challenge' : 'Retry Task'}
                  </button>
                  <button
                    onClick={handleQuit}
                    className="flex items-center justify-center gap-2 px-8 py-3 border border-blue-500/30 hover:bg-blue-500/10 transition-colors uppercase text-sm tracking-tighter text-blue-400"
                  >
                    <LogOut className="w-4 h-4" />
                    Return to Hub
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-4 p-4 border border-red-500/30 bg-red-500/5 text-red-400 text-sm flex items-center gap-3">
            <XCircle className="w-5 h-5" />
            {error}
          </div>
        )}
      </main>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-[#0a0a10] border border-blue-900/50 p-8 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowHelp(false)}
                className="absolute top-4 right-4 text-blue-500/50 hover:text-blue-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 uppercase tracking-tighter text-white">
                <HelpCircle className="w-6 h-6 text-blue-400" />
                Python Training Protocol
              </h2>
              
              <div className="space-y-6 text-sm leading-relaxed text-slate-400">
                <section>
                  <h3 className="text-blue-400 font-bold mb-2 uppercase tracking-widest text-xs">01. Select Topic</h3>
                  <p>Choose a Python concept from the dashboard. Challenges range from basic variables to advanced OOP and list comprehensions.</p>
                </section>
                
                <section>
                  <h3 className="text-blue-400 font-bold mb-2 uppercase tracking-widest text-xs">02. Write Python Code</h3>
                  <p>Implement the solution in the provided editor. Pay attention to indentation and Pythonic practices.</p>
                </section>
                
                <section>
                  <h3 className="text-blue-400 font-bold mb-2 uppercase tracking-widest text-xs">03. AI Evaluation</h3>
                  <p>Our AI tutor analyzes your code for correctness, efficiency, and style. You'll receive detailed feedback and a reference solution if needed.</p>
                </section>

                <div className="pt-4 border-t border-blue-900/30">
                  <p className="italic text-[10px] uppercase tracking-widest text-blue-500/40">
                    Note: The AI understands multiple ways to solve a problem. Focus on clarity and correctness.
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setShowHelp(false)}
                className="w-full mt-8 py-3 bg-blue-500 text-black font-bold hover:bg-blue-400 transition-colors uppercase text-xs tracking-widest"
              >
                Understood
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="w-full max-w-4xl mt-12 pt-4 border-t border-blue-900/30 flex justify-between items-center text-[10px] text-blue-500/30 uppercase tracking-[0.2em]">
        <div>Interpreter Status: Ready</div>
        <div>&copy; 2024 PythonMaster AI — Neural Learning Active</div>
      </footer>
    </div>
  );
}
