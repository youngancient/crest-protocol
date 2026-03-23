import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Constants (To be replaced with actual Rootstock Testnet RSK EAS Addresses if using live,
  // For now, we deploy MockEAS on testnet if none exist, or user passes the real ones).
  // Ideally, EAS address on RSK is fetched from .env
  const EAS_ADDRESS = process.env.EAS_ADDRESS;
  const SCHEMA_REGISTRY_ADDRESS = process.env.SCHEMA_REGISTRY_ADDRESS;

  // 1. Deploy Crest Events Primitive
  const CrestEvents = await ethers.getContractFactory("CrestEvents");
  const crestEvents = await CrestEvents.deploy();
  await crestEvents.waitForDeployment();
  console.log("CrestEvents deployed to:", crestEvents.target);

  // 2. Deploy Schema or configure schema UID
  // The schema is: "uint256 eventId, uint8 role, string ipfsHash"
  // For this deployment script, we'll hash the schema string assuming it's already registered on EAS.
  // In production, you would call SchemaRegistry.register() if it's not yet registered.
  const schemaString = "uint256 eventId, uint8 role, string ipfsHash";
  // The schema UID is typically a keccak256 hash of the schema string, resolver, and revocable flag.
  // We'll use a placeholder UID for demonstration, or assume it's set in env.
  const schemaUid = process.env.SCHEMA_UID || ethers.keccak256(ethers.toUtf8Bytes(schemaString));
  console.log("Using Schema UID:", schemaUid);

  let easAddress = EAS_ADDRESS;

  // If we are deploying on a local node or testnet without EAS, optionally deploy MockEAS
  if (!easAddress) {
    console.log("No EAS Address found in .env. Deploying MockEAS...");
    const MockEAS = await ethers.getContractFactory("MockEAS");
    const mockEAS = await MockEAS.deploy();
    await mockEAS.waitForDeployment();
    easAddress = mockEAS.target as string;
    console.log("MockEAS deployed to:", easAddress);
  }

  // 3. Deploy Crest Core
  const CrestCore = await ethers.getContractFactory("CrestCore");
  const crestCore = await CrestCore.deploy(easAddress, crestEvents.target, schemaUid);
  await crestCore.waitForDeployment();

  console.log(`CrestCore deployed to: ${crestCore.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
