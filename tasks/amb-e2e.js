const { task } = require("hardhat/config")

const FOREIGN_AMB_PROXY_ADDRESS = "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e"
const FOREIGN_OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const FOREIGN_BRIDGE_VALIDATOR_ADDRESS = "0xed84a648b3c51432ad0fD1C2cD2C45677E9d4064"
const FOREIGN_HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2

const HOME_AMB_PROXY_ADDRESS = "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59"
const HOME_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_ADDRESS = "0xa280fed8d7cad9a76c8b50ca5c33c2534ffa5008"
const HOME_HASHI_TARGET_CHAIN_ID = 1

const MESSAGE_DISPATCHED_TOPIC = "0x218247aabc759e65b5bb92ccc074f9d62cd187259f2a0984c3c9cf91f67ff7cf"
const USER_REQUEST_FOR_AFFIRMATION_TOPIC = "0x482515ce3d9494a37ce83f18b72b363449458435fafdd7a53ddea7460fe01b58"

const PING_PONG_NONCE = 1

/**
 * How to run this:
 * - npx hardhat node --fork <your-ethereum-node>
 * - npx hardhat node --fork <your-gnosis-node> --port 8544
 * - npx hardhat AMB:e2e-foreign-to-home --network fmainnet
 */
task("AMB:e2e-foreign-to-home").setAction(async (_taskArgs, hre) => {
  const { ethers, network } = hre

  let ForeignAMB = await ethers.getContractFactory("ForeignAMB")
  let OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
  let BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  let MockYaho = await ethers.getContractFactory("MockYaho")
  let MockYaru = await ethers.getContractFactory("MockYaru")
  let PingPong = await ethers.getContractFactory("PingPong")

  // M A I N N E T
  await hre.changeNetwork("fmainnet")
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [FOREIGN_OWNER_ADDRESS],
  })

  const foreignProxyOwner = await ethers.provider.getSigner(FOREIGN_OWNER_ADDRESS)
  const foreignSigners = await ethers.getSigners()

  await foreignSigners[0].sendTransaction({
    to: FOREIGN_OWNER_ADDRESS,
    value: ethers.parseEther("1"),
  })

  const foreignFakeReporter1 = foreignSigners[2]
  const foreignFakeAdapter1 = foreignSigners[3]
  const foreignFakeReporter2 = foreignSigners[4]
  const foreignFakeAdapter2 = foreignSigners[5]
  const foreignValidator = foreignSigners[6]
  const foreignValidator2 = foreignSigners[7]

  const foreignProxy = await OwnedUpgradeabilityProxy.attach(FOREIGN_AMB_PROXY_ADDRESS)
  const foreignBridgeValidators = await BridgeValidators.attach(FOREIGN_BRIDGE_VALIDATOR_ADDRESS)

  let foreignAmb = await ForeignAMB.deploy()
  await foreignProxy.connect(foreignProxyOwner).upgradeTo("6", await foreignAmb.getAddress())
  foreignAmb = ForeignAMB.attach(await foreignProxy.getAddress())

  const foreignYaho = await MockYaho.deploy()
  const foreignYaru = await MockYaru.deploy(FOREIGN_HASHI_TARGET_CHAIN_ID)

  await foreignAmb.connect(foreignProxyOwner).setHashiTargetChainId(FOREIGN_HASHI_TARGET_CHAIN_ID)
  await foreignAmb.connect(foreignProxyOwner).setHashiThreshold(HASHI_THRESHOLD)
  await foreignAmb
    .connect(foreignProxyOwner)
    .setHashiReporters([foreignFakeReporter1.address, foreignFakeReporter2.address])
  await foreignAmb
    .connect(foreignProxyOwner)
    .setHashiAdapters([foreignFakeAdapter1.address, foreignFakeAdapter2.address])
  await foreignAmb.connect(foreignProxyOwner).setYaho(await foreignYaho.getAddress())
  await foreignAmb.connect(foreignProxyOwner).setYaru(await foreignYaru.getAddress())

  // NOTE: Add fake validators in order to be able to sign the message
  await foreignBridgeValidators.connect(foreignProxyOwner).addValidator(foreignValidator.address)
  await foreignBridgeValidators.connect(foreignProxyOwner).addValidator(foreignValidator2.address)
  await foreignBridgeValidators.connect(foreignProxyOwner).setRequiredSignatures(2)

  const foreignPingPong = await PingPong.deploy(await foreignAmb.getAddress())

  // G N O S I S
  await hre.changeNetwork("fgnosis")

  let HomeAMB = await ethers.getContractFactory("HomeAMB")
  OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
  BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  MockYaho = await ethers.getContractFactory("MockYaho")
  MockYaru = await ethers.getContractFactory("MockYaru")
  PingPong = await ethers.getContractFactory("PingPong")

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [HOME_OWNER_ADDRESS],
  })

  const homeProxyOwner = await ethers.provider.getSigner(HOME_OWNER_ADDRESS)
  const homeSigners = await ethers.getSigners()
  const homeFakeReporter1 = homeSigners[12]
  const homeFakeAdapter1 = homeSigners[13]
  const homeFakeReporter2 = homeSigners[14]
  const homeFakeAdapter2 = homeSigners[1]
  const homeValidator1 = homeSigners[16]
  const homeValidator2 = homeSigners[17]

  await homeSigners[0].sendTransaction({
    to: HOME_OWNER_ADDRESS,
    value: ethers.parseEther("1"),
  })
  const homeProxy = await OwnedUpgradeabilityProxy.attach(HOME_AMB_PROXY_ADDRESS)
  const homeBridgeValidators = await BridgeValidators.attach(HOME_BRIDGE_VALIDATOR_ADDRESS)

  let homeAmb = await HomeAMB.deploy()
  await homeProxy.connect(homeProxyOwner).upgradeTo("6", await homeAmb.getAddress())
  homeAmb = HomeAMB.attach(await homeProxy.getAddress())

  const homeYaho = await MockYaho.deploy()
  const homeYaru = await MockYaru.deploy(HOME_HASHI_TARGET_CHAIN_ID)

  await homeAmb.connect(homeProxyOwner).setHashiTargetChainId(HOME_HASHI_TARGET_CHAIN_ID)
  await homeAmb.connect(homeProxyOwner).setHashiThreshold(HASHI_THRESHOLD)
  await homeAmb.connect(homeProxyOwner).setHashiReporters([homeFakeReporter1.address, homeFakeReporter2.address])
  await homeAmb.connect(homeProxyOwner).setHashiAdapters([homeFakeAdapter1.address, homeFakeAdapter2.address])
  await homeAmb.connect(homeProxyOwner).setYaho(await homeYaho.getAddress())
  await homeAmb.connect(homeProxyOwner).setYaru(await homeYaru.getAddress())

  // NOTE: Add fake validators in order to be able to sign the message
  await homeBridgeValidators.connect(homeProxyOwner).addValidator(homeValidator1.address)
  await homeBridgeValidators.connect(homeProxyOwner).addValidator(homeValidator2.address)
  await homeBridgeValidators.connect(homeProxyOwner).setRequiredSignatures(2)

  // NOTE: linking the 2 amb contracts
  await foreignAmb.connect(foreignProxyOwner).setTargetAmb(await homeAmb.getAddress())
  await homeAmb.connect(homeProxyOwner).setTargetAmb(await foreignAmb.getAddress())

  const homePingPong = await PingPong.deploy(await homeAmb.getAddress())

  // E T H E R E U M   --->   G N O S I S
  await hre.changeNetwork("fmainnet")
  await foreignPingPong.setTargetPingPong(await homePingPong.getAddress())
  const tx = await foreignPingPong.ping(PING_PONG_NONCE)
  const receipt = await tx.wait(1)

  const { data: message } = receipt.logs.find((_log) => _log.topics[0] === USER_REQUEST_FOR_AFFIRMATION_TOPIC)
  const { data: hashiMessage } = receipt.logs.find((_log) => _log.topics[0] === MESSAGE_DISPATCHED_TOPIC)

  // G N O S I S   --->   E T H E R E U M
  await hre.changeNetwork("fgnosis")
  await homePingPong.setTargetPingPong(await foreignPingPong.getAddress())

  const abiCoder = new ethers.AbiCoder()

  const [decodedMessage] = abiCoder.decode(["bytes"], message)
  await homeAmb.connect(homeValidator1).executeAffirmation(decodedMessage)
  await homeAmb.connect(homeValidator2).executeAffirmation(decodedMessage)
  // NOTE: if Hashi is enabled the handleMessage fx is invoked with Hashi message execution
  const [[nonce, targetChainId, threshold, sender, receiver, data, reporters, adapters]] = abiCoder.decode(
    ["(uint256,uint256,uint256,address,address,bytes,address[],address[])"],
    hashiMessage,
  )
  if (decodedMessage !== data) throw new Error("messages don't match")

  await homeYaru.executeMessages([
    [
      nonce,
      targetChainId,
      threshold,
      sender,
      receiver,
      data,
      reporters.map((_reporter) => _reporter),
      adapters.map((_adapter) => _adapter),
    ],
  ])

  const lastReceivedNonce = await homePingPong.lastReceivedNonce()
  if (parseInt(lastReceivedNonce) !== PING_PONG_NONCE) throw new Error("Ops, lastReceivedNonce != PING_PONG_NONCE")
  console.log("ok")
})