// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct SchemaRecord {
    bytes32 uid;
    string schema;
    address resolver;
    bool revocable;
}

interface ISchemaRegistry {
    function register(string calldata schema, address resolver, bool revocable) external returns (bytes32);
    function getSchema(bytes32 uid) external view returns (SchemaRecord memory);
}
