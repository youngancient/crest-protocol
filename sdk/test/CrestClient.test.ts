import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrestClient } from '../src/CrestClient';
import { JsonRpcProvider } from 'ethers';

describe('CrestClient', () => {
    let client: CrestClient;
    let provider: JsonRpcProvider;

    beforeEach(() => {
        provider = new JsonRpcProvider('http://localhost:8545');
        client = new CrestClient(
            '0x1234567890123456789012345678901234567890',
            '0x2345678901234567890123456789012345678901',
            '0x3456789012345678901234567890123456789012',
            provider
        );
    });

    it('should initialize contracts correctly', () => {
        expect(client.crestCore).toBeDefined();
        expect(client.crestEvents).toBeDefined();
        expect(client.eas).toBeDefined();
    });

    it('should format getAttestation correctly', async () => {
        (client.eas.getAttestation as any) = vi.fn().mockResolvedValue({
            uid: '0xabc', schema: '0xdef', time: 100n, expirationTime: 0n,
            revocationTime: 0n, refUID: '0x000', recipient: '0x123',
            attester: '0x456', revocable: true, data: '0x'
        });

        const att = await client.getAttestation('0xabc');
        expect(att.uid).toBe('0xabc');
        expect(att.time).toBe(100);
        expect(att.revocationTime).toBe(0);
        expect(att.schema).toBe('0xdef');
    });

    it('should check isAttestationValid correctly', async () => {
        (client.eas.getAttestation as any) = vi.fn().mockResolvedValue({ revocationTime: 0n });
        expect(await client.isAttestationValid('0xabc')).toBe(true);

        (client.eas.getAttestation as any) = vi.fn().mockResolvedValue({ revocationTime: 12345n });
        expect(await client.isAttestationValid('0xdef')).toBe(false);
    });

    it('should format attendees log correctly', async () => {
        (client.crestCore.queryFilter as any) = vi.fn().mockResolvedValue([
            { args: ['0xuser1', 1n, 2n, '0xuid1'] },
            { args: ['0xuser2', 1n, 0n, '0xuid2'] }
        ]);

        const attendees = await client.getAttendeesForEvent(1);
        expect(attendees.length).toBe(2);
        expect(attendees[0].user).toBe('0xuser1');
        expect(attendees[0].tier).toBe(2);
        expect(attendees[0].attestationUid).toBe('0xuid1');
    });

    it('should decode and throw clean custom errors', async () => {
        (client.crestCore.claimAttendance as any) = vi.fn().mockRejectedValue(new Error("Raw Ethers Revert hex data"));

        // Mock the internal decoder behavior to prove the interceptor works
        (client as any).errorDecoder.decode = vi.fn().mockResolvedValue({ name: 'AlreadyAttended' });
        (client as any)._isSigner = vi.fn().mockReturnValue(true);

        await expect(
            client.claimAttendance({ eventId: 1, role: 0, ipfsHash: '', passcode: '' })
        ).rejects.toThrow('AlreadyAttended');
    });
});
