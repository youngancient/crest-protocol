# Crest Protocol 🎖️

Crest is a decentralized identity primitive built on the **Rootstock (RSK)** blockchain. It transforms standard event attendance into a verifiable, on-chain reputation system.

Instead of issuing expensive and fragmented NFTs for event attendance, Crest utilizes the **Rootstock Attestation Service (RAS)**—an exact deployment of the Ethereum Attestation Service (EAS)—to issue standardized, composable, and gas-efficient attendance stamps.

## 🌍 Why Rootstock Needs Crest (Use Cases)

Crest is designed to be a core public good for the Rootstock ecosystem, driving engagement, retention, and sybil-resistance leveraging Bitcoin's unmatched security layer:

- **DeFi Loyalty & Yield Boosting**: Rootstock DeFi protocols can seamlessly integrate Crest to distribute loyalty airdrops, exclusive yield multipliers, or fee discounts specifically to "Ascended" community members.
- **Sybil-Resistant Governance**: Rootstock DAOs and protocols can use Crest's time-tested attendance tiers to weight governance voting, ensuring that active, mathematically proven community members have the loudest voice.
- **Web3 Events & IRL Ticketing**: Rootstock-sponsored conferences, side-events, and meetups can use Crest as a native POAP alternative, keeping the community engaged directly on the ecosystem rather than exporting them to external chains.
- **Hackathons & Developer Tracking**: Ecosystem programs, accelerators, and Rootstock Academy can issue soulbound attendance to definitively track developer participation across multiple hackathons, measuring real organic builder retention.

## 🏗️ Architecture

Crest uses an **Event-First** architecture designed to keep the on-chain footprint as lean as possible. The protocol is split into two primary smart contracts:

### 1. CrestEvents (`CrestEvents.sol`)
The Event Management Primitive. This contract provides a simplified interface for event organizers to register upcoming events without interacting directly with the complex RAS protocol.
- **Gas Optimized:** Event start times, end times, and organizer addresses are tightly packed into a single 32-byte storage slot.
- **Time Windows:** Enforces strict active windows for when attendance can be claimed.

### 2. CrestCore (`CrestCore.sol`)
The Core Logic Gateway and proxy to RAS. This contract seamlessly enforces the protocol's time-based rules and state machine transitions.
- **Tier State Machine:** Users organically upgrade their reputation tier (`Dormant` → `Active` → `Ascended`) as they attend more events.
- **Anti-Spam Cooldowns:** Active and Ascended users share a strict **1-hour cooldown** between claims to prevent spamming the system.
- **Reputation Decay (30-Day Rule):** If a user fails to attend an event for **30 days**, their reputation decays, dropping them back to the `Dormant` tier and resetting their attendance streak to zero.
- **Revocation:** Only the original event organizer has the explicit authority to call `revokeAttendance()` to penalize cheaters.

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- npm or yarn

### Installation
1. Navigate to the contract folder:
    ```bash
    cd contract
    ```
2. Install the Hardhat and TypeScript dependencies:
    ```bash
    npm install
    ```

### Testing
We have included a comprehensive test suite testing the State Machine, cooldowns, and the 30-day decay system.

```bash
npx hardhat test
```

---

## 🚀 For Contributors: Protocol Core Deployment

*Note: If you are simply building a dApp or frontend to integrate with Crest, you will use our upcoming **TypeScript SDK**. The deployment instructions below are strictly for open-source contributors and infrastructure engineers modifying the core smart contracts.*

The core deployment pipeline is fully configured for the **Rootstock Testnet**.

### 1. Environment Setup
Create a `.env` file in the `contract/` directory:
```env
# Your deployment wallet private key
PRIVATE_KEY=your_private_key_here

# Rootstock Attestation Service (Testnet)
RAS_ADDRESS=0xc300aeEadd60999933468738c9F5d7e9c0671e1C
SCHEMA_REGISTRY_ADDRESS=0x679c62956cD2801ABaBF80e9D430F18859eea2D5
```

### 2. Generate Your Schema UID
Before deploying the core protocol, you must register the Crest schema format (`uint256 eventId, uint8 role, string ipfsHash`) with the official Rootstock Schema Registry.

Run the provided script to generate your unique `SCHEMA_UID`:
```bash
npx hardhat run scripts/registerSchema.ts --network rskTestnet
```
*Copy the outputted UID and append it to your `.env` file:*
```env
SCHEMA_UID=0x...
```

### 3. Deploy and Verify
Run the deployment script to deploy both `CrestEvents` and `CrestCore`. The script will automatically wait for 6 block confirmations and verify the smart contracts on the Rootstock Blockscout Explorer.

```bash
npx hardhat run scripts/deploy.ts --network rskTestnet
```

---

## 📚 Ecosystem Integrations

- **Wallets:** Built to integrate seamlessly with standard wallet providers like the Reown AppKit.
- **Data & RPC:** Powered by the Rootstock public nodes and Alchemy RPC pipelines for reliable transaction handling and event indexing.
