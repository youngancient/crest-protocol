import { useMemo } from "react";
import useRunners from "./useRunners";
import { CrestClient } from "crest-protocol-sdk";

export const useCrestClient = () => {
    const { readOnlyProvider, signer } = useRunners();

    return useMemo(() => {
        // If testing without .env setup, it gracefully reverts instead of crashing the UI
        const coreAddress = import.meta.env.VITE_CREST_CORE_ADDRESS || "0x0000000000000000000000000000000000000000";
        const eventsAddress = import.meta.env.VITE_CREST_EVENTS_ADDRESS || "0x0000000000000000000000000000000000000000";
        const easAddress = import.meta.env.VITE_EAS_ADDRESS || "0x0000000000000000000000000000000000000000";

        if (signer) {
            return new CrestClient(coreAddress, eventsAddress, easAddress, signer as any);
        }
        return new CrestClient(coreAddress, eventsAddress, easAddress, readOnlyProvider as any);
    }, [readOnlyProvider, signer]);
};
