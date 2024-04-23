# tokenbridge-contracts-migration-tests

Gnosis Bridge Hashi integration tests.

&nbsp;

---

&nbsp;

## Dependencies

```bash
git submodule init
git submodule update
npm install
```

&nbsp;

---

&nbsp;


## E2E test

### AMB

```bash
cd tokenbridge-contracts
git checkout feat/hashi-integration-amb
cd ..
npx hardhat compile
npx hardhat node --fork <your-ethereum-node>
npx hardhat node --fork <your-gnosis-node> --port 8544
npx hardhat AMB:e2e --network fmainnet
```

### xDAI Bridge

```bash
cd tokenbridge-contracts
git checkout feat/hashi-integration-xdai-bridge
cd ..
npx hardhat compile
npx hardhat node --fork <your-ethereum-node>
npx hardhat node --fork <your-gnosis-node> --port 8544
npx hardhat XDAIBridge:e2e --network fmainnet
```
