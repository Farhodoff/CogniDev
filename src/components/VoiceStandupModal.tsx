import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Clock,
  Flame,
} from 'lucide-react';
import { useSynapse } from '../lib/store';
import { speakVoiceReminder } from '../lib/notifications';
import { createLiveSpeechRecognizer } from '../lib/stt';
import type { DailyRoutineStage } from '../lib/types';
import type { MorningVoiceStandupResult, EveningVoiceStandupResult } from '../lib/voiceStandup';

interface VoiceStandupModalProps {
  open?: boolean;
  onClose?: () => void;
  stageOverride?: DailyRoutineStage;
}

interface StageConfigItem {
  time: string;
  badge: string;
  title: string;
  question: string;
  themeGrad: string;
  accentColor: string;
  accentBorder: string;
  glowShadow: string;
  buttonGrad: string;
  examples: string[];
  resultTitle: string;
}

export default function VoiceStandupModal({
  open: propOpen,
  onClose: propOnClose,
  stageOverride,
}: VoiceStandupModalProps) {
  const {
    activeVoiceStandup,
    closeVoiceStandup,
    submitMorningVoiceStandup,
    submitEveningVoiceStandup,
    setMainView,
    setHud,
    userProfile,
  } = useSynapse();

  const isOpen = propOpen ?? (activeVoiceStandup?.open || false);
  const stage = stageOverride || activeVoiceStandup?.stage || 'morning_10';

  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  // Results state
  const [morningResult, setMorningResult] = useState<MorningVoiceStandupResult | null>(null);
  const [eveningResult, setEveningResult] = useState<EveningVoiceStandupResult | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const recognizerRef = useRef<ReturnType<typeof createLiveSpeechRecognizer> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userName = userProfile?.full_name?.split(' ')[0] || 'Muhandis';

  // Config based on routine stage
  const stageConfigMap: Record<DailyRoutineStage, StageConfigItem> = {
    morning_10: {
      time: '10:00',
      badge: '🌅 10:00 Ertalabki Ovozli Standup',
      title: 'Ertalabki Rejalar & Joriy Fokus',
      question: `Xayrli tong, ${userName}! Bugun qanday asosiy vazifalar ustida ishlaysiz? Ovoz bilan ayting, men ularni to‘g‘ridan-to‘g‘ri Joriy Fokusga kiritaman.`,
      themeGrad: 'from-amber-500/20 via-orange-500/10 to-transparent',
      accentColor: 'text-amber-400',
      accentBorder: 'border-amber-500/40',
      glowShadow: 'shadow-[0_0_50px_rgba(245,158,11,0.25)]',
      buttonGrad: 'from-amber-500 to-orange-600',
      examples: [
        'Bugun Redis kesh va gRPC xizmatini yozaman',
        'PostgreSQL querylarni indekslash va Docker compose sozlash',
        'Foydalanuvchi auth tokeni va unit testlarini yozish',
      ],
      resultTitle: 'Joriy Fokusga Kiritilgan Vazifalar',
    },
    midday_14: {
      time: '14:00',
      badge: '⏱ 14:00 Oraliq Nazorat',
      title: 'Kunning 2-yarmi & To‘siqlar Nazorati',
      question: `Soat 14:00 bo‘ldi, ${userName}. Oraliq nazorat vaqti! Bugungi qaysi vazifalar yakunlandi va qanday to‘siqlarga duch keldingiz?`,
      themeGrad: 'from-sky-500/20 via-blue-500/10 to-transparent',
      accentColor: 'text-sky-400',
      accentBorder: 'border-sky-500/40',
      glowShadow: 'shadow-[0_0_50px_rgba(14,165,233,0.25)]',
      buttonGrad: 'from-sky-500 to-blue-600',
      examples: [
        'Redis keshni tugatdim, endi gRPC servisini test qilyapman',
        'API integratsiyasida to‘siq bo‘ldi, backend loglarini tekshiryapman',
      ],
      resultTitle: 'Oraliq Status & Fokus Yangilanishi',
    },
    evening_22: {
      time: '22:00',
      badge: '🌙 22:00 Kechki Ovozli Retrospektiv',
      title: 'Kun Yakuni & Kechikish Sabablari Auditi',
      question: `Kechki soat 22:00, ${userName}. Bugungi rejalashtirilgan vazifalarga nima uchun ulgurmadingiz? Qanday to‘siq yoki sabablar bo‘ldi? Ovoz bilan aytsangiz, AI buni Daily Log va Retro sahifasiga saqlaydi.`,
      themeGrad: 'from-purple-500/20 via-indigo-500/10 to-transparent',
      accentColor: 'text-purple-400',
      accentBorder: 'border-purple-500/40',
      glowShadow: 'shadow-[0_0_50px_rgba(168,85,247,0.25)]',
      buttonGrad: 'from-purple-600 to-indigo-600',
      examples: [
        'Docker tarmoq xatosi bo‘yicha 3 soat ketdi, konfiguratsiyada xatolik bor edi',
        'Productionda kutilmagan bug chiqib, shoshilinch hotfix qilishga to‘g‘ri keldi',
        'gRPC protoc generatsiyasida versiyalar mos kelmadi va kutubxonalarni qayta yangiladim',
      ],
      resultTitle: 'Daily Log va Retro Sahifasiga Saqlangan Blok',
    },
  };

  const stageConfig = stageConfigMap[stage] || stageConfigMap.morning_10;

  // Speak prompt on modal open
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setSavedSuccess(false);
      setMorningResult(null);
      setEveningResult(null);
      setIsAiSpeaking(true);
      speakVoiceReminder(stageConfig.question)
        .catch(() => {})
        .finally(() => setIsAiSpeaking(false));
    } else {
      stopRecording();
    }
  }, [isOpen, stage]);

  const handleClose = () => {
    stopRecording();
    if (propOnClose) propOnClose();
    closeVoiceStandup();
  };

  const startRecording = () => {
    setTranscript('');
    setSavedSuccess(false);
    setIsRecording(true);
    setRecordSeconds(0);

    timerRef.current = setInterval(() => {
      setRecordSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const rec = createLiveSpeechRecognizer('uz', (partial) => {
        setTranscript(partial);
      });
      recognizerRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('[VoiceStandup] speech recognition start error:', err);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recognizerRef.current) {
      try {
        const finalText = recognizerRef.current.stop();
        if (finalText && finalText.trim().length > transcript.length) {
          setTranscript(finalText.trim());
        }
      } catch {}
      recognizerRef.current = null;
    }
  };

  const handleReplayQuestion = () => {
    setIsAiSpeaking(true);
    speakVoiceReminder(stageConfig.question)
      .catch(() => {})
      .finally(() => setIsAiSpeaking(false));
  };

  // Submit and process voice transcript
  const handleSubmitStandup = async () => {
    const textToProcess = transcript.trim();
    if (!textToProcess) {
      setHud('Iltimos, avval mikrofonga gapiring yoki matn kiriting');
      return;
    }

    if (isRecording) {
      stopRecording();
    }

    setIsProcessing(true);
    try {
      if (stage === 'morning_10' || stage === 'midday_14') {
        const res = await submitMorningVoiceStandup(textToProcess);
        setMorningResult(res);
        setSavedSuccess(true);
      } else {
        const res = await submitEveningVoiceStandup(textToProcess);
        setEveningResult(res);
        setSavedSuccess(true);
      }
    } catch (err) {
      console.error('[VoiceStandup] submission error:', err);
      setHud('Ovozli standupni tahlil qilishda xatolik yuz berdi');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-2xl overflow-hidden rounded-3xl border ${stageConfig.accentBorder} bg-[#101116] p-6 text-white shadow-2xl ${stageConfig.glowShadow} transition-all`}
      >
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-br ${stageConfig.themeGrad} blur-3xl pointer-events-none`}
        />
        <div
          className={`absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-gradient-to-tl ${stageConfig.themeGrad} blur-3xl pointer-events-none`}
        />

        {/* Modal Header */}
        <div className="relative flex items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/10 ${stageConfig.accentColor} shadow-inner`}
            >
              <Mic size={22} className={isRecording ? 'animate-pulse text-rose-400' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md bg-white/[0.06] border border-white/10 px-2.5 py-0.5 font-mono text-[11px] font-bold ${stageConfig.accentColor}`}
                >
                  {stageConfig.badge}
                </span>
                <span className="font-mono text-[11px] text-zinc-400 flex items-center gap-1">
                  <Clock size={11} /> {stageConfig.time}
                </span>
              </div>
              <h2 className="text-[16px] font-bold text-white tracking-tight mt-1">
                {stageConfig.title}
              </h2>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
            title="Yopish"
          >
            <X size={18} />
          </button>
        </div>

        {/* AI Question & Voice Dialogue Box */}
        <div className="relative mt-5 space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-amber-400 mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    AI Murabbiy Savoli:
                  </p>
                  <p className="text-[13.5px] font-medium text-zinc-100 leading-relaxed">
                    {stageConfig.question}
                  </p>
                </div>
              </div>

              <button
                onClick={handleReplayQuestion}
                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
                title="Savolni ovoz bilan qayta eshitish"
              >
                <Volume2 size={13} className={isAiSpeaking ? 'text-amber-400 animate-pulse' : ''} />
                <span>Qayta eshitish</span>
              </button>
            </div>

            {/* Simulated Voice Waveform */}
            <div className="mt-3 flex items-center justify-center gap-1 h-5 px-4 bg-black/40 rounded-xl border border-white/5">
              {[40, 70, 30, 90, 60, 20, 80, 50, 100, 45, 85, 30, 60, 95, 40].map((h, i) => (
                <div
                  key={i}
                  style={{ height: isRecording || isAiSpeaking ? `${h}%` : '20%' }}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isRecording
                      ? 'bg-rose-500 animate-pulse'
                      : isAiSpeaking
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-zinc-700'
                  }`}
                />
              ))}
              <span className="ml-3 font-mono text-[10px] text-zinc-400">
                {isRecording
                  ? `Yozilmoqda... (${recordSeconds}s)`
                  : isAiSpeaking
                  ? 'AI gapirmoqda...'
                  : 'Tayyor'}
              </span>
            </div>
          </div>

          {/* Results Display when Saved */}
          {savedSuccess ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-5 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <CheckCircle2 size={20} />
                <h3 className="text-[14.5px] font-bold text-white">
                  {stageConfig.resultTitle} muvaffaqiyatli saqlandi! ✓
                </h3>
              </div>

              {/* Morning Result display */}
              {morningResult && (
                <div className="space-y-3">
                  <p className="text-[12.5px] text-zinc-300 italic">
                    «{morningResult.spokenReply}»
                  </p>

                  <div className="space-y-2">
                    <p className="text-[11.5px] font-semibold text-zinc-400 uppercase tracking-wider">
                      🎯 Joriy Fokusga qo‘shilgan vazifalar:
                    </p>
                    {morningResult.tasks.map((task, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Flame size={14} className="text-amber-400 shrink-0" />
                          <span className="text-[13px] font-semibold text-white">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {task.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] text-amber-300"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        handleClose();
                        setMainView('dashboard');
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-[12px] font-bold text-black shadow-lg hover:brightness-110 transition"
                    >
                      <span>Joriy Fokusni Ko‘rish</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Evening Result display */}
              {eveningResult && (
                <div className="space-y-3">
                  <p className="text-[12.5px] text-zinc-300 italic">
                    «{eveningResult.spokenReply}»
                  </p>

                  <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold text-[13px]">
                      <AlertTriangle size={15} />
                      <span>{eveningResult.blockerTitle}</span>
                    </div>
                    <p className="text-[12px] text-zinc-300 leading-relaxed">
                      {eveningResult.retroBlock.content}
                    </p>
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                      <span>🗓 Daily Log: Saqlandi</span>
                      <span>🌙 Retro Jurnali: Saqlandi</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        handleClose();
                        setMainView('retro');
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-[12px] font-bold text-white shadow-lg hover:brightness-110 transition"
                    >
                      <span>Retro Sahifasiga O‘tish</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Transcript & Input Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11.5px] font-medium text-zinc-400">
                  <span>Sizning javobingiz (Ovoz yoki Matn):</span>
                  {transcript && (
                    <button
                      onClick={() => setTranscript('')}
                      className="text-zinc-500 hover:text-rose-400 transition flex items-center gap-1"
                    >
                      <RotateCcw size={11} /> Tozalash
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder={
                      isRecording
                        ? "Mikrofon tinglamoqda... Gapiring..."
                        : stage === 'morning_10'
                        ? 'Masalan: Bugun Redis kesh va gRPC xizmatini yozaman...'
                        : 'Masalan: Docker tarmoq xatosi bo‘yicha 3 soat ketdi, konfiguratsiyada xatolik bor edi...'
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/50 p-4 text-[13.5px] text-white placeholder:text-zinc-600 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition"
                  />
                  {isRecording && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-[11px] font-mono text-rose-400 animate-pulse">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Yozilmoqda
                    </div>
                  )}
                </div>
              </div>

              {/* Suggested speech templates */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Tezkor ovozli namunalar (1-bosish bilan sinash):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {stageConfig.examples.map((ex: string, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setTranscript(ex)}
                      className="rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-zinc-400 hover:border-white/15 hover:bg-white/[0.08] hover:text-zinc-200 transition text-left"
                    >
                      "{ex}"
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Actions: Microphone & AI Process */}
              <div className="mt-5 flex items-center justify-between pt-3 border-t border-white/[0.08]">
                {/* Record Button */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-[13px] font-bold transition shadow-lg ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30'
                      : 'bg-white/[0.08] text-white hover:bg-white/[0.15] border border-white/10'
                  }`}
                >
                  {isRecording ? <MicOff size={16} /> : <Mic size={16} className="text-rose-400" />}
                  <span>{isRecording ? "Yozishni to'xtatish" : "Mikrofon orqali gapirish"}</span>
                </button>

                {/* Submit / Process Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-xl px-4 py-2.5 text-[12.5px] font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition"
                  >
                    Bekor qilish
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing || !transcript.trim()}
                    onClick={handleSubmitStandup}
                    className={`flex items-center gap-2 rounded-2xl bg-gradient-to-r ${stageConfig.buttonGrad} px-6 py-2.5 text-[13px] font-bold text-white shadow-xl hover:brightness-110 disabled:opacity-40 transition`}
                  >
                    <Sparkles size={16} />
                    <span>
                      {isProcessing
                        ? 'AI Tahlil Qilmoqda...'
                        : stage === 'morning_10'
                        ? 'Joriy Fokusga Kiritish'
                        : 'Daily Log & Retroga Saqlash'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
