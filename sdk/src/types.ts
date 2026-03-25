export enum Tier {
    Dormant = 0,
    Active = 1,
    Ascended = 2
}

export interface RegisterEventParams {
    startTime: number;
    endTime: number;
    ipfsHash: string;
    passcode: string;
}

export interface ClaimAttendanceParams {
    eventId: number;
    role: number;
    ipfsHash: string;
    passcode: string;
}

export interface RevokeAttendanceParams {
    eventId: number;
    attestationUid: string; // bytes32
}

export interface UpdatePasscodeParams {
    eventId: number;
    newPasscode: string;
}

export interface EventData {
    startTime: number;
    endTime: number;
    organizer: string;
    ipfsHash: string;
    passcodeHash: string;
}

export interface AttestationData {
    uid: string;
    schema: string;
    time: number;
    expirationTime: number;
    revocationTime: number;
    refUID: string;
    recipient: string;
    attester: string;
    revocable: boolean;
    data: string;
}

export interface AttendeeData {
    user: string;
    attestationUid: string;
    tier: Tier;
}

export interface RevocationData {
    organizer: string;
    attestationUid: string;
}
