const { task } = require("hardhat/config")
const { packSignatures, signatureToVrs, append0 } = require("../test/utils/index")
const { decodeHashiMessage } = require("./utils/hashi")

const FOREIGN_XDAI_PROXY_ADDRESS = "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016"
const FOREIGN_OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const FOREIGN_BRIDGE_VALIDATOR_ADDRESS = "0xe1579dEbdD2DF16Ebdb9db8694391fa74EeA201E"
const FOREIGN_HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const DAI_FAUCET_ADDRESS = "0x6FF8E4DB500cBd77d1D181B8908E022E29e0Ec4A"

const HOME_XDAI_PROXY_ADDRESS = "0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6"
const HOME_PROXY_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_ADDRESS = "0xb289f0e6fbdff8eee340498a56e1787b303f1b6d"
const HOME_HASHI_TARGET_CHAIN_ID = 1

const MESSAGE_DISPATCHED_TOPIC = "0x218247aabc759e65b5bb92ccc074f9d62cd187259f2a0984c3c9cf91f67ff7cf"
const USER_REQUEST_FOR_AFFIRMATION_TOPIC = "0xf6968e689b3d8c24f22c10c2a3256bb5ca483a474e11bac08423baa049e38ae8"
const USER_REQUEST_FOR_SIGNATURE_TOPIC = "0xbcb4ebd89690a7455d6ec096a6bfc4a8a891ac741ffe4e678ea2614853248658"
const ADDED_RECEIVER_TOPIC = "0x3c798bbcf33115b42c728b8504cff11dd58736e9fa789f1cda2738db7d696b2a"

/**
 * How to run this:
 * - npx hardhat node --fork <your-ethereum-node>
 * - npx hardhat node --fork <your-gnosis-node> --port 8544
 * - npx hardhat XDAIBridge:e2e --network fmainnet
 *
 * Note: be sure to set the optimizer runs = 100
 */
