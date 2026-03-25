export const CREST_CORE_ABI = [
    // Read
    "function eas() view returns (address)",
    "function crestEvents() view returns (address)",
    "function schemaUid() view returns (bytes32)",
    "function userTiers(address user) view returns (uint8)",
    "function lastAttestationTime(address user) view returns (uint256)",
    "function attendanceCount(address user) view returns (uint256)",
    "function hasAttended(address user, uint256 eventId) view returns (bool)",
    "function attestationToEvent(bytes32 uid) view returns (uint256)",
    "function attestationToUser(bytes32 uid) view returns (address)",
    "function ASCENSION_THRESHOLD() view returns (uint256)",
    "function DECAY_PERIOD() view returns (uint256)",
    "function getCooldown(uint8 tier) pure returns (uint256)",

    // Write
    "function claimAttendance(uint256 eventId, uint8 role, string ipfsHash, string passcode)",
    "function revokeAttendance(uint256 eventId, bytes32 attestationUid)",

    // Events
    "event AttendanceClaimed(address indexed user, uint256 indexed eventId, uint8 newTier, bytes32 attestationUid)",
    "event TierUpgraded(address indexed user, uint8 oldTier, uint8 newTier)",
    "event TierDowngraded(address indexed user, uint8 oldTier, uint8 newTier)",
    "event AttendanceRevoked(address indexed organizer, uint256 indexed eventId, bytes32 attestationUid)",

    // Errors
    "error EventNotActive()",
    "error AlreadyAttendedEvent()",
    "error CooldownActive(uint256 timeRemaining)",
    "error NotEventOrganizer()",
    "error InvalidPasscode()",
    "error InvalidAttestation()"
];
