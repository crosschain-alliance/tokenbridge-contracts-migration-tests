const { task } = require("hardhat/config")

const { packSignatures, signatureToVrs } = require("../test/utils/index")
const { decodeHashiMessage, getRelevantDataFromEvents, getValidatorsSignatures } = require("./utils/index")

const FOREIGN_AMB_PROXY_ADDRESS = "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e"
const FOREIGN_OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const FOREIGN_BRIDGE_VALIDATOR_ADDRESS = "0xed84a648b3c51432ad0fD1C2cD2C45677E9d4064"
const FOREIGN_HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2

const HOME_AMB_PROXY_ADDRESS = "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59"
const HOME_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_ADDRESS = "0xa280fed8d7cad9a76c8b50ca5c33c2534ffa5008"
const HOME_HASHI_TARGET_CHAIN_ID = 1

const USER_REQUEST_FOR_AFFIRMATION_TOPIC = "0x482515ce3d9494a37ce83f18b72b363449458435fafdd7a53ddea7460fe01b58"
const USER_REQUEST_FOR_SIGNATURE_TOPIC = "0x520d2afde79cbd5db58755ac9480f81bc658e5c517fcae7365a3d832590b0183"

const PING_PONG_NONCE = 1

/**
 * How to run this:
 * - npx hardhat node --fork <your-ethereum-node>
 * - npx hardhat node --fork <your-gnosis-node> --port 8544
 * - npx hardhat AMB:e2e --network fmainnet
 */
