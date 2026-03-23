// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CrestEvents
 * @dev Primitive for event organizers to register events on-chain.
 * Highly gas-optimized using struct packing.
 */
contract CrestEvents {
    struct Event {
        // Slot 1: 30 bytes used out of 32
        uint40 startTime;  // 5 bytes
        uint40 endTime;    // 5 bytes
        address organizer; // 20 bytes
        // Slot 2: dynamically sized string
        string ipfsHash;
    }

    uint256 public nextEventId = 1;
    mapping(uint256 => Event) public events;

    event EventRegistered(uint256 indexed eventId, address indexed organizer, uint40 startTime, uint40 endTime, string ipfsHash);

    error InvalidTimeWindow();
    error EventNotFound();

    /**
     * @notice Registers a new event with its time window and IPFS metadata hash.
     * @param _startTime Starting timestamp of the event.
     * @param _endTime Ending timestamp of the event.
     * @param _ipfsHash IPFS hash containing off-chain event metadata (title, location, etc.).
     * @return eventId The newly created event ID.
     */
    function registerEvent(uint40 _startTime, uint40 _endTime, string calldata _ipfsHash) external returns (uint256 eventId) {
        if (_startTime >= _endTime || _startTime < block.timestamp) {
            revert InvalidTimeWindow();
        }

        eventId = nextEventId++;

        events[eventId] = Event({
            startTime: _startTime,
            endTime: _endTime,
            organizer: msg.sender,
            ipfsHash: _ipfsHash
        });

        emit EventRegistered(eventId, msg.sender, _startTime, _endTime, _ipfsHash);
    }

    /**
     * @notice Checks if an event is currently active based on the block timestamp.
     * @param _eventId The ID of the event to check.
     * @return isActive True if the current time is within the event's start and end times.
     */
    function isEventActive(uint256 _eventId) external view returns (bool isActive) {
        Event storage evt = events[_eventId];
        if (evt.organizer == address(0)) {
            revert EventNotFound();
        }
        return (block.timestamp >= evt.startTime && block.timestamp <= evt.endTime);
    }
}
