import { Contract, Signer, Provider, ContractTransactionResponse, keccak256, toUtf8Bytes } from "ethers";
import { ErrorDecoder } from "ethers-decode-error";
import { CREST_CORE_ABI } from "./abis/CrestCore.abi";
import { CREST_EVENTS_ABI } from "./abis/CrestEvents.abi";
import { IEAS_ABI } from "./abis/IEAS.abi";
import {
    Tier,
    RegisterEventParams,
    ClaimAttendanceParams,
    RevokeAttendanceParams,
    UpdatePasscodeParams,
    EventData,
    AttestationData,
    AttendeeData,
    RevocationData
} from "./types";

export class CrestClient {
    public readonly crestCore: Contract;
    public readonly crestEvents: Contract;
    public readonly eas: Contract;
    public readonly providerOrSigner: Provider | Signer;
    private readonly errorDecoder: ErrorDecoder;

    /**
     * Initialize the CrestClient.
     * @param coreAddress The address of the deployed CrestCore contract.
     * @param eventsAddress The address of the deployed CrestEvents contract.
     * @param easProxyAddress The address of the EAS proxy contract.
     * @param providerOrSigner An ethers Provider (for read-only) or Signer (for read/write).
     */
    constructor(
        coreAddress: string,
        eventsAddress: string,
        easProxyAddress: string,
        providerOrSigner: Provider | Signer
    ) {
        this.providerOrSigner = providerOrSigner;

        this.crestCore = new Contract(coreAddress, CREST_CORE_ABI, providerOrSigner);
        this.crestEvents = new Contract(eventsAddress, CREST_EVENTS_ABI, providerOrSigner);
        this.eas = new Contract(easProxyAddress, IEAS_ABI, providerOrSigner);

        this.errorDecoder = ErrorDecoder.create([CREST_CORE_ABI as any, CREST_EVENTS_ABI as any]);
    }

    private async handleError(promise: Promise<any>): Promise<any> {
        try {
            return await promise;
        } catch (err: any) {
            const eMsg = err.message || JSON.stringify(err);

            // Hard Fallbacks for 4-byte selectors (in case ethers-decode-error misses them)
            if (eMsg.includes("0xc1ab61a1") || eMsg.includes("CooldownActive")) throw new Error("Reputation system cooldown active. Please wait 1 hour between claims.");
            if (eMsg.includes("0x0f0c1bc8") || eMsg.includes("EventNotActive")) throw new Error("Event is not currently active.");
            if (eMsg.includes("0xec04def4") || eMsg.includes("AlreadyAttendedEvent")) throw new Error("You have already claimed attendance for this event.");
            if (eMsg.includes("0x76ca2c88") || eMsg.includes("NotEventOrganizer")) throw new Error("Only the organizer can perform this action.");
            if (eMsg.includes("0xc21b672c") || eMsg.includes("InvalidPasscode")) throw new Error("Incorrect passcode. Claim denied.");
            if (eMsg.includes("0xbd8ba84d") || eMsg.includes("InvalidAttestation")) throw new Error("Invalid or mismatched RAS attestation.");

            try {
                const decodedError = await this.errorDecoder.decode(err);
                if (decodedError.name) {
                    throw new Error(`${decodedError.name}`);
                }
            } catch (e) { /* ignore */ }
            throw err;
        }
    }

    // ==========================================
    // Read Methods (State)
    // ==========================================

    public async getNextEventId(): Promise<number> {
        const nextId = await this.crestEvents.nextEventId();
        return Number(nextId);
    }

    public async getEvent(eventId: number): Promise<EventData> {
        const evt = await this.crestEvents.events(eventId);
        return {
            startTime: Number(evt.startTime),
            endTime: Number(evt.endTime),
            organizer: evt.organizer,
            ipfsHash: evt.ipfsHash,
            passcodeHash: evt.passcodeHash
        };
    }

    public async isEventActive(eventId: number): Promise<boolean> {
        return this.crestEvents.isEventActive(eventId);
    }

    public async getUserTier(userAddress: string): Promise<Tier> {
        const tier = await this.crestCore.userTiers(userAddress);
        return Number(tier) as Tier;
    }

    public async getLastAttestationTime(userAddress: string): Promise<number> {
        const time = await this.crestCore.lastAttestationTime(userAddress);
        return Number(time);
    }

    public async getAttendanceCount(userAddress: string): Promise<number> {
        const count = await this.crestCore.attendanceCount(userAddress);
        return Number(count);
    }

    public async hasUserAttended(userAddress: string, eventId: number): Promise<boolean> {
        return this.crestCore.hasAttended(userAddress, eventId);
    }

    public async getCooldown(tier: Tier): Promise<number> {
        const cd = await this.crestCore.getCooldown(tier);
        return Number(cd);
    }

