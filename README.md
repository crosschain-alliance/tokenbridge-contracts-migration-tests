# tokenbridge-contracts-migration-tests

## How to e2e test AMB

```bash
cd tokenbridge-contracts
git checkout feat/hashi-integration-amb
cd ..
npx hardhat compile
npx hardhat node --fork <your-ethereum-node>
npx hardhat node --fork <your-gnosis-node> --port 8544
npx hardhat AMB:e2e --network fmainnet
```

## How to e2e test XDAI bridge

```bash
cd tokenbridge-contracts
git checkout feat/hashi-integration-xdai-bridge
cd ..
npx hardhat compile
npx hardhat node --fork <your-ethereum-node>
npx hardhat node --fork <your-gnosis-node> --port 8544
npx hardhat XDAIBridge:e2e --network fmainnet
```
