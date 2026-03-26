import { formatAddress } from '../utils/formatAddress';
import { renderCountdown } from '../utils/time';

interface EventModalProps {
    selectedEvent: any;
    isConnected: boolean;
    address?: string;
    myEventIds: number[];
    nowTS: number;
    isClaiming: boolean;
    passcodeInput: string;
    newPasscodeInput: string;
    setPasscodeInput: (val: string) => void;
    setNewPasscodeInput: (val: string) => void;
    handleClaimModalSubmit: () => void;
    handleEditPasscodeSubmit: () => void;
    setSelectedEvent: (evt: any | null) => void;
}

export function EventModal({
    selectedEvent, isConnected, address, myEventIds, nowTS, isClaiming, passcodeInput, newPasscodeInput, setPasscodeInput, setNewPasscodeInput,
    handleClaimModalSubmit, handleEditPasscodeSubmit, setSelectedEvent
}: EventModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={() => setSelectedEvent(null)}></div>
            <div className="bg-gray-900 border border-gray-700/50 rounded-3xl w-full max-w-md p-8 relative z-10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-rootstock-orange/20 rounded-full blur-[80px] pointer-events-none"></div>

                <button className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors" onClick={() => setSelectedEvent(null)}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="mb-6">
                    <h3 className="text-2xl font-black text-white tracking-tight mb-2 flex items-center gap-2">
                        Event <span className="text-rootstock-orange">#{selectedEvent.eventId}</span>
                    </h3>
                    <p className="text-xs text-gray-400 font-mono tracking-widest uppercase">Organizer: {formatAddress(selectedEvent.organizer)}</p>
                </div>

                <div className="bg-black/40 rounded-xl p-4 border border-gray-800/50 mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs uppercase font-bold tracking-widest text-gray-500">Status</span>
                        {nowTS >= selectedEvent.startTime && nowTS <= selectedEvent.endTime ? (
                            <span className="text-xs uppercase font-black tracking-widest text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Active</span>
                        ) : (
                            <span className="text-xs uppercase font-black tracking-widest text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Inactive</span>
                        )}
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs uppercase font-bold tracking-widest text-gray-500">Timer</span>
                        <span className="text-sm font-black tracking-widest text-white">{renderCountdown(nowTS, selectedEvent.startTime, selectedEvent.endTime)}</span>
                    </div>
                </div>

                {address && selectedEvent.organizer.toLowerCase() === address.toLowerCase() && (
                    <div className="mb-6">
                        <label className="block text-xs uppercase font-bold tracking-widest text-gray-500 mb-2">Organizer: Update Passcode</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="New Passcode"
                                value={newPasscodeInput}
                                onChange={(e) => setNewPasscodeInput(e.target.value)}
                                className="flex-1 bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rootstock-orange transition-colors"
                            />
                            <button
                                onClick={handleEditPasscodeSubmit}
                                disabled={isClaiming || !newPasscodeInput}
                                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
                            >
                                Update
                            </button>
                        </div>
                    </div>
                )}

                {!myEventIds.includes(selectedEvent.eventId) ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs uppercase font-bold tracking-widest text-gray-500 mb-2">Claim Attendance</label>
                            <input
                                type="text"
                                placeholder="Enter Passcode..."
                                value={passcodeInput}
                                onChange={(e) => setPasscodeInput(e.target.value)}
                                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rootstock-orange transition-colors"
                            />
                        </div>
                        <button
                            onClick={handleClaimModalSubmit}
                            disabled={!isConnected || isClaiming || nowTS < selectedEvent.startTime || nowTS > selectedEvent.endTime}
                            className="w-full py-4 px-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 bg-rootstock-orange text-black hover:bg-[#ff9d20] hover:shadow-[0_4px_20px_rgba(255,145,0,0.3)] active:scale-[0.98] transform disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        >
                            {isClaiming && <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                            {isClaiming ? "Mining Tx..." : "Sign & Claim"}
                        </button>
                    </div>
                ) : (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                        <p className="text-green-400 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            Attendance Claimed
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