    // ==========================================
    // EAS & Verification Methods
    // ==========================================

    public async getAttestation(uid: string): Promise<AttestationData> {
        const att = await this.eas.getAttestation(uid);
        return {
            uid: String(att.uid),
            schema: String(att.schema),
            time: Number(att.time),
            expirationTime: Number(att.expirationTime),
            revocationTime: Number(att.revocationTime),
            refUID: String(att.refUID),
            recipient: String(att.recipient),
            attester: String(att.attester),
            revocable: Boolean(att.revocable),
            data: String(att.data)
        };
    }

    public async isAttestationValid(uid: string): Promise<boolean> {
        const att = await this.eas.getAttestation(uid);
        // An attestation is valid if it hasn't been revoked
        return Number(att.revocationTime) === 0;
    }

    // ==========================================
    // Advanced Query Methods (RPC Logs)
    // ==========================================

    public async getAllEvents(): Promise<Array<{ eventId: number } & EventData>> {
        const nextId = await this.getNextEventId();
        const events = [];
        for (let i = 1; i < nextId; i++) {
            events.push({ eventId: i, ...(await this.getEvent(i)) });
        }
        return events;
    }

    public async getEventsByOrganizer(organizer: string, fromBlock?: number | string, toBlock?: number | string): Promise<number[]> {
        const ids = await this.crestEvents.getEventsByOrganizer(organizer);
        return ids.map((id: any) => Number(id));
    }

    public async getEventsAttendedByUser(user: string, fromBlock?: number | string, toBlock?: number | string): Promise<number[]> {
        const ids = await this.crestCore.getEventsAttendedByUser(user);
        return ids.map((id: any) => Number(id));
    }

    public async getAttendeesForEvent(eventId: number, fromBlock?: number | string, toBlock?: number | string): Promise<AttendeeData[]> {
        const filter = this.crestCore.filters.AttendanceClaimed(null, eventId);
        const logs = await this.crestCore.queryFilter(filter, fromBlock || 0, toBlock || "latest");
        return logs.map(log => ({
            user: String((log as any).args[0]),
            tier: Number((log as any).args[2]) as Tier,
            attestationUid: String((log as any).args[3])
        }));
    }

    public async getRevocationsForEvent(eventId: number, fromBlock?: number | string, toBlock?: number | string): Promise<RevocationData[]> {
        const filter = this.crestCore.filters.AttendanceRevoked(null, eventId);
        const logs = await this.crestCore.queryFilter(filter, fromBlock || 0, toBlock || "latest");
        return logs.map(log => ({
            organizer: String((log as any).args[0]),
            attestationUid: String((log as any).args[2])
        }));
    }

    // ==========================================
    // Write Methods
    // ==========================================

    /**
     * Registers a new event.
     * Requires a Signer.
     */
    public async registerEvent(params: RegisterEventParams): Promise<ContractTransactionResponse> {
        if (!this._isSigner(this.providerOrSigner)) {
            throw new Error("A Signer is required to register an event.");
        }

        const hash = keccak256(toUtf8Bytes(params.passcode));

        return this.handleError(this.crestEvents.registerEvent(
            params.startTime,
            params.endTime,
            params.ipfsHash,
            hash
        ));
    }

    /**
     * Claims attendance for an event.
     * Requires a Signer.
     */
    public async claimAttendance(params: ClaimAttendanceParams): Promise<ContractTransactionResponse> {
        if (!this._isSigner(this.providerOrSigner)) {
            throw new Error("A Signer is required to claim attendance.");
        }
        return this.handleError(this.crestCore.claimAttendance(
            params.eventId,
            params.role,
            params.ipfsHash,
            params.passcode
        ));
    }

    /**
     * Revokes an attendance attestation.
     * Requires a Signer (must be the event organizer).
     */
    public async revokeAttendance(params: RevokeAttendanceParams): Promise<ContractTransactionResponse> {
        if (!this._isSigner(this.providerOrSigner)) {
            throw new Error("A Signer is required to revoke attendance.");
        }
        return this.handleError(this.crestCore.revokeAttendance(
            params.eventId,
            params.attestationUid
        ));
    }

    /**
     * Updates an event's passcode hash.
     * Requires a Signer (must be the event organizer).
     */
    public async updatePasscode(params: UpdatePasscodeParams): Promise<ContractTransactionResponse> {
        if (!this._isSigner(this.providerOrSigner)) {
            throw new Error("A Signer is required to update a passcode.");
        }

        const hash = keccak256(toUtf8Bytes(params.newPasscode));

        return this.handleError(this.crestEvents.updatePasscode(
            params.eventId,
            hash
        ));
    }

    // Helper type guard
    private _isSigner(p: Provider | Signer): p is Signer {
        return 'signMessage' in p;
    }
}
