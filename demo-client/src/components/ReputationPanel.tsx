interface ReputationPanelProps {
    isConnected: boolean;
    tier: number;
    attendanceCount: number;
    eventsLength: number;
}

export function ReputationPanel({ isConnected, tier, attendanceCount, eventsLength }: ReputationPanelProps) {
    return (
        <div className="bg-black/60 border border-gray-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md mb-8">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rootstock-orange animate-pulse"></span>
                    Your Reputation Profile
                </h2>
            </div>

            {isConnected ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="group flex justify-between items-center p-4 bg-gray-900/60 hover:bg-gray-800/80 rounded-xl border border-gray-800/50 transition-colors duration-300">
                        <span className="text-xs uppercase font-semibold tracking-widest text-gray-500 group-hover:text-gray-400">Current Tier</span>
                        <div className="flex items-center gap-3">
                            {tier === 0 ? (
                                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                            ) : tier === 1 ? (
                                <svg className="w-6 h-6 text-rootstock-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            ) : (
                                <svg className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                            )}
                            <span className="text-xl font-black text-white tracking-widest bg-clip-text">
                                {tier === 0 ? "DORMANT" : tier === 1 ? "ACTIVE" : "ASCENDED"}
                            </span>
                        </div>
                    </div>

                    <div className="group flex justify-between items-center p-4 bg-gray-900/60 hover:bg-gray-800/80 rounded-xl border border-gray-800/50 transition-colors duration-300">
                        <span className="text-xs uppercase font-semibold tracking-widest text-gray-500 group-hover:text-gray-400">Attendance Streak</span>
                        <span className="text-xl font-black text-rootstock-orange px-2 py-0.5 rounded bg-rootstock-orange/10 font-mono">
                            {attendanceCount}
                        </span>
                    </div>

                    <div className="group flex justify-between items-center p-4 bg-gray-900/60 hover:bg-gray-800/80 rounded-xl border border-gray-800/50 transition-colors duration-300">
                        <span className="text-xs uppercase font-semibold tracking-widest text-gray-500 group-hover:text-gray-400">Total Events Hosted</span>
                        <span className="text-lg font-bold text-gray-300">{eventsLength}</span>
                    </div>
                </div>
            ) : (
                <div className="min-h-[120px] flex flex-col justify-center items-center py-4">
                    <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center mb-4">
                        <span className="text-xl opacity-50">🔒</span>
                    </div>
                    <p className="text-center text-sm text-gray-500 max-w-[250px]">Connect wallet to view profile.</p>
                </div>
            )}
        </div>
    );
}
