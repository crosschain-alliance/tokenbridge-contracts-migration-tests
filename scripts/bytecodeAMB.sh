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

echo "Switch to branch feat/hashi-integration-amb"

git switch feat/hashi-integration-amb

echo "Check out to commit: " $(git log -1 --pretty=oneline)

cd ..

npx hardhat compile

# Paths to bytecode files
FOREIGNAMB_JSON="artifacts/tokenbridge-contracts/contracts/upgradeable_contracts/arbitrary_message/ForeignAMB.sol/ForeignAMB.json"
HOMEAMB_JSON="artifacts/tokenbridge-contracts/contracts/upgradeable_contracts/arbitrary_message/HomeAMB.sol/HomeAMB.json"

# Extract deployed bytecode
FOREIGNAMB_BYTECODE=$(jq -r '.deployedBytecode' "$FOREIGNAMB_JSON")
HOMEAMB_BYTECODE=$(jq -r '.deployedBytecode' "$HOMEAMB_JSON")


cat <<EOF > deployBytecode_AMB.json
{
  "ForeignAMB deployedBytecode": "$FOREIGNAMB_BYTECODE",
  "HomeAMB deployedBytecode": "$HOMEAMB_BYTECODE"
}
EOF

echo "Output written to deployBytecode_AMB.json"