import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./connection.ts";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { formatAddress } from "./utils/formatAddress.ts";
import { useCallback, useEffect, useState } from "react";
import { useCrestClient } from "./hooks/useCrestClient";
import { ReputationPanel } from "./components/ReputationPanel";
import { EventCard } from "./components/EventCard";
import { EventModal } from "./components/EventModal";

function App() {
  const { isConnected, address } = useAppKitAccount();
  const { open } = useAppKit();

  const crestClient = useCrestClient();
  const [tier, setTier] = useState<number>(0);
  const [attendanceCount, setAttendanceCount] = useState<number>(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [myEventIds, setMyEventIds] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'created'>('all');
  const [filterState, setFilterState] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [newPasscodeInput, setNewPasscodeInput] = useState("");
  const [nowTS, setNowTS] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setNowTS(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    if (!crestClient) return;
    setIsLoadingData(true);
    try {
      if (address) {
        const _tier = await crestClient.getUserTier(address);
        const _count = await crestClient.getAttendanceCount(address);
        setTier(_tier);
        setAttendanceCount(_count);

        const attended = await crestClient.getEventsAttendedByUser(address);
        setMyEventIds(attended);
      }

      const events = await crestClient.getAllEvents();
      events.sort((a: any, b: any) => b.eventId - a.eventId);
      setAllEvents(events);
    } catch (e: any) {
      console.warn("Could not fetch data:", e.message);
    } finally {
      setIsLoadingData(false);
    }
  }, [crestClient, address]);

  useEffect(() => {
    if (isConnected) fetchData();
  }, [isConnected, fetchData]);

  const handleRegisterEvent = async () => {
    if (!isConnected) return toast.error("Connect wallet first.");
    if (!crestClient) return toast.error("Client not initialized (check .env).");
    setIsRegistering(true);
    try {
      const startTime = Math.floor(Date.now() / 1000) + 120;
      const endTime = startTime + 3600;
      const tx = await crestClient.registerEvent({
        startTime, endTime, ipfsHash: "ipfs://QmTz...", passcode: "Crest2026"
      });
      toast.info("Transaction submitted...");
      await tx.wait();
      toast.success("Event registered!");
      fetchData();
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleClaimModalSubmit = async () => {
    if (!selectedEvent || !passcodeInput) return toast.error("Enter a passcode.");
    if (!crestClient) return toast.error("Client not initialized (check .env).");
    setIsClaiming(true);
    try {
      const tx = await crestClient.claimAttendance({
        eventId: selectedEvent.eventId, role: 0, ipfsHash: "ipfs://...", passcode: passcodeInput
      });
      toast.info("Transaction submitted...");
      await tx.wait();
      toast.success("Attendance claimed!");
      fetchData();
      setSelectedEvent(null);
      setPasscodeInput("");
    } catch (error: any) {
      toast.error(`Claim Failed: ${error.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleEditPasscodeSubmit = async () => {
    if (!selectedEvent || !newPasscodeInput) return toast.error("Enter new passcode.");
    if (!crestClient) return toast.error("Client not initialized (check .env).");
    setIsClaiming(true);
    try {
      const tx = await crestClient.updatePasscode({
        eventId: selectedEvent.eventId, newPasscode: newPasscodeInput
      });
      toast.info("Updating passcode...");
      await tx.wait();
      toast.success("Passcode updated!");
      setSelectedEvent(null);
      setNewPasscodeInput("");
    } catch (error: any) {
      toast.error(`Update Failed: ${error.message}`);
    } finally {
      setIsClaiming(false);
    }
  };

  const filteredEvents = allEvents.filter(ev => {
    const isMyEvent = myEventIds.includes(ev.eventId);
    const isCreated = address && ev.organizer.toLowerCase() === address.toLowerCase();

    if (activeTab === 'my' && !isMyEvent) return false;
    if (activeTab === 'created' && !isCreated) return false;

    const isActive = nowTS >= ev.startTime + 30 && nowTS <= ev.endTime;
    if (filterState === 'active' && !isActive) return false;
    if (filterState === 'inactive' && isActive) return false;

    return true;
  });

  return (
    <div className="min-h-screen bg-rootstock-dark text-rootstock-light flex flex-col items-center py-12 px-4 selection:bg-rootstock-orange selection:text-black font-sans relative">
      <div className="max-w-4xl w-full">
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

        <ReputationPanel
          isConnected={isConnected}
          tier={tier}
          attendanceCount={attendanceCount}
          eventsLength={address ? allEvents.filter(ev => ev.organizer.toLowerCase() === address.toLowerCase()).length : 0}
          isLoading={isLoadingData}
        />

        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 relative z-10">
            <div className="flex bg-black/50 p-1 rounded-full border border-gray-800/50">
              {['all', 'my', 'created'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`relative px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab
                    ? "bg-rootstock-orange text-black shadow-[0_0_10px_rgba(255,145,0,0.3)]"
                    : "text-gray-500 hover:text-white"
                    }`}
                >
                  {tab === 'all' ? 'All Events' : tab === 'my' ? 'My Events' : 'Created'}
                  {address && activeTab === tab && filteredEvents.length > 0 && (
                    <span className="absolute top-0 left-full -translate-x-[14px] -translate-y-[6px] flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-black text-rootstock-orange rounded-full text-[10px] font-black leading-none shadow-md border border-gray-800 z-10">
                      {filteredEvents.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={filterState}
                onChange={(e) => setFilterState(e.target.value as any)}
                className="bg-black border border-gray-800 rounded-xl text-xs uppercase tracking-widest font-semibold text-gray-400 px-3 py-2.5 focus:outline-none focus:border-rootstock-orange transition-colors cursor-pointer"
              >
                <option value="all">Status: ALL</option>
                <option value="active">Status: ACTIVE</option>
                <option value="inactive">Status: INACTIVE</option>
              </select>

              <button
                onClick={handleRegisterEvent}
                disabled={!isConnected || isRegistering}
                className="py-2.5 px-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 border border-rootstock-orange/40 text-rootstock-orange hover:bg-rootstock-orange/10 disabled:opacity-30 disabled:cursor-not-allowed hover:border-rootstock-orange flex items-center justify-center gap-2"
                title="Create a Dummy Event"
              >
                {isRegistering ? (
                  <svg className="animate-spin h-4 w-4 text-rootstock-orange" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : "+ DUMMY"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            {!isConnected ? (
              <div className="col-span-1 md:col-span-2 py-16 flex flex-col justify-center items-center">
                <div className="w-16 h-16 rounded-full bg-black border border-gray-800 flex items-center justify-center mb-4 shadow-xl">
                  <span className="text-2xl opacity-50">🔗</span>
                </div>
                <p className="text-center text-gray-500 uppercase tracking-widest font-bold text-sm">Connect wallet to view events</p>
              </div>
            ) : isLoadingData ? (
              <div className="col-span-1 md:col-span-2 py-16 flex flex-col justify-center items-center gap-4">
                <svg className="animate-spin h-8 w-8 text-rootstock-orange/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span className="text-gray-500 uppercase tracking-widest font-bold text-xs animate-pulse">Synchronizing Logs...</span>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="col-span-1 md:col-span-2 py-12 text-center text-gray-600 text-sm font-semibold uppercase tracking-widest">
                No events found matching criteria.
              </div>
            ) : (
              filteredEvents.map(ev => {
                const isActive = nowTS >= ev.startTime + 30 && nowTS <= ev.endTime;
                const isMyEvent = myEventIds.includes(ev.eventId);
                return (
                  <EventCard
                    key={ev.eventId}
                    ev={ev}
                    isActive={isActive}
                    isMyEvent={isMyEvent}
                    nowTS={nowTS}
                    onClick={() => { setSelectedEvent(ev); setPasscodeInput(""); setNewPasscodeInput(""); }}
                  />
                );
              })
            )}
          </div>
        </div>

        <footer className="mt-16 text-center text-xs font-semibold text-gray-600 uppercase tracking-widest">
          Powered by the Rootstock Attestation Service
        </footer>
      </div>

      {selectedEvent && (
        <EventModal
          selectedEvent={selectedEvent}
          isConnected={isConnected}
          address={address}
          myEventIds={myEventIds}
          nowTS={nowTS}
          isClaiming={isClaiming}
          passcodeInput={passcodeInput}
          newPasscodeInput={newPasscodeInput}
          setPasscodeInput={setPasscodeInput}
          setNewPasscodeInput={setNewPasscodeInput}
          handleClaimModalSubmit={handleClaimModalSubmit}
          handleEditPasscodeSubmit={handleEditPasscodeSubmit}
          setSelectedEvent={setSelectedEvent}
        />
      )}

      <ToastContainer
        theme="dark"
        toastStyle={{
          backgroundColor: "#1D1D1B", color: "#F5F5F5", border: "1px solid #333", borderRadius: "12px", fontFamily: "inherit"
        }}
      />
    </div>
  );
}

export default App;
