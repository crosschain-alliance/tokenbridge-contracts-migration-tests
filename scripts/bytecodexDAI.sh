#!/bin/bash

# Exit on error
set -e

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm use

npm install

git submodule update --init

cd tokenbridge-contracts

echo "Switch to branch feat/hashi-integration-xdai-bridge"

git switch feat/hashi-integration-xdai-bridge

echo "Check out to commit: " $(git log -1 --pretty=oneline)

cd ..

npx hardhat compile

# Paths to bytecode files
XDaiBridge_JSON="artifacts/tokenbridge-contracts/contracts/upgradeable_contracts/erc20_to_native/xDaiForeignBridge.sol/xDaiForeignBridge.json"
HomeBridge_JSON="artifacts/tokenbridge-contracts/contracts/upgradeable_contracts/erc20_to_native/HomeBridgeErcToNative.sol/HomeBridgeErcToNative.json"

# Extract deployed bytecode
XDaiBridge_BYTECODE=$(jq -r '.deployedBytecode' "$XDaiBridge_JSON")
HomeBridge_BYTECODE=$(jq -r '.deployedBytecode' "$HomeBridge_JSON")


cat <<EOF > deployBytecode_xDAIBridge.json
{
  "xDaiForeignBridge deployedBytecode": "$XDaiBridge_BYTECODE",
  "HomeErcToNative deployedBytecode": "$HomeBridge_BYTECODE"
}
EOF

echo "Output written to deployBytecode_xDAIBridge.json"