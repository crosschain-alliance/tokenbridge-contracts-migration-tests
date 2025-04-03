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
HashiManager_JSON="artifacts/tokenbridge-contracts/contracts/upgradeable_contracts/HashiManager.sol/HashiManager.json"

# Extract deployed bytecode
HashiManager_BYTECODE=$(jq -r '.deployedBytecode' "$HashiManager_JSON")


cat <<EOF > deployBytecode_HashiManager.json
{
  "HashiManager deployedBytecode": "$HashiManager_BYTECODE"
}
EOF

echo "Output written to deployBytecode_HashiManager.json"