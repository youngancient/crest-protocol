// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IEAS.sol";
import "./CrestEvents.sol";

/**
 * @title CrestCore
 * @dev Core Logic Gateway for the Crest Protocol.
 * Enforces Time-Based rules (dynamic cooldowns) and State Machine transitions (Tiers).
 * Proxies attendance registration to the Rootstock Attestation Service (RAS/EAS).
 */
contract CrestCore {
    enum Tier { Dormant, Active, Ascended }

    IEAS public immutable eas;
    CrestEvents public immutable crestEvents;
    bytes32 public immutable schemaUid;

    mapping(address => Tier) public userTiers;
    mapping(address => uint256) public lastAttestationTime;
    mapping(address => uint256) public attendanceCount;
    // Prevent dual sweeping in the same event
    mapping(address => mapping(uint256 => bool)) public hasAttended;
    mapping(address => uint256[]) public userAttendedEvents;

    // Track attestations for secure revocation
    mapping(bytes32 => uint256) public attestationToEvent;
    mapping(bytes32 => address) public attestationToUser;

    event AttendanceClaimed(address indexed user, uint256 indexed eventId, Tier newTier, bytes32 attestationUid);
    event TierUpgraded(address indexed user, Tier oldTier, Tier newTier);
    event TierDowngraded(address indexed user, Tier oldTier, Tier newTier);
    event AttendanceRevoked(address indexed organizer, uint256 indexed eventId, bytes32 attestationUid);

    error EventNotActive();
    error AlreadyAttendedEvent();
    error CooldownActive(uint256 timeRemaining);
    error NotEventOrganizer();
    error InvalidPasscode();
    error InvalidAttestation();

    uint256 public constant ASCENSION_THRESHOLD = 10;
    uint256 public constant DECAY_PERIOD = 30 days;

    /**
     * @param _eas Address of the RAS/EAS contract.
     * @param _crestEvents Address of the CrestEvents primitive.
     * @param _schemaUid UID of the deployed schema for Crest attendance.
     */
    constructor(address _eas, address _crestEvents, bytes32 _schemaUid) {
        eas = IEAS(_eas);
        crestEvents = CrestEvents(_crestEvents);
        schemaUid = _schemaUid;
    }

    /**
     * @notice Get the minimum cooldown required between attendances for a given tier.
     * @param tier The current User Tier.
     */
    function getCooldown(Tier tier) public pure returns (uint256) {
        if (tier == Tier.Dormant) return 0;
        return 1 hours; // Both Active and Ascended have a 1 hour cooldown to prevent spam
    }

    /**
     * @notice Claim attendance for an ongoing event. Evaluates state machine and cooldowns.
     * @param eventId The ID of the event to claim attendance for.
     * @param role The role of the user (e.g., 0 for attendee, 1 for speaker).
     * @param ipfsHash Event specific off-chain metadata or user proof.
     * @param passcode The secret word announced at the event.
     */
    function claimAttendance(uint256 eventId, uint8 role, string calldata ipfsHash, string calldata passcode) external {
        // Validate Time-Based rules (Event Window)
        if (!crestEvents.isEventActive(eventId)) {
            revert EventNotActive();
        }

        // Validate Passcode
        (,,,, bytes32 passcodeHash) = crestEvents.events(eventId);
        if (keccak256(abi.encodePacked(passcode)) != passcodeHash) {
            revert InvalidPasscode();
        }

        // Prevent duplicate claims for the same event
        if (hasAttended[msg.sender][eventId]) {
            revert AlreadyAttendedEvent();
        }

        // Dynamic Cooldowns based on Tier
        Tier currentTier = userTiers[msg.sender];

        // Process Reputation Decay before allowing new claims
        if (currentTier != Tier.Dormant && lastAttestationTime[msg.sender] != 0) {
            if (block.timestamp > lastAttestationTime[msg.sender] + DECAY_PERIOD) {
                // User decayed due to inactivity! Reset to Dormant
                emit TierDowngraded(msg.sender, currentTier, Tier.Dormant);
                currentTier = Tier.Dormant;
                userTiers[msg.sender] = Tier.Dormant;
                attendanceCount[msg.sender] = 0; // Penalty: Lose attendance streak
            }
        }

        uint256 cooldown = getCooldown(currentTier);
        if (block.timestamp < lastAttestationTime[msg.sender] + cooldown) {
            uint256 remaining = (lastAttestationTime[msg.sender] + cooldown) - block.timestamp;
            revert CooldownActive(remaining);
        }

        // Update State Machine
        hasAttended[msg.sender][eventId] = true;
        userAttendedEvents[msg.sender].push(eventId);
        lastAttestationTime[msg.sender] = block.timestamp;
        attendanceCount[msg.sender]++;

        Tier newTier = currentTier;
        if (currentTier == Tier.Dormant) {
            userTiers[msg.sender] = Tier.Active;
            newTier = Tier.Active;
            emit TierUpgraded(msg.sender, Tier.Dormant, Tier.Active);
        } else if (currentTier == Tier.Active && attendanceCount[msg.sender] >= ASCENSION_THRESHOLD) {
            // Ascend after 10 total attendances
            userTiers[msg.sender] = Tier.Ascended;
            newTier = Tier.Ascended;
            emit TierUpgraded(msg.sender, Tier.Active, Tier.Ascended);
        }

        // Proxy to EAS/RAS
        // Encode the data according to the assumed schema: uint256 eventId, uint8 role, string ipfsHash
        bytes memory encodedData = abi.encode(eventId, role, ipfsHash);

        AttestationRequestData memory requestData = AttestationRequestData({
            recipient: msg.sender,
            expirationTime: 0,
            revocable: true,
            refUID: bytes32(0),
            data: encodedData,
            value: 0
        });

        AttestationRequest memory request = AttestationRequest({
            schema: schemaUid,
            data: requestData
        });

        // We assume the EAS proxy doesn't require payment here unless configured.
        bytes32 uid = eas.attest(request);

        // Record attestation metadata for secure revocation
        attestationToEvent[uid] = eventId;
        attestationToUser[uid] = msg.sender;

        emit AttendanceClaimed(msg.sender, eventId, newTier, uid);
    }

    /**
     * @notice Revokes an attendance attestation. Only callable by the event organizer.
     * @param eventId The ID of the event the user attended.
     * @param attestationUid The UID of the EAS attestation to revoke.
     */
    function revokeAttendance(uint256 eventId, bytes32 attestationUid) external {
        // Only allow the original event organizer to revoke attendance for their event
        (,, address organizer,,) = crestEvents.events(eventId);
        if (msg.sender != organizer) {
            revert NotEventOrganizer();
        }

        // Prevent cross-event revocation exploit and double-revocations
        if (attestationToEvent[attestationUid] != eventId) {
            revert InvalidAttestation();
        }

        address user = attestationToUser[attestationUid];

        // Clear mapping to prevent double-decrementing the same attestation later
        delete attestationToEvent[attestationUid];

        // Process State Reversion
        // NOTE: We intentionally DO NOT set hasAttended[user][eventId] = false;
        // This acts as a blacklist to prevent a revoked attacker from immediately 
        // re-claiming the same event, especially if they drop back to Dormant (0 cooldown).

        if (attendanceCount[user] > 0) {
            attendanceCount[user]--;
        }

            Tier current = userTiers[user];
            // If they are Ascended but no longer meet the threshold
            if (current == Tier.Ascended && attendanceCount[user] < ASCENSION_THRESHOLD) {
                userTiers[user] = Tier.Active;
                emit TierDowngraded(user, Tier.Ascended, Tier.Active);
            } 
            // If they are Active and their count drops to 0
            else if (current == Tier.Active && attendanceCount[user] == 0) {
                userTiers[user] = Tier.Dormant;
                emit TierDowngraded(user, Tier.Active, Tier.Dormant);
            }

        RevocationRequestData memory requestData = RevocationRequestData({
            uid: attestationUid,
            value: 0
        });

        RevocationRequest memory request = RevocationRequest({
            schema: schemaUid,
            data: requestData
        });

        eas.revoke(request);

        emit AttendanceRevoked(msg.sender, eventId, attestationUid);
    }

    /**
     * @notice Fetch all event IDs a user has claimed attendance for.
     * @param user The address of the user.
     * @return An array of event IDs.
     */
    function getEventsAttendedByUser(address user) external view returns (uint256[] memory) {
        return userAttendedEvents[user];
    }
}
