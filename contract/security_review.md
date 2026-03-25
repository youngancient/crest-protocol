---
title: Security Review of Crest Protocols
---

## Summary of Findings

I have reviewed the `CrestEvents.sol` and `CrestCore.sol` contracts. Overall, the logic is well thought out, but there are a few severe security flaws and logic gaps that need to be addressed before moving to an auditing phase or mainnet deployment.

### 1. [CRITICAL] Cross-Event Attestation Revocation Vulnerability (CrestCore.sol)

**Vulnerability:**
In `CrestCore.sol`, the `revokeAttendance(uint256 eventId, bytes32 attestationUid)` function has a fatal flaw in its access control. It only checks if `msg.sender` is the organizer of the provided `eventId`. It does **not** verify that the `attestationUid` provided actually relates to the `eventId`.

```solidity
    function revokeAttendance(uint256 eventId, bytes32 attestationUid) external {
        (,, address organizer,) = crestEvents.events(eventId);
        if (msg.sender != organizer) {
            revert NotEventOrganizer(); // Only checks msg.sender == organizer of passed eventId
        }

        // NO CHECK that attestationUid belongs to eventId!

        RevocationRequestData memory requestData = RevocationRequestData({
            uid: attestationUid,
            value: 0
        });

        // ...
        eas.revoke(request);
    }
```

Because `CrestCore` acts as the single "attester" on EAS for all events, `eas.revoke` will succeed if called by `CrestCore`. This means **any organizer who has created an event can revoke ANY attestation in the entire protocol** (including those from other organizers) by simply passing their own `eventId` to bypass the access check, and the victim's `attestationUid`.

**Fix:**
Store a mapping of attestations to the event they were issued for when claiming attendance.

```solidity
    mapping(bytes32 => uint256) public attestationToEvent;

    // In claimAttendance:
    bytes32 uid = eas.attest(request);
    attestationToEvent[uid] = eventId;
```

```solidity
    // In revokeAttendance:
    if (attestationToEvent[attestationUid] != eventId) {
        revert("Attestation does not belong to this event");
    }
```

---

### 2. [HIGH] Permissionless Attendance Claiming (Sybil / Botting Risk)

**Vulnerability:**
The `claimAttendance(uint256 eventId, uint8 role, string calldata ipfsHash)` function does not verify if the user (`msg.sender`) actually attended the event or if they were authorized by the event organizer. Any user or bot can simply listen to `EventRegistered` events, wait until `block.timestamp` reaches the active window, and call `claimAttendance` to farm tiers. The provided `ipfsHash` is never validated.

This renders the state machine (Tier progression from Dormant -> Active -> Ascended) effectively meaningless from a reputation standpoint, as it can be perfectly gamed by creating multiple events and claiming them on a timer.

**Fix:**
Implement verification that the attendee was authorized. Two common ways:
1. **EIP-712 Signatures:** Organizers provide an off-chain signature `hash(eventId, userAddress)`, and users submit this signature when claiming attendance.
2. **Merkle Trees:** Organizers publish a Merkle Root of all attendees after the event, and users claim their attendance post-event by providing a Merkle Proof.

---

### 3. [MEDIUM] Revoked Attendance Does Not Revert State Machine Progress

**Vulnerability:**
When an organizer revokes a user's attendance using `revokeAttendance`, the EAS attestation is removed, but the user's internal protocol reputation (`userTiers`, `attendanceCount`, and `hasAttended`) is **not** decremented or reverted.

If a malicious attendee spams claims to reach `Tier.Ascended` (10 attendances), and an organizer catches them and revokes their attestation, the user remains `Tier.Ascended` and their `attendanceCount` is still 10. Also, since `hasAttended[user][eventId]` remains `true`, they cannot re-claim the event legitimately if they were mistakenly revoked.

**Fix:**
Consider adding logic to handle the consequences of a revocation:
- Decrement `attendanceCount`.
- Recalculate `userTiers` (e.g., dropping back to `Active` if they fall below the `ASCENSION_THRESHOLD`).
- Delete `hasAttended[msg.sender][eventId]`.

---

### Minor Observations

- The `DECAY_PERIOD` in `CrestCore.sol` drops a user from `Active/Ascended` back to `Dormant` if they haven't attended an event in 30 days. However, when this happens inside `claimAttendance`, the current claim immediately pushes them back to `Active` right after the penalty is applied. This correctly penalizes their `attendanceCount` (resetting it to 1), but the downgrade emission might be confusing to front-ends: It emits `TierDowngraded` followed by `TierUpgraded` in the exact same transaction.

### 4. [MEDIUM] Revoked Users Can Grief and Re-Claim Attendance Instantly

**Vulnerability:**
If a user is malicious and uses a bot to claim attendance, an organizer might revoke their attendance using `revokeAttendance`.
However, because `revokeAttendance` reset `hasAttended[user][eventId] = false;` (in the first iteration of the fix), the user could *instantly* call `claimAttendance` again for the exact same event as long as the event was still active. Furthermore, because their tier dropped back to `Dormant`, their cooldown was `0`, allowing an immediate re-claim in the very next block, leading to an infinite cat-and-mouse griefing loop.

**Fix:**
In `revokeAttendance`, we intentionally **do not** reset `hasAttended[user][eventId] = false`. Leaving it as `true` acts as a permanent blacklist for that user for that specific event, preventing them from re-claiming it after being revoked. To prevent the organizer from double-revoking the same attestation (since `hasAttended` no longer guards the decrement logic), we use `delete attestationToEvent[attestationUid];` to clear the attestation mapping right after it is revoked.
