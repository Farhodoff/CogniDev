import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useSynapse } from '../lib/store';

export default function FloatingHud() {
  const { hudMessage, setHud } = useSynapse();

  if (!hudMessage) return null;

  return <Toast message={hudMessage} onClose={() => setHud(null)} />;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3400);
    return () => clearTimeout(t);
  }, [message, onClose]);

  return (
    <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 pointer-events-auto">
      <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#14151b]/95 px-4 py-2.5 text-[12.5px] text-zinc-100 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
        <span className="font-medium">{message}</span>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-white transition p-0.5 rounded"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
