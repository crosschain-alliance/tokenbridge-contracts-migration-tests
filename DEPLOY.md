# Deploy task

## Setup project

```
nvm use
npm install
git submodule update --init
```

## Deployment

1. AMB: `npm deploy:amb`
2. xDAI:`npm deploy:xdai`
3. Hashi Manager: `npx hardhat deploy:HashiManager --network <Network name>`

## Generate the deployBytecode

To generate the deployedBytecode for verification purpose, run the following command:

1. AMB: `npm run bytecode:amb`
2. xDAI: `npm run bytecode:xdai`
3. HashiManager: `npm run bytecode:hashimanager`

The deployed bytecode will be written into `deployedBytecode_AMB.json`, or `deployedBytecode_xDAU.json` respectively.

# Common Error

1. Error
   ` Unsupported platform for @nomicfoundation/edr-darwin-x64@0.3.4: wanted {"os":"darwin","cpu":"x64"} (current: {"os":"darwin","cpu":"arm64"})`  
   In `package.json`, change to `@nomicfoundation/edr-darwin-arm64`
