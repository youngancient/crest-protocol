import { ethers, run, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Validate Environment Variables for Production
  const rasAddress = process.env.RAS_ADDRESS?.toLowerCase();
  const schemaUid = process.env.SCHEMA_UID?.toLowerCase();

  if (!rasAddress) {
    throw new Error("CRITICAL: Missing EAS_ADDRESS in environment variables");
  }

  if (!schemaUid) {
    throw new Error("CRITICAL: Missing SCHEMA_UID in environment variables");
  }

  console.log("Using RAS Address:", rasAddress);
  console.log("Using Schema UID:", schemaUid);

  // Deploy CrestEvents
  console.log("\nDeploying CrestEvents...");
  const CrestEvents = await ethers.getContractFactory("CrestEvents");
  const crestEvents = await CrestEvents.deploy();
  await crestEvents.waitForDeployment();
  const crestEventsAddress = await crestEvents.getAddress();
  console.log("CrestEvents deployed to:", crestEventsAddress);

  // Deploy CrestCore
  console.log("\nDeploying CrestCore...");
  const CrestCore = await ethers.getContractFactory("CrestCore");
  const crestCoreArgs = [rasAddress, crestEventsAddress, schemaUid];
  const crestCore = await CrestCore.deploy(rasAddress, crestEventsAddress, schemaUid);
  await crestCore.waitForDeployment();
  const crestCoreAddress = await crestCore.getAddress();
  console.log("CrestCore deployed to:", crestCoreAddress);

  // Verify Contracts on Explorer
  // We only run verification if we are not on a local development network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nWaiting for 6 block confirmations before verifying...");
    // Await block confirmations to ensure the block explorer has indexed the deployment
    await crestCore.deploymentTransaction()?.wait(6);

    console.log("Verifying CrestEvents...");
    try {
      await run("verify:verify", {
        address: crestEventsAddress,
        constructorArguments: [],
      });
      console.log("CrestEvents verified successfully!");
    } catch (error: any) {
      console.error("Error verifying CrestEvents:", error.message);
    }

    console.log("\nVerifying CrestCore...");
    try {
      await run("verify:verify", {
        address: crestCoreAddress,
        constructorArguments: crestCoreArgs,
      });
      console.log("CrestCore verified successfully!");
    } catch (error: any) {
      console.error("Error verifying CrestCore:", error.message);
    }
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
