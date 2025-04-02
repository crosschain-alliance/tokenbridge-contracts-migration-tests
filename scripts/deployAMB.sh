#!/bin/bash

# Exit on error
set -e

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm use

# Install dependencies
npm install

# Update Git submodules
git submodule update --init

# Switch to the correct branch in tokenbridge-contracts
cd tokenbridge-contracts

echo "Switch to branch feat/hashi-integration-amb"

git switch feat/hashi-integration-amb

echo "Check out to commit: " $(git log -1 --pretty=oneline)

cd ..

# Compile the project
npx hardhat compile

echo "Deploying AMB on Ethereum"

npx hardhat deploy:ForeignAMB --network mainnet

echo "Deploying AMB on Gnosis Chain"

npx hardhat deploy:HomeAMB --network gnosis