task("AMB:e2e").setAction(async (_taskArgs, hre) => {
  const { ethers, network } = hre
  const abiCoder = new ethers.AbiCoder()

  let ForeignAMB = await ethers.getContractFactory("ForeignAMB")
  let OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
  let BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  let HashiManager = await ethers.getContractFactory("HashiManager")
  let EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
  let MockYaho = await ethers.getContractFactory("MockYaho")
  let MockYaru = await ethers.getContractFactory("MockYaru")
  let PingPong = await ethers.getContractFactory("PingPong")

  // M A I N N E T
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
  const foreignValidator1 = foreignSigners[6]
  const foreignValidator2 = foreignSigners[7]

  const foreignProxy = await OwnedUpgradeabilityProxy.attach(FOREIGN_AMB_PROXY_ADDRESS)
  const foreignBridgeValidators = await BridgeValidators.attach(FOREIGN_BRIDGE_VALIDATOR_ADDRESS)

  let foreignAmb = await ForeignAMB.deploy()
  await foreignProxy.connect(foreignProxyOwner).upgradeTo("6", await foreignAmb.getAddress())
  foreignAmb = ForeignAMB.attach(await foreignProxy.getAddress())

  const foreignYaho = await MockYaho.deploy()
  const foreignYaru = await MockYaru.deploy(FOREIGN_HASHI_TARGET_CHAIN_ID)
  const foreignPingPong = await PingPong.deploy(await foreignAmb.getAddress())

  foreignHashiManager = await EternalStorageProxy.deploy()
  const foreignHashiManagerImp = await HashiManager.deploy()
  await foreignHashiManager.upgradeTo("1", await foreignHashiManagerImp.getAddress())
  await foreignHashiManager.transferProxyOwnership(foreignProxyOwner.address)
  foreignHashiManager = await HashiManager.attach(await foreignHashiManager.getAddress())
  await foreignHashiManager.connect(foreignProxyOwner).initialize(foreignProxyOwner.address)
  await foreignAmb.connect(foreignProxyOwner).setHashiManager(await foreignHashiManager.getAddress())
  await foreignHashiManager.connect(foreignProxyOwner).setTargetChainId(FOREIGN_HASHI_TARGET_CHAIN_ID)
  await foreignHashiManager.connect(foreignProxyOwner).setExpectedThreshold(HASHI_THRESHOLD)
  await foreignHashiManager.connect(foreignProxyOwner).setYaho(await foreignYaho.getAddress())

  // NOTE: Add fake validators in order to be able to sign the message
  await foreignBridgeValidators.connect(foreignProxyOwner).addValidator(foreignValidator1.address)
  await foreignBridgeValidators.connect(foreignProxyOwner).addValidator(foreignValidator2.address)
  await foreignBridgeValidators.connect(foreignProxyOwner).setRequiredSignatures(2)

  // G N O S I S
  await hre.changeNetwork("fgnosis")

  let HomeAMB = await ethers.getContractFactory("HomeAMB")
  OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
  BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  HashiManager = await ethers.getContractFactory("HashiManager")
  EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
  MockYaho = await ethers.getContractFactory("MockYaho")
  MockYaru = await ethers.getContractFactory("MockYaru")
  PingPong = await ethers.getContractFactory("PingPong")

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [HOME_OWNER_ADDRESS],
  })

  const homeProxyOwner = await ethers.provider.getSigner(HOME_OWNER_ADDRESS)
  let homeSigners = await ethers.getSigners()
  const homeFakeReporter1 = homeSigners[12]
  const homeFakeAdapter1 = homeSigners[13]
  const homeFakeReporter2 = homeSigners[14]
  const homeFakeAdapter2 = homeSigners[1]
  const homeValidator1 = homeSigners[6]
  const homeValidator2 = homeSigners[7]

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
  const homePingPong = await PingPong.deploy(await homeAmb.getAddress())

  homeHashiManager = await EternalStorageProxy.deploy()
  const homeHashiManagerImp = await HashiManager.deploy()
  await homeHashiManager.upgradeTo("1", await homeHashiManagerImp.getAddress())
  await homeHashiManager.transferProxyOwnership(homeProxyOwner.address)
  homeHashiManager = await HashiManager.attach(await homeHashiManager.getAddress())
  await homeHashiManager.connect(homeProxyOwner).initialize(homeProxyOwner.address)
  await homeAmb.connect(homeProxyOwner).setHashiManager(await homeHashiManager.getAddress())
  await homeHashiManager.connect(homeProxyOwner).setTargetChainId(HOME_HASHI_TARGET_CHAIN_ID)
  await homeHashiManager.connect(homeProxyOwner).setExpectedThreshold(HASHI_THRESHOLD)
  await homeHashiManager
    .connect(homeProxyOwner)
    .setReportersAdaptersAndThreshold(
      [homeFakeReporter1.address, homeFakeReporter2.address],
      [foreignFakeAdapter1.address, foreignFakeAdapter2.address],
      HASHI_THRESHOLD,
    )
  await homeHashiManager.connect(homeProxyOwner).setYaho(await homeYaho.getAddress())
  await homeHashiManager
    .connect(homeProxyOwner)
    .setExpectedAdaptersHash([homeFakeAdapter1.address, homeFakeAdapter2.address])

  // NOTE: Add fake validators in order to be able to sign the message
  await homeBridgeValidators.connect(homeProxyOwner).addValidator(homeValidator1.address)
  await homeBridgeValidators.connect(homeProxyOwner).addValidator(homeValidator2.address)
  await homeBridgeValidators.connect(homeProxyOwner).setRequiredSignatures(2)

  // NOTE: linking the 2 amb contracts
  await foreignHashiManager.connect(foreignProxyOwner).setTargetAddress(await homeAmb.getAddress())
  await homeHashiManager.connect(homeProxyOwner).setTargetAddress(await foreignAmb.getAddress())

  // E T H E R E U M   --->   G N O S I S
  await hre.changeNetwork("fmainnet")
  await foreignHashiManager
    .connect(foreignProxyOwner)
    .setReportersAdaptersAndThreshold(
      [foreignFakeReporter1.address, foreignFakeReporter2.address],
      [homeFakeAdapter1.address, homeFakeAdapter2.address],
      HASHI_THRESHOLD,
    )
  await foreignHashiManager
    .connect(foreignProxyOwner)
    .setExpectedAdaptersHash([foreignFakeAdapter1.address, foreignFakeAdapter2.address])

  await foreignHashiManager.connect(foreignProxyOwner).setYaru(await foreignYaru.getAddress())
  await foreignPingPong.setTargetPingPong(await homePingPong.getAddress())
  let tx = await foreignPingPong.ping(1)
  const {
    hashiMessage: foreignHashiMessage,
    decodedMessage: decodedForeignMessage,
    messageId: foreignMessageId,
  } = getRelevantDataFromEvents({
    receipt: await tx.wait(1),
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
    abiCoder,
    ethers,
  })

  await hre.changeNetwork("fgnosis")
  await homeHashiManager.connect(homeProxyOwner).setYaru(await homeYaru.getAddress())
  await homePingPong.setTargetPingPong(await foreignPingPong.getAddress())

  await homeYaru.executeMessages([decodeHashiMessage(foreignHashiMessage, { abiCoder })])
  if (!(await homeAmb.isApprovedByHashi(foreignMessageId))) throw new Error("Hashi didn't execute the message")
  await homeAmb.connect(homeValidator1).executeAffirmation(decodedForeignMessage)
  await homeAmb.connect(homeValidator2).executeAffirmation(decodedForeignMessage)

  let lastReceivedNonce = await homePingPong.lastReceivedNonce()
  if (parseInt(lastReceivedNonce) !== PING_PONG_NONCE) throw new Error("Ops, lastReceivedNonce != PING_PONG_NONCE")
  console.log("Ethereum -> Gnosis OK")

  // G N O S I S   --->   E T H E R E U M
  tx = await homePingPong.ping(PING_PONG_NONCE)
  const {
    hashiMessage: homeHashiMessage,
    decodedMessage: decodedHomeMessage,
    messageId: homeMessageId,
  } = getRelevantDataFromEvents({
    receipt: await tx.wait(1),
    topic: USER_REQUEST_FOR_SIGNATURE_TOPIC,
    abiCoder,
    ethers,
  })

  signatures = await getValidatorsSignatures({
    message: decodedHomeMessage,
    validators: [homeValidator1, homeValidator2],
  })
  await Promise.all(
    [homeValidator1, homeValidator2].map((_validator, _index) =>
      homeAmb.connect(_validator).submitSignature(signatures[_index], decodedHomeMessage),
    ),
  )

  await hre.changeNetwork("fmainnet")
  // NOTE: if Hashi is enabled the handleMessage fx is invoked with Hashi message execution
  await foreignYaru.executeMessages([decodeHashiMessage(homeHashiMessage, { abiCoder })])
  if (!(await foreignAmb.isApprovedByHashi(homeMessageId))) throw new Error("Hashi didn't execute the message")
  let packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))
  await foreignAmb.executeSignatures(decodedHomeMessage, packedSignatures)
  lastReceivedNonce = await foreignPingPong.lastReceivedNonce()
  if (parseInt(lastReceivedNonce) !== PING_PONG_NONCE) throw new Error("Ops, lastReceivedNonce != PING_PONG_NONCE")
  console.log("Gnosis -> Ethereum OK")

  // R E S E N D   E X I S T I N G   M E S S A G E        E T H E R E U M   --->   G N O S I S
  await hre.changeNetwork("fmainnet")
  tx = await foreignPingPong.ping(PING_PONG_NONCE + 1)
  const { decodedMessage: decodedForeignMessage2, messageId: foreignMessageId2 } = getRelevantDataFromEvents({
    receipt: await tx.wait(1),
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
    abiCoder,
    ethers,
  })

  // NOTE: At this point adapters on Gnosis go down so we need to change them
  await hre.changeNetwork("fgnosis")
  homeSigners = await ethers.getSigners()
  const homeFakeAdapter3 = homeSigners[17]
  const homeFakeAdapter4 = homeSigners[18]
  await homeHashiManager
    .connect(homeProxyOwner)
    .setExpectedAdaptersHash([homeFakeAdapter3.address, homeFakeAdapter4.address])
  await hre.changeNetwork("fmainnet")
  await foreignHashiManager
    .connect(foreignProxyOwner)
    .setReportersAdaptersAndThreshold(
      [foreignFakeReporter1.address, foreignFakeReporter2.address],
      [homeFakeAdapter3.address, homeFakeAdapter4.address],
      HASHI_THRESHOLD,
    )

  // NOTE: once they have been changed, we need to resendDataWithHashi
  tx = await foreignAmb.resendDataWithHashi(decodedForeignMessage2)
  const { hashiMessage: foreignHashiMessage3 } = getRelevantDataFromEvents({
    onlyHashiMessage: true,
    receipt: await tx.wait(1),
    abiCoder,
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
    ethers,
  })

  await hre.changeNetwork("fgnosis")
  await homeYaru.executeMessages([decodeHashiMessage(foreignHashiMessage3, { abiCoder })])
  if (!(await homeAmb.isApprovedByHashi(foreignMessageId2))) throw new Error("Hashi didn't execute the message")
  await homeAmb.connect(homeValidator1).executeAffirmation(decodedForeignMessage2)
  await homeAmb.connect(homeValidator2).executeAffirmation(decodedForeignMessage2)

  lastReceivedNonce = await homePingPong.lastReceivedNonce()
  if (parseInt(lastReceivedNonce) !== PING_PONG_NONCE + 1) throw new Error("Ops, lastReceivedNonce != PING_PONG_NONCE")
  console.log("Ethereum -> Gnosis OK (resendDataWithHashi)")

  // R E S E N D   E X I S T I N G   M E S S A G E        G N O S I S   --->   E T H E R E U M
  tx = await homePingPong.ping(PING_PONG_NONCE + 1)
  const { decodedMessage: decodedHomeMessage4, messageId: homeMessageId4 } = getRelevantDataFromEvents({
    receipt: await tx.wait(1),
    topic: USER_REQUEST_FOR_SIGNATURE_TOPIC,
    abiCoder,
    ethers,
  })

  signatures = await getValidatorsSignatures({
    message: decodedHomeMessage4,
    validators: [homeValidator1, homeValidator2],
  })
  await Promise.all(
    [homeValidator1, homeValidator2].map((_validator, _index) =>
      homeAmb.connect(_validator).submitSignature(signatures[_index], decodedHomeMessage4),
    ),
  )
  // NOTE: At this point adapters on Mainnet go down so we need to change them
  await hre.changeNetwork("fmainnet")
  homeSigners = await ethers.getSigners()
  const foreignFakeAdapter3 = homeSigners[17]
  const foreignFakeAdapter4 = homeSigners[18]
  await foreignHashiManager
    .connect(foreignProxyOwner)
    .setExpectedAdaptersHash([foreignFakeAdapter3.address, foreignFakeAdapter4.address])
  await hre.changeNetwork("fgnosis")
  await homeHashiManager
    .connect(homeProxyOwner)
    .setReportersAdaptersAndThreshold(
      [homeFakeReporter1.address, homeFakeReporter2.address],
      [foreignFakeAdapter3.address, foreignFakeAdapter4.address],
      HASHI_THRESHOLD,
    )

  // NOTE: once they have been changed, we need to resendDataWithHashi
  tx = await homeAmb.resendDataWithHashi(decodedHomeMessage4)
  const { hashiMessage: homeHashiMessage3 } = getRelevantDataFromEvents({
    onlyHashiMessage: true,
    receipt: await tx.wait(1),
    abiCoder,
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
    ethers,
  })

  await hre.changeNetwork("fmainnet")
  await foreignYaru.executeMessages([decodeHashiMessage(homeHashiMessage3, { abiCoder })])
  if (!(await foreignAmb.isApprovedByHashi(homeMessageId4))) throw new Error("Hashi didn't execute the message")
  packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))
  await foreignAmb.executeSignatures(decodedHomeMessage4, packedSignatures)
  lastReceivedNonce = await foreignPingPong.lastReceivedNonce()
  if (parseInt(lastReceivedNonce) !== PING_PONG_NONCE + 1) throw new Error("Ops, lastReceivedNonce != PING_PONG_NONCE")
  console.log("Gnosis -> Ethereum OK (resendDataWithHashi)")
})