task("XDAIBridge:e2e").setAction(async (_taskArgs, hre) => {
  const { ethers, network } = hre
  const abiCoder = new ethers.AbiCoder()

  let ForeignBridgeErcToNative = await ethers.getContractFactory("ForeignBridgeErcToNative")
  let OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
  let BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  let MockYaho = await ethers.getContractFactory("MockYaho")
  let MockYaru = await ethers.getContractFactory("MockYaru")
  let Token = await ethers.getContractFactory("Token")

  // M A I N N E T
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [FOREIGN_OWNER_ADDRESS],
  })
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [DAI_FAUCET_ADDRESS],
  })

  const foreignProxyOwner = await ethers.provider.getSigner(FOREIGN_OWNER_ADDRESS)
  const daiFaucet = await ethers.provider.getSigner(DAI_FAUCET_ADDRESS)

  signers = await ethers.getSigners()
  const foreignOwner = signers[0]
  const foreignFakeReporter1 = signers[2]
  const foreignFakeAdapter1 = signers[3]
  const foreignFakeReporter2 = signers[4]
  const foreignFakeAdapter2 = signers[5]
  const foreignValidator1 = signers[6]
  const foreignValidator2 = signers[7]

  await foreignOwner.sendTransaction({
    to: FOREIGN_OWNER_ADDRESS,
    value: ethers.parseEther("1"),
  })

  const foreignProxy = await OwnedUpgradeabilityProxy.attach(FOREIGN_XDAI_PROXY_ADDRESS)
  foreignBridgeValidators = await BridgeValidators.attach(FOREIGN_BRIDGE_VALIDATOR_ADDRESS)

  foreignBridgeErcToNative = await ForeignBridgeErcToNative.deploy()
  await foreignProxy.connect(foreignProxyOwner).upgradeTo("9", await foreignBridgeErcToNative.getAddress())
  foreignBridgeErcToNative = ForeignBridgeErcToNative.attach(await foreignProxy.getAddress())

  foreignYaho = await MockYaho.deploy()
  foreignYaru = await MockYaru.deploy(FOREIGN_HASHI_TARGET_CHAIN_ID)

  await foreignBridgeErcToNative.connect(foreignProxyOwner).setHashiTargetChainId(FOREIGN_HASHI_TARGET_CHAIN_ID)
  await foreignBridgeErcToNative.connect(foreignProxyOwner).setHashiThreshold(HASHI_THRESHOLD)
  await foreignBridgeErcToNative
    .connect(foreignProxyOwner)
    .setHashiReporters([foreignFakeReporter1.address, foreignFakeReporter2.address])
  await foreignBridgeErcToNative
    .connect(foreignProxyOwner)
    .setHashiAdapters([foreignFakeAdapter1.address, foreignFakeAdapter2.address])
  await foreignBridgeErcToNative.connect(foreignProxyOwner).setYaho(await foreignYaho.getAddress())
  await foreignBridgeErcToNative.connect(foreignProxyOwner).setYaru(await foreignYaru.getAddress())

  // NOTE: Add fake validators in order to be able to sign the message
  await foreignBridgeValidators.connect(foreignProxyOwner).addValidator(foreignValidator1.address)
  await foreignBridgeValidators.connect(foreignProxyOwner).addValidator(foreignValidator2.address)
  await foreignBridgeValidators.connect(foreignProxyOwner).setRequiredSignatures(2)

  dai = await Token.attach(DAI_ADDRESS)
  await dai.connect(daiFaucet).transfer(foreignOwner.address, ethers.parseUnits("100000", 18))

  // G N O S I S
  await hre.changeNetwork("fgnosis")
  ForeignBridgeErcToNative = await ethers.getContractFactory("ForeignBridgeErcToNative")
  OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
  BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  MockYaho = await ethers.getContractFactory("MockYaho")
  MockYaru = await ethers.getContractFactory("MockYaru")
  Token = await ethers.getContractFactory("Token")

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [HOME_PROXY_OWNER_ADDRESS],
  })
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS],
  })

  const homeProxyOwner = await ethers.provider.getSigner(HOME_PROXY_OWNER_ADDRESS)
  const homeBridgeValidatorOwner = await ethers.provider.getSigner(HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS)

  signers = await ethers.getSigners()
  const homeOwner = signers[0]
  const homeReceiver = signers[1]
  const homeFakeReporter1 = signers[2]
  const homeFakeAdapter1 = signers[3]
  const homeFakeReporter2 = signers[4]
  const homeFakeAdapter2 = signers[5]
  const homeValidator1 = signers[6]
  const homeValidator2 = signers[7]

  await homeOwner.sendTransaction({
    to: HOME_PROXY_OWNER_ADDRESS,
    value: ethers.parseEther("1"),
  })
  await homeOwner.sendTransaction({
    to: HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS,
    value: ethers.parseEther("1"),
  })

  HomeBridgeErcToNative = await ethers.getContractFactory("HomeBridgeErcToNative")
  OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
  BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  MockYaho = await ethers.getContractFactory("MockYaho")
  MockYaru = await ethers.getContractFactory("MockYaru")

  homeProxy = await OwnedUpgradeabilityProxy.attach(HOME_XDAI_PROXY_ADDRESS)
  homeBridgeValidators = await BridgeValidators.attach(HOME_BRIDGE_VALIDATOR_ADDRESS)

  homeBridgeErcToNative = await HomeBridgeErcToNative.deploy()
  await homeProxy.connect(homeProxyOwner).upgradeTo("6", await homeBridgeErcToNative.getAddress())
  homeBridgeErcToNative = HomeBridgeErcToNative.attach(await homeProxy.getAddress())

  homeYaho = await MockYaho.deploy()
  homeYaru = await MockYaru.deploy(HOME_HASHI_TARGET_CHAIN_ID)

  await homeBridgeErcToNative.connect(homeProxyOwner).setHashiTargetChainId(HOME_HASHI_TARGET_CHAIN_ID)
  await homeBridgeErcToNative.connect(homeProxyOwner).setHashiThreshold(HASHI_THRESHOLD)
  await homeBridgeErcToNative
    .connect(homeProxyOwner)
    .setHashiReporters([homeFakeReporter1.address, homeFakeReporter2.address])
  await homeBridgeErcToNative
    .connect(homeProxyOwner)
    .setHashiAdapters([homeFakeAdapter1.address, homeFakeAdapter2.address])
  await homeBridgeErcToNative.connect(homeProxyOwner).setYaho(await homeYaho.getAddress())
  await homeBridgeErcToNative.connect(homeProxyOwner).setYaru(await homeYaru.getAddress())

  // NOTE: Add fake validators in order to be able to sign the message
  await homeBridgeValidators.connect(homeBridgeValidatorOwner).addValidator(homeValidator1.address)
  await homeBridgeValidators.connect(homeBridgeValidatorOwner).addValidator(homeValidator2.address)
  await homeBridgeValidators.connect(homeBridgeValidatorOwner).setRequiredSignatures(2)

  await foreignBridgeErcToNative
    .connect(foreignProxyOwner)
    .setHashiTargetAddress(await homeBridgeErcToNative.getAddress())
  await homeBridgeErcToNative.connect(homeProxyOwner).setHashiTargetAddress(await foreignBridgeErcToNative.getAddress())

  // E T H E R E U M   --->   G N O S I S
  await hre.changeNetwork("fmainnet")

  const amount = ethers.parseUnits("10", 18)
  await dai.approve(await foreignBridgeErcToNative.getAddress(), amount)
  let tx = await foreignBridgeErcToNative.relayTokens(homeReceiver.address, amount)
  let receipt = await tx.wait(1)
  const { args: foreignArgs } = receipt.logs.find((_log) => _log.topics[0] === USER_REQUEST_FOR_AFFIRMATION_TOPIC)
  const { data: foreignHashiMessage } = receipt.logs.find((_log) => _log.topics[0] === MESSAGE_DISPATCHED_TOPIC)

  await hre.changeNetwork("fgnosis")
  await homeBridgeErcToNative.connect(homeValidator1).executeAffirmation(...foreignArgs)
  await homeBridgeErcToNative.connect(homeValidator2).executeAffirmation(...foreignArgs)
  tx = await homeYaru.executeMessages([decodeHashiMessage(foreignHashiMessage, { abiCoder })])
  receipt = await tx.wait()
  const addedReceiverLog = receipt.logs.find((_log) => _log.topics[0] === ADDED_RECEIVER_TOPIC)
  if (!addedReceiverLog) throw new Error("Ops, AddedReceiver not found")
  console.log("Ethereum -> Gnosis OK")

  // G N O S I S   --->   E T H E R E U M
  tx = await homeOwner.sendTransaction({
    to: await homeBridgeErcToNative.getAddress(),
    value: amount,
  })
  receipt = await tx.wait()
  const { data: homeMessage } = receipt.logs.find((_log) => _log.topics[0] === USER_REQUEST_FOR_SIGNATURE_TOPIC)
  const { data: homeHashiMessage } = receipt.logs.find((_log) => _log.topics[0] === MESSAGE_DISPATCHED_TOPIC)

  const [receiver, value, nonce] = abiCoder.decode(["address", "uint256", "bytes32"], homeMessage)
  const homeMessageToSign = ethers.solidityPacked(
    ["address", "uint256", "bytes32", "address"],
    [receiver, value, nonce, await foreignBridgeErcToNative.getAddress()],
  )

  const signatures = await Promise.all(
    [homeValidator1, homeValidator2].map((_validator) => _validator.signMessage(ethers.toBeArray(homeMessageToSign))),
  )

  await Promise.all(
    [homeValidator1, homeValidator2].map((_validator, _index) =>
      homeBridgeErcToNative.connect(_validator).submitSignature(signatures[_index], homeMessageToSign),
    ),
  )

  await hre.changeNetwork("fmainnet")
  const balancePre = await dai.balanceOf(homeOwner.address)
  await foreignYaru.executeMessages([decodeHashiMessage(homeHashiMessage, { abiCoder })])
  await foreignBridgeErcToNative.executeSignatures(
    homeMessageToSign,
    packSignatures(signatures.map((_sig) => signatureToVrs(_sig))),
  )
  const balancePost = await dai.balanceOf(homeOwner.address)
  if (balancePre + BigInt(amount.toString()) != balancePost) throw new Error("Ops, someting weird happened")
  console.log("Gnosis -> Ethereum OK")
})
