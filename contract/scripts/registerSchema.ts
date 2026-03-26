import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Registering Schema with account:", deployer.address);

    // Official Rootstock Testnet Schema Registry Address
    const SCHEMA_REGISTRY_ADDRESS = process.env.SCHEMA_REGISTRY_ADDRESS;

    if (!SCHEMA_REGISTRY_ADDRESS) {
        throw new Error("CRITICAL: Missing SCHEMA_REGISTRY_ADDRESS in environment variables");
    }

    // The ABI for the register function on the Schema Registry
    const registryAbi = [
        "function register(string calldata schema, address resolver, bool revocable) external returns (bytes32)",
        "event Registered(bytes32 indexed uid, address indexed registerer, tuple(bytes32 uid, string schema, address resolver, bool revocable) schema)"
    ];

    const schemaRegistry = new ethers.Contract(
        SCHEMA_REGISTRY_ADDRESS.toLowerCase(),
        registryAbi,
        deployer
    );

    // Our custom Crest Schema format
    const schemaString = "uint256 eventId, uint8 role, string ipfsHash";
    // We don't have a specific resolver contract yet, so we pass the Zero Address
    const resolver = ethers.ZeroAddress;
    // We want our attestations to be revocable
    const revocable = true;

    try {
        console.log(`Submitting transaction to register schema: "${schemaString}"`);
        const tx = await schemaRegistry.register(schemaString, resolver, revocable);
        console.log("Waiting for transaction receipt... TxHash:", tx.hash);

        const receipt = await tx.wait();
        const registeredEvent = receipt.logs.find(
            (log: any) => log.fragment && log.fragment.name === "Registered"
        );

        if (registeredEvent) {
            const uid = registeredEvent.args[0];
            console.log("-----------------------------------------");
            console.log("SUCCESS! Your new SCHEMA_UID is:");
            console.log(uid);
            console.log("-----------------------------------------");
        } else {
            console.log("Transaction succeeded but couldn't parse the UID from logs.");
        }
    } catch (e: any) {
        console.warn("\nTransaction reverted. This usually means your schema is already registered!");
    }

    // Always calculate and display it manually as a fallback
    const manuallyCalculatedUid = ethers.solidityPackedKeccak256(
        ["string", "address", "bool"],
        [schemaString, resolver, revocable]
    );

    console.log("\n--- DETERMINISTIC SCHEMA UID ---");
    console.log(manuallyCalculatedUid);
    console.log("-----------------------------------------");
    console.log("Add this UID to your .env file as SCHEMA_UID=" + manuallyCalculatedUid);

}

main().catch((error) => {
    console.error("Failed to register schema:", error);
    process.exitCode = 1;
});
