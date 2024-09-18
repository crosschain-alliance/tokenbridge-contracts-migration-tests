# Deploy task

## Setup project

```
nvm use
npm install
git submodule update --init
```

## Deploy AMB

```
cd tokenbridge-contracts
git switch feat/hashi-integration-amb
cd ..
npx hardhat compile
npx hardhat deploy:ForeignAMB --network mainnet
npx hardhat deploy:HomeAMB --network gnosis
```

## Deploy xDAI

```
cd tokenbridge-contracts
git switch feat/hashi-integration-xdai-bridge
cd ..
npx hardhat compile
npx hardhat deploy:ForeignxDAIBridge--network mainnet
npx hardhat deploy:HomexDAIBridge --network gnosis
```

## Deploy HashiManager

```
npx hardhat compile
npx hardhat deploy:HashiManager --network <Network name>
```
