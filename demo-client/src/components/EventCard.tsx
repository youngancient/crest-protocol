import { formatAddress } from '../utils/formatAddress';
import { renderCountdown } from '../utils/time';

interface EventCardProps {
    ev: any;
    isActive: boolean;
    isMyEvent: boolean;
    nowTS: number;
    onClick: () => void;
}

export function EventCard({ ev, isActive, isMyEvent, onClick, nowTS }: EventCardProps) {
    return (
        <div
            onClick={onClick}
            className="group bg-gray-900/40 border border-gray-800/50 hover:border-rootstock-orange/50 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_4px_20px_rgba(255,145,0,0.1)] hover:-translate-y-1 relative overflow-hidden"
        >
            {isMyEvent && (
                <div className="absolute top-0 right-0 w-16 h-16 bg-rootstock-orange/20 rounded-bl-full pointer-events-none flex items-start justify-end pt-2 pr-2">
                    <svg className="w-4 h-4 text-rootstock-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
            )}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-rootstock-orange font-mono font-bold">#{ev.eventId}</span>
                    <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest ${isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-800 text-gray-500'}`}>
                        {isActive ? 'Active' : nowTS < ev.startTime ? 'Upcoming' : 'Ended'}
                    </div>
                </div>
                <span className="text-xs text-gray-500 font-mono bg-black/50 px-2 py-1 rounded">
                    {formatAddress(ev.organizer)}
                </span>
            </div>
            <div className="text-sm text-gray-300 font-medium mb-2 truncate">
                Hash: {ev.ipfsHash}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1.5 mt-4">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {renderCountdown(nowTS, ev.startTime, ev.endTime)}
            </div>
        </div>
    );
}
