export const CREST_EVENTS_ABI = [
    // Read
    "function nextEventId() view returns (uint256)",
    "function events(uint256 id) view returns (uint40 startTime, uint40 endTime, address organizer, string ipfsHash, bytes32 passcodeHash)",
    "function isEventActive(uint256 _eventId) view returns (bool isActive)",

    // Write
    "function registerEvent(uint40 _startTime, uint40 _endTime, string _ipfsHash, bytes32 _passcodeHash) returns (uint256 eventId)",
    "function updatePasscode(uint256 _eventId, bytes32 _newPasscodeHash)",

    // Events
    "event EventRegistered(uint256 indexed eventId, address indexed organizer, uint40 startTime, uint40 endTime, string ipfsHash, bytes32 passcodeHash)",
    "event PasscodeUpdated(uint256 indexed eventId, bytes32 newPasscodeHash)",

    // Errors
    "error InvalidTimeWindow()",
    "error EventNotFound()",
    "error NotEventOrganizer()"
];
