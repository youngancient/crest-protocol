import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./connection.ts";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { formatAddress } from "./utils.ts";
import { useCallback, useEffect, useState } from "react";
import { useCrestClient } from "./hooks/useCrestClient";

function App() {
  const { isConnected, address } = useAppKitAccount();
  const { open } = useAppKit();

  const crestClient = useCrestClient();
  const [tier, setTier] = useState<number>(0);
  const [attendanceCount, setAttendanceCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [eventsLength, setEventsLength] = useState<number>(0);

  const fetchData = useCallback(async () => {
    try {
      if (address) {
        const _tier = await crestClient.getUserTier(address);
        const _count = await crestClient.getAttendanceCount(address);
        setTier(_tier);
        setAttendanceCount(_count);
      }
      const count = await crestClient.getNextEventId();
      setEventsLength(count > 0 ? count - 1 : 0);
    } catch (e: any) {
      console.warn("Could not fetch data. Are the VITE_ contract addresses correct in .env?", e.message);
    }
  }, [crestClient, address]);

  useEffect(() => {
    if (isConnected) fetchData();
  }, [isConnected, fetchData]);

  const handleRegisterEvent = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first.");
      return;
    }
    setIsProcessing(true);
    try {
      const startTime = Math.floor(Date.now() / 1000) + 60; // Starts in 1 minute
      const endTime = startTime + 3600; // Lasts 1 hour
      const tx = await crestClient.registerEvent({
        startTime,
        endTime,
        ipfsHash: "ipfs://QmTz...",
        passcode: "Crest2026"
      });
      toast.info("Transaction submitted...");
      await tx.wait();
      toast.success("Event registered! Passcode is 'Crest2026'");
      fetchData();
    } catch (error: any) {
      toast.error(`Registration Failed. Details: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClaimAttendance = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first.");
      return;
    }
    setIsProcessing(true);
    try {
      const tx = await crestClient.claimAttendance({
        eventId: 1, // Testing exact event #1
        role: 0,
        ipfsHash: "ipfs://...",
        passcode: "Crest2026"
      });
      toast.info("Transaction submitted...");
      await tx.wait();
      toast.success("Attendance claimed successfully! Your Tier will organically upgrade.");
      fetchData();
    } catch (error: any) {
      toast.error(`Claim Failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-rootstock-dark text-rootstock-light flex flex-col items-center py-12 px-4 selection:bg-rootstock-orange selection:text-black font-sans">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <header className="flex flex-col sm:flex-row justify-between items-center mb-12 py-4">
          <div className="flex items-center gap-4 mb-6 sm:mb-0 pointer-events-none">
            <img src="/rootstock.png" className="w-12 h-12 object-contain filter drop-shadow-[0_0_8px_rgba(255,145,0,0.5)]" alt="Rootstock Logo" />
            <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">Crest<span className="text-rootstock-orange ml-1">Protocol</span></h1>
          </div>

          <button
            onClick={() => open()}
            className="px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-xs transition-all duration-300 bg-rootstock-orange text-black hover:bg-white hover:shadow-[0_0_15px_rgba(255,145,0,0.4)] active:scale-95 border border-transparent"
          >
            {isConnected ? formatAddress(address ?? "") : "Connect Wallet"}
          </button>
        </header>

        {/* Main Dashboard Widget */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

          {/* Reputation Stats Panel */}
          <div className="md:col-span-3 bg-black/60 border border-gray-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rootstock-orange animate-pulse"></span>
                Your Reputation Profile
              </h2>
            </div>

            {isConnected ? (
              <div className="space-y-4">
                <div className="group flex justify-between items-center p-4 bg-gray-900/60 hover:bg-gray-800/80 rounded-xl border border-gray-800/50 transition-colors duration-300">
                  <span className="text-xs uppercase font-semibold tracking-widest text-gray-500 group-hover:text-gray-400">Current Tier</span>
                  <span className="text-xl font-black text-white tracking-widest bg-clip-text">
                    {tier === 0 ? "DORMANT (0)" : tier === 1 ? "ACTIVE (1)" : "ASCENDED (2)"}
                  </span>
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
              <div className="h-full min-h-[220px] flex flex-col justify-center items-center py-8">
                <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mb-4">
                  <span className="text-2xl opacity-50">🔒</span>
                </div>
                <p className="text-center text-sm text-gray-500 max-w-[250px]">Connect your Rootstock wallet to instantly view your decentralized identity profile.</p>
              </div>
            )}
          </div>

          {/* Action Panel */}
          <div className="md:col-span-2 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 shadow-2xl flex flex-col justify-center relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-rootstock-orange/10 rounded-full blur-3xl pointer-events-none"></div>

            <h2 className="text-lg font-bold mb-6 text-white uppercase tracking-widest text-center">Actions</h2>

            <div className="flex flex-col gap-5 relative z-10 align-middle justify-center h-full">
              <button
                onClick={handleRegisterEvent}
                disabled={!isConnected || isProcessing}
                className="w-full py-4 px-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 border border-rootstock-orange/40 text-rootstock-orange hover:bg-rootstock-orange/10 disabled:opacity-30 disabled:cursor-not-allowed hover:border-rootstock-orange"
              >
                {isProcessing ? "Processing..." : "Register Dummy"}
              </button>

              <button
                onClick={handleClaimAttendance}
                disabled={!isConnected || isProcessing}
                className="w-full py-4 px-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 bg-rootstock-orange text-black hover:bg-[#ff9d20] hover:shadow-[0_4px_20px_rgba(255,145,0,0.3)] active:scale-[0.98] transform disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Processing..." : "Claim Attendance"}
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-xs font-semibold text-gray-600 uppercase tracking-widest">
          Powered by the Rootstock Attestation Service
        </footer>
      </div>

      {/* Toast popup styling override */}
      <ToastContainer
        theme="dark"
        toastStyle={{
          backgroundColor: "#1D1D1B",
          color: "#F5F5F5",
          border: "1px solid #333",
          borderRadius: "12px",
          fontFamily: "inherit"
        }}
      />
    </div>
  );
}

export default App;
