# Crest Protocol

## Table of Contents
- [What the Project Does](#what-the-project-does)
- [Protocol Rules](#protocol-rules)
- [Design Choices & Reasoning](#design-choices--reasoning)
- [Why Rootstock Needs Crest (Use Cases)](#why-rootstock-needs-crest-use-cases)
- [Deployed Contracts (Rootstock Testnet)](#deployed-contracts-rootstock-testnet)
- [Architecture](#architecture)
- [SDK Integration](#sdk-integration)
  - [Installation](#installation)
  - [Frontend Usage](#frontend-usage)
  - [Backend Usage](#backend-usage)
  - [Querying Data](#querying-data)
- [Demo frontend](#demo-frontend)
  - [Demo video](#demo-video)
- [Future Improvements](#future-improvements)
- [Smart Contract Development](#smart-contract-development)
- [Ecosystem Integrations](#ecosystem-integrations)

---

## What the Project Does
Crest is a decentralized identity primitive on the **Rootstock (RSK)** blockchain that turns event attendance into a verifiable, on-chain reputation system.

Instead of issuing standard POAPs or expensive NFTs, Crest uses the **Rootstock Attestation Service (RAS)** (a port of the Ethereum Attestation Service) to hand out standardized, composable, and gas-efficient attendance stamps. It gives developers an SDK and smart contracts so organizers can easily spin up events, and users can claim their attendance to build up their reputation tier over time.

## Protocol Rules
We built Crest with a few strict on-chain rules to keep things secure, stop sybil attacks, and make sure reputation actually means something:
- **Time-Gated Claim Windows:** You can only claim attendance while an event is actively running.
- **Passcode Protection:** Claiming requires an off-chain passcode from the organizer, so bots can't just blindly scalp attendance.
- **Anti-Spam Cooldowns:** Active and Ascended users share a strict **1-hour cooldown** between claims to prevent spam.
- **Reputation Decay (30-Day Rule):** If you don't attend any events for **30 days**, your reputation decays. You'll drop back to the `Dormant` tier and lose your streak.
- **Tier State Machine:** Users have to organically earn their reputation tier (`Dormant` → `Active` → `Ascended`) by consistently showing up.
- **Strict Revocation:** Only the original event organizer can call `revokeAttendance()` to penalize bad actors. You can't revoke your own attendance.

## Design Choices & Reasoning
Here's why we built it this way:
- **RAS Attestations over NFTs:** Traditional NFTs are expensive to mint and annoying to query on-chain. RAS attestations are cheap, standardized, and natively composable, making it way easier for DAOs and DeFi protocols to read a user's attendance record directly.
- **Event-First Architecture:** Organizers just interact with our straightforward `CrestEvents` interface rather than wrestling with the complex RAS schema registry. It abstracts away the headache of formatting attestations.
- **Storage Packing:** In `CrestEvents.sol`, we tightly pack the event start times, end times, and organizer addresses into a single 32-byte storage slot to keep gas costs as low as possible.
- **Explicit On-Chain State Tracking:** Public Rootstock Testnet RPCs have extremely strict rate limiting and log-fetching limits, which made `eth_getLogs` unreliable for our SDK. To fix this, we track state explicitly in `CrestEvents` and `CrestCore` using native Solidity `view` functions. We prioritized a rock-solid frontend UX over saving a few bytes of storage.
- **Decayed Reputation:** We wanted "Ascended" status to actually mean something to protocols offering yield or governance weight. The 30-day decay stops early adopters from squatting on high tiers without actually participating in the ecosystem anymore.

## Why Rootstock Needs Crest (Use Cases)

Crest is built specifically for the Rootstock ecosystem to drive engagement and retention, using Bitcoin's security layer to keep things sybil-resistant:

- **DeFi Loyalty & Yield Boosting**: Rootstock DeFi protocols can plug into Crest to hand out loyalty airdrops, yield multipliers, or fee discounts to "Ascended" community members.
- **Sybil-Resistant Governance**: DAOs can use our time-tested attendance tiers to weight voting, making sure that active, proven community members actually get the loudest voice.
- **Web3 Events & IRL Ticketing**: Rootstock-sponsored conferences and meetups can use Crest instead of standard POAPs, keeping users sticky to the RSK ecosystem instead of bouncing them to another chain.
- **Hackathons & Developer Tracking**: Ecosystem programs can issue soulbound attendance to track developer participation across hackathons and measure real builder retention.

---

## Deployed Contracts (Rootstock Testnet)

The latest versions of the protocol's core smart contracts are deployed and verified on the Rootstock Testnet. You can explore the transactions and verified source code on Blockscout:
- **CrestCore**: [0x46700DBdDdab5b8E2f4ba2B7753CFA6bb40f56fe](https://rootstock-testnet.blockscout.com/address/0x46700DBdDdab5b8E2f4ba2B7753CFA6bb40f56fe?tab=contract)
- **CrestEvents**: [0xEB415bA43093b15Dff6697Caff234e57b128608f](https://rootstock-testnet.blockscout.com/address/0xEB415bA43093b15Dff6697Caff234e57b128608f?tab=contract)

---

## Architecture

The protocol is split into two primary smart contracts to separate event creation logic from core attestation logic:

### 1. CrestEvents (`CrestEvents.sol`)
The Event Management Primitive. Provides a simplified interface for event organizers to register upcoming events. It stores event metadata (start time, end time, organizer address, passcode hash) securely and acts as a source of truth for the Core contract to query during attendance claims.

### 2. CrestCore (`CrestCore.sol`)
The Core Logic Gateway and proxy to RAS. This contract handles user attendance requests, verifies the event's validity against `CrestEvents`, enforces the protocol's overarching rules (cooldowns, decay, etc.), and ultimately mints the standardized attendance attestation via the Rootstock Attestation Service.

---

## SDK Integration

The `crest-protocol-sdk` allows developers to easily interact with the Crest smart contracts and format on-chain data for their dApps without needing to write manual ABIs.

### Installation
Navigate to your frontend or backend project and install the SDK along with `ethers`:
```bash
npm install crest-protocol-sdk ethers
```

### Initializing the Client

The SDK exposes the `CrestClient` class which handles all reads, writes, and Ethers.js log parsing.

#### Frontend Usage (Browser Wallet)
To use the SDK in a React or Next.js frontend, pass a `Signer` from the user's connected wallet (e.g., MetaMask):

```typescript
import { CrestClient } from 'crest-protocol-sdk';
import { BrowserProvider } from 'ethers';

// 1. Get the provider & signer from the browser wallet
const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// 2. Initialize the client
const crestClient = new CrestClient(
    "CREST_CORE_ADDRESS",
    "CREST_EVENTS_ADDRESS",
    "EAS_PROXY_ADDRESS",
    signer
);

// 3. Claim Attendance using the connected wallet!
await crestClient.claimAttendance({
    eventId: 1,
    role: 0,
    ipfsHash: "ipfs://...",
    passcode: "SecretWord2026"
});
```

#### Backend Usage (Node.js)
If you are querying data, verifying tickets, or acting as an admin/organizer on a backend server, initialize the client using a standard RPC provider:

```typescript
import { CrestClient } from 'crest-protocol-sdk';
import { JsonRpcProvider } from 'ethers';

// Or use alchemy/infura URL
const provider = new JsonRpcProvider("https://public-node.rsk.co");

const crestClient = new CrestClient(
    "CREST_CORE_ADDRESS",
    "CREST_EVENTS_ADDRESS",
    "EAS_PROXY_ADDRESS",
    provider // Read-only mode
);
```

### Querying Data
The SDK implements native Solidity `view` functions and Ethers.js `queryFilter` methods so you can easily pull arrays of data:

```typescript
// Get all events created by a specific organizer
const eventIds = await crestClient.getEventsByOrganizer("0xOrganizerAddress");

// Get all attendees for a specific event
const attendees = await crestClient.getAttendeesForEvent(1);
console.log(attendees[0].user, attendees[0].tier);

// Strictly Verify if an EAS attendance attestation is valid (not revoked)
const isValid = await crestClient.isAttestationValid("0xUID...");
```

### Error Handling
The `CrestClient` natively intercepts raw Ethers.js transaction exceptions (`CALL_EXCEPTION`) and decodes them into clean, human-readable Custom Error strings automatically. 

**Frontend:**
Simply display `error.message` directly to your users:
```typescript
try {
    await crestClient.claimAttendance({...});
} catch (error: any) {
    toast.error(error.message); // Will nicely display "AlreadyAttended" or "EventInactive"
}
```

**Backend:**
For conditional backend architecture, match the exact error string:
```typescript
try {
    await crestClient.claimAttendance({...});
} catch (error: any) {
    if (error.message === "EventInactive") {
        // Queue retry
    } else if (error.message === "NotEventOrganizer") {
        // Throw security alert
    }
}
```

---

## Demo frontend

The repository includes a scaffolded React template (`/demo-client`) that demonstrates how to integrate the Crest Protocol SDK into a modern frontend.

### Running the Demo
```bash
cd demo-client
npm install
npm run dev
```

### Features Demonstrated
- **Wallet Connection**: Uses `@reown/appkit` for seamless wallet connectivity.
- **Client Initialization**: Shows how to initialize `CrestClient` with the connected wallet provider.
- **Protocol Reads**: Demonstrates fetching global registered events, user tier, and user attendance status in an integrated dashboard.
- **Protocol Actions**: Includes buttons for creating mock events and claiming attendance using the passcode system.

### Demo video
[![Watch Demo Video on Google Drive](https://img.shields.io/badge/▶_Watch_Demo_Video-Google_Drive-1FA463?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com/file/d/1u-cVYR7MVLFRuFsL7wyIUsRlA12InEK4/view)

*Note: GitHub does not support embedding Google Drive videos directly. Click the button above to view the walkthrough.*

---
## Future Improvements

To scale the Crest Protocol securely and efficiently to millions of users, the following architectural upgrades are planned:

### 1. Subgraph Integration (The Graph)
During initial testing with Alchemy's public RPC infrastructure on the Rootstock Testnet, severe rate limiting and strict 10-block log limits hindered the `eth_getLogs` queries in the SDK. To circumvent this without crushing the user experience, the protocol temporarily shifted to tracking state explicitly in `CrestEvents` and `CrestCore` using native Solidity `view` functions.
- **Action Item:** Deploy a custom **Crest Protocol Subgraph** to safely index protocol logs and remove the array iteration logic from the core smart contracts. The SDK can then be upgraded to query The Graph directly, significantly lowering on-chain gas costs and permanently bypassing all RPC restrictions.

### 2. Robust Off-Chain Passcode Management
`passcodeHash` is public and non-recoverable on-chain. While the SDK supports `updatePasscode` for lost codes, a better preventative measure is needed.
- **Action Item:** Build an off-chain secure organizer dashboard that automatically saves generated passcodes encrypted with the organizer's wallet signature.

### 3. Gasless / Sponsored Transactions (Account Abstraction)
- **Action Item:** Implement an **EIP-4337 Biconomy or Etherspot** integration within the SDK.
- **Action Item:** Allows attendees at physical events to claim attendance seamlessly via signature without needing gas tokens (RBTC), removing the onboarding friction for non-crypto natives.

### 4. IPFS Metadata Pipeline
Currently, the protocol relies on a dummy `"ipfs://QmTz..."` hash for event metadata. Since storing strings like event titles, banners, and descriptions natively on-chain is prohibitively expensive, a robust off-chain pipeline is required.
- **Action Item:** Extend the existing minimalist dashboard with a seamless "Create Event" form. Organizers will fill in their event details directly in the UI, which will automatically pin the JSON data to an IPFS provider (like Pinata). The resulting true `ipfsHash` will then be passed into the `registerEvent()` transaction, allowing the event cards to dynamically fetch and render the rich, decentralized metadata.

---

## Smart Contract Development

*Note: If you are simply building a dApp or frontend to integrate with Crest, you will use the SDK above. The deployment instructions below are strictly for open-source contributors modifying the core smart contracts.*

### Installation & Testing
```bash
cd contract
npm install
npx hardhat test
```

### Deployment Pipeline
Create a `.env` file in `contract/`:
```env
# Your deployment wallet private key
PRIVATE_KEY=your_private_key_here

# Rootstock Attestation Service (Testnet)
RAS_ADDRESS=0xc300aeEadd60999933468738c9F5d7e9c0671e1C
SCHEMA_REGISTRY_ADDRESS=0x679c62956cD2801ABaBF80e9D430F18859eea2D5
```

1. **Register the Schema** (`uint256 eventId, uint8 role, string ipfsHash`):
   ```bash
   npx hardhat run scripts/registerSchema.ts --network rskTestnet
   ```
   *Copy the outputted UID and append `SCHEMA_UID=0x...` to your `.env`.*

2. **Deploy and Verify**:
   ```bash
   npx hardhat run scripts/deploy.ts --network rskTestnet
   ```

---

## Ecosystem Integrations

- **Wallets:** Built to integrate seamlessly with standard wallet providers like the Reown AppKit.
- **Data & RPC:** Powered by the Rootstock public nodes and Alchemy RPC pipelines for reliable transaction handling and event indexing.
