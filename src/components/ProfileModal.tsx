import { useState } from 'react';
import { X, Check, Mail, Briefcase, Shield, Code2 } from 'lucide-react';
import { useSynapse } from '../lib/store';

const AVATAR_COLORS = [
  { id: '#0284c7', label: 'Sky' },
  { id: '#06b6d4', label: 'Cyan' },
  { id: '#10b981', label: 'Emerald' },
  { id: '#8b5cf6', label: 'Violet' },
  { id: '#d946ef', label: 'Fuchsia' },
  { id: '#f59e0b', label: 'Amber' },
  { id: '#f43f5e', label: 'Rose' },
  { id: '#6366f1', label: 'Indigo' },
];

export default function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <ProfileDialog onClose={onClose} />;
}

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { userProfile, updateProfile, tasks, prompts } = useSynapse();

  const [fullName, setFullName] = useState(userProfile.full_name);
  const [username, setUsername] = useState(userProfile.username);
  const [title, setTitle] = useState(userProfile.title);
  const [email, setEmail] = useState(userProfile.email);
  const [github, setGithub] = useState(userProfile.github);
  const [avatarColor, setAvatarColor] = useState(userProfile.avatar_color);
  const [bio, setBio] = useState(userProfile.bio);
  const [role, setRole] = useState(userProfile.role);
  const [saving, setSaving] = useState(false);

  const initials = fullName.trim()
    ? fullName.trim().split(/\s+/).map((p) => p[0]?.toUpperCase()).slice(0, 2).join('')
    : 'U';

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const activeCount = tasks.filter((t) => t.status === 'active' || t.status === 'in_review').length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim() || 'Muhandis',
        username: username.trim() || 'user',
        title: title.trim() || 'Software Engineer',
        email: email.trim(),
        github: github.trim(),
        avatar_color: avatarColor,
        avatar_initials: initials,
        bio: bio.trim(),
        role: role.trim() || 'Muhandis',
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-sky-500/20 bg-[#121319] shadow-2xl shadow-sky-500/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />

        {/* Modal Header */}
        <div className="relative flex items-center justify-between border-b border-white/[0.08] px-6 py-4.5 bg-white/[0.02]">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-[15px] font-bold text-white shadow-lg ring-2 ring-white/10 transition-colors"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-white">{fullName || 'Foydalanuvchi Profili'}</h2>
                <span className="rounded-full border border-sky-400/30 bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-300">
                  Lokal Baza
                </span>
              </div>
              <p className="text-[12px] text-zinc-400">
                @{username || 'farhodoff'} · {title || 'Software Engineer'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Statistika Kartochkalari */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
              <span className="block text-[11px] font-medium text-zinc-500">Jami Vazifalar</span>
              <span className="mt-1 block font-mono text-[18px] font-bold text-white">{tasks.length}</span>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-center">
              <span className="block text-[11px] font-medium text-emerald-400">Bajarilgan</span>
              <span className="mt-1 block font-mono text-[18px] font-bold text-emerald-300">{completedCount}</span>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 text-center">
              <span className="block text-[11px] font-medium text-sky-400">Jarayonda</span>
              <span className="mt-1 block font-mono text-[18px] font-bold text-sky-300">{activeCount}</span>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-3 text-center">
              <span className="block text-[11px] font-medium text-violet-400">AI Promptlar</span>
              <span className="mt-1 block font-mono text-[18px] font-bold text-violet-300">{prompts.length}</span>
            </div>
          </div>

          {/* Avatar rangini tanlash */}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Avatar Rangi
            </label>
            <div className="flex items-center gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setAvatarColor(c.id)}
                  style={{ backgroundColor: c.id }}
                  className={`h-7 w-7 rounded-xl transition-transform flex items-center justify-center text-white ${
                    avatarColor === c.id ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#121319]' : 'opacity-80 hover:opacity-100'
                  }`}
                  title={c.label}
                >
                  {avatarColor === c.id && <Check size={13} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Asosiy ma'lumotlar inputlari */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold text-zinc-300">
                To'liq Ism (Full Name)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ismingizni kiriting"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold text-zinc-300">
                Foydalanuvchi Nomi (Username)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-zinc-500 font-mono text-[13px]">@</span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full rounded-xl border border-white/10 bg-black/40 pl-7 pr-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-300">
                <Briefcase size={13} className="text-zinc-400" />
                <span>Mutaxassislik / Lavozim</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masalan: Senior Full-Stack Engineer"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-300">
                <Shield size={13} className="text-zinc-400" />
                <span>Rol (Role)</span>
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Muhandis / Admin / Tech Lead"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-300">
                <Mail size={13} className="text-zinc-400" />
                <span>Email Manzili</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="muhandis@cognidev.local"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-300">
                <Code2 size={13} className="text-zinc-400" />
                <span>GitHub Profil</span>
              </label>
              <input
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="Farhodoff"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none"
              />
            </div>
          </div>

          {/* Bio / Muhandislik maqsadi */}
          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold text-zinc-300">
              Muhandislik Qaydlari & Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ish uslubingiz, maqsadlaringiz va qiziqishlaringiz haqida qisqacha ma'lumot..."
              className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:border-sky-400/60 focus:outline-none resize-none"
            />
          </div>

          {/* Pastki tugmalar */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
            <span className="font-mono text-[11px] text-zinc-500">
              synapse.db bazasida xavfsiz saqlanadi
            </span>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-zinc-300 hover:bg-white/10 transition"
              >
                Bekor qilish
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2 text-[12.5px] font-semibold text-white shadow-lg hover:brightness-110 transition disabled:opacity-50"
              >
                <Check size={14} />
                <span>{saving ? 'Saqlanmoqda…' : 'Saqlash'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
