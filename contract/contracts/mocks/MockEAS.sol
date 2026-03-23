// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IEAS.sol";

contract MockEAS is IEAS {
    uint256 public nextUid = 1;

    event Attested(bytes32 indexed uid, bytes32 indexed schema, address indexed recipient, bytes data);

    function attest(AttestationRequest calldata request) external payable returns (bytes32) {
        bytes32 uid = bytes32(nextUid++);
        emit Attested(uid, request.schema, request.data.recipient, request.data.data);
        return uid;
    }
}
