import { useMemo } from "react";
import useRunners from "./useRunners";
import { CrestClient } from "crest-protocol-sdk";
import { toast } from "react-toastify";

export const useCrestClient = () => {
    const { readOnlyProvider, signer } = useRunners();

    return useMemo(() => {
        const coreAddress = import.meta.env.VITE_CREST_CORE_ADDRESS?.toLowerCase();
        const eventsAddress = import.meta.env.VITE_CREST_EVENTS_ADDRESS?.toLowerCase();
        const easAddress = import.meta.env.VITE_EAS_ADDRESS?.toLowerCase();

        if (!coreAddress || !eventsAddress || !easAddress) {
            toast.error("Missing environment variables for CrestClient");
            return null;
        }

        if (signer) {
            return new CrestClient(coreAddress, eventsAddress, easAddress, signer as any);
        }
        return new CrestClient(coreAddress, eventsAddress, easAddress, readOnlyProvider as any);
    }, [readOnlyProvider, signer]);
};
