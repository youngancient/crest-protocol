# Crest Protocol

Crest is a decentralized identity primitive built on the **Rootstock (RSK)** blockchain. It transforms standard event attendance into a verifiable, on-chain reputation system.

Instead of issuing expensive and fragmented NFTs for event attendance, Crest utilizes the **Rootstock Attestation Service (RAS)** (an exact deployment of the Ethereum Attestation Service) to issue standardized, composable, and gas-efficient attendance stamps.

## Table of Contents
- [Why Rootstock Needs Crest](#why-rootstock-needs-crest)
- [Architecture](#architecture)
- [SDK Integration](#sdk-integration)
  - [Installation](#installation)
  - [Frontend Usage](#frontend-usage)
  - [Backend Usage](#backend-usage)
  - [Querying Data](#querying-data)
- [Future Improvements](#future-improvements)
- [Smart Contract Development](#smart-contract-development)
- [Ecosystem Integrations](#ecosystem-integrations)

---

## Why Rootstock Needs Crest (Use Cases)

Crest is designed for the Rootstock ecosystem, driving engagement, retention, and sybil-resistance leveraging Bitcoin's unmatched security layer:

- **DeFi Loyalty & Yield Boosting**: Rootstock DeFi protocols can seamlessly integrate Crest to distribute loyalty airdrops, exclusive yield multipliers, or fee discounts specifically to "Ascended" community members.
- **Sybil-Resistant Governance**: DAOs can use Crest's time-tested attendance tiers to weight governance voting, ensuring that active, mathematically proven community members have the loudest voice.
- **Web3 Events & IRL Ticketing**: Rootstock-sponsored conferences and meetups can use Crest as a native POAP alternative, keeping the community engaged directly on the ecosystem rather than exporting them to external chains.
- **Hackathons & Developer Tracking**: Ecosystem programs can issue soulbound attendance to definitively track developer participation across multiple hackathons, measuring real organic builder retention.

---

## Architecture

Crest uses an **Event-First** architecture designed to keep the on-chain footprint as lean as possible. The protocol is split into two primary smart contracts:

### 1. CrestEvents (`CrestEvents.sol`)
The Event Management Primitive. Provides a simplified interface for event organizers to register upcoming events without interacting directly with the complex RAS protocol.
- **Gas Optimized:** Event start times, end times, and organizer addresses are tightly packed into a single 32-byte storage slot.
- **Time Windows:** Enforces strict active windows for when attendance can be claimed.

### 2. CrestCore (`CrestCore.sol`)
The Core Logic Gateway and proxy to RAS. This contract seamlessly enforces the protocol's time-based rules and state machine transitions.
- **Tier State Machine:** Users organically upgrade their reputation tier (`Dormant` → `Active` → `Ascended`) as they attend more events.
- **Anti-Spam Cooldowns:** Active and Ascended users share a strict **1-hour cooldown** between claims to prevent spamming the system.
- **Reputation Decay (30-Day Rule):** If a user fails to attend an event for **30 days**, their reputation decays, dropping them back to the `Dormant` tier and resetting their attendance streak to zero.
- **Revocation:** Only the original event organizer has the explicit authority to call `revokeAttendance()` to penalize cheaters.

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
The SDK implements Ethers.js `queryFilter` methods so you can easily pull arrays of data natively from contract logs:

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
