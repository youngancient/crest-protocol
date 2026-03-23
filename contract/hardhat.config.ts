import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        rskTestnet: {
            url: process.env.ROOTSTOCK_TESTNET_RPC_URL || "https://public-node.testnet.rsk.co",
            chainId: 31,
            gasPrice: 60000000,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: {
            // Blockscout doesn't require an actual API key, but Hardhat expects this property.
            rskTestnet: "any_string"
        },
        customChains: [
            {
                network: "rskTestnet",
                chainId: 31,
                urls: {
                    apiURL: "https://rootstock-testnet.blockscout.com/api",
                    browserURL: "https://rootstock-testnet.blockscout.com/"
                }
            }
        ]
    }
};

export default config;
