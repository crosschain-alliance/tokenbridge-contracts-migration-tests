const { task } = require("hardhat/config")

const { packSignatures, signatureToVrs } = require("../test/utils/index")
const { decodeHashiMessage, getRelevantDataFromEvents, getValidatorsSignatures } = require("./utils/index")

const FOREIGN_AMB_PROXY_ADDRESS = "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e"
const FOREIGN_OMNIBRIDGE_PROXY_ADDRESS = "0x88ad09518695c6c3712AC10a214bE5109a655671"
const FOREIGN_OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const FOREIGN_BRIDGE_VALIDATOR_ADDRESS = "0xed84a648b3c51432ad0fD1C2cD2C45677E9d4064"

const FOREIGN_HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 1

const HOME_AMB_PROXY_ADDRESS = "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59"
const HOME_OMNIBRIDGE_PROXY_ADDRESS = "0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d"
const HOME_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_ADDRESS = "0xa280fed8d7cad9a76c8b50ca5c33c2534ffa5008"
const HOME_HASHI_TARGET_CHAIN_ID = 1

const USER_REQUEST_FOR_AFFIRMATION_TOPIC = "0x482515ce3d9494a37ce83f18b72b363449458435fafdd7a53ddea7460fe01b58"
const USER_REQUEST_FOR_SIGNATURE_TOPIC = "0x520d2afde79cbd5db58755ac9480f81bc658e5c517fcae7365a3d832590b0183"

const GNO_ADDRESS = "0x6810e776880c02933d47db1b9fc05908e5386b96"
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const WRAPPED_GNO = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb"

const GNO_WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC"

/**
 * How to run this:
 * - npx hardhat node --fork <your-ethereum-node>
 * - npx hardhat node --fork <your-gnosis-node> --port 8544
 * - npx hardhat Omnibridge:e2e --network fmainnet
 */
task("Omnibridge:e2e").setAction(async (_taskArgs, hre) => {
  const { ethers, network } = hre
  const abiCoder = new ethers.AbiCoder()

  let ForeignAMB = await ethers.getContractFactory("ForeignAMB")
  let BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  let HashiManager = await ethers.getContractFactory("HashiManager")
  let EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
  let MockYaho = await ethers.getContractFactory("MockYaho")
  let MockYaru = await ethers.getContractFactory("MockYaru")

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
    maxFeePerGas: 15562657581,
  })

  await foreignSigners[0].sendTransaction({
    to: GNO_WHALE,
    value: ethers.parseEther("1"),
    maxFeePerGas: 15562657581,
  })

  const foreignFakeReporter1 = foreignSigners[2]
  const foreignFakeAdapter1 = foreignSigners[3]
  const foreignFakeReporter2 = foreignSigners[4]
  const foreignFakeAdapter2 = foreignSigners[5]
  const foreignValidator1 = foreignSigners[6]
  const foreignValidator2 = foreignSigners[7]

  const gno = await ethers.getContractAt("IERC20", GNO_ADDRESS)
  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS)
  const usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS)
  const weth = await ethers.getContractAt("IERC20", WETH_ADDRESS)

  const foreignProxy = await EternalStorageProxy.attach(FOREIGN_AMB_PROXY_ADDRESS)
  const foreignBridgeValidators = await BridgeValidators.attach(FOREIGN_BRIDGE_VALIDATOR_ADDRESS)
  const foreignOmnibridge = await ethers.getContractAt("IForeignOmnibridge", FOREIGN_OMNIBRIDGE_PROXY_ADDRESS)

  let foreignAmb = await ForeignAMB.deploy()
  await foreignProxy.connect(foreignProxyOwner).upgradeTo("6", await foreignAmb.getAddress())
  foreignAmb = ForeignAMB.attach(await foreignProxy.getAddress())

  const foreignYaho = await MockYaho.deploy()
  const foreignYaru = await MockYaru.deploy(FOREIGN_HASHI_TARGET_CHAIN_ID)

  let foreignHashiManager = await EternalStorageProxy.deploy()
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

  console.log("Switching to Gnosis")

  let HomeAMB = await ethers.getContractFactory("HomeAMB")
  BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  HashiManager = await ethers.getContractFactory("HashiManager")
  EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
  MockYaho = await ethers.getContractFactory("MockYaho")
  MockYaru = await ethers.getContractFactory("MockYaru")

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [HOME_OWNER_ADDRESS],
  })

  const homeProxyOwner = await ethers.provider.getSigner(HOME_OWNER_ADDRESS)
  let homeSigners = await ethers.getSigners()
  const homeFakeReporter1 = homeSigners[10]
  const homeFakeAdapter1 = homeSigners[11]
  const homeFakeReporter2 = homeSigners[12]
  const homeFakeAdapter2 = homeSigners[13]
  const homeValidator1 = homeSigners[6]

  const homeValidator2 = homeSigners[7]

  let wrappedGNO = await ethers.getContractAt("IPermittableToken", WRAPPED_GNO)

  await homeSigners[0].sendTransaction({
    to: HOME_OWNER_ADDRESS,
    value: ethers.parseEther("1"),
  })

  let gnoWhaleOnGnosis = await ethers.provider.getSigner(GNO_WHALE)

  const homeProxy = await EternalStorageProxy.attach(HOME_AMB_PROXY_ADDRESS)
  const homeBridgeValidators = await BridgeValidators.attach(HOME_BRIDGE_VALIDATOR_ADDRESS)
  const homeOmnibridge = await ethers.getContractAt("IHomeOmnibridge", HOME_OMNIBRIDGE_PROXY_ADDRESS)
  let homeAmb = await HomeAMB.deploy()
  await homeProxy.connect(homeProxyOwner).upgradeTo("6", await homeAmb.getAddress())
  homeAmb = HomeAMB.attach(await homeProxy.getAddress())

  const homeYaho = await MockYaho.deploy()
  const homeYaru = await MockYaru.deploy(HOME_HASHI_TARGET_CHAIN_ID)

  let homeHashiManager = await EternalStorageProxy.deploy()
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
    .setReportersAdaptersAndThreshold([homeFakeReporter1.address], [foreignFakeAdapter1.address], HASHI_THRESHOLD)
  await homeHashiManager.connect(homeProxyOwner).setYaho(await homeYaho.getAddress())
  await homeHashiManager.connect(homeProxyOwner).setExpectedAdaptersHash([homeFakeAdapter1.address])

  // NOTE: Add fake validators in order to be able to sign the message
  await homeBridgeValidators.connect(homeProxyOwner).addValidator(homeValidator1.address)
  await homeBridgeValidators.connect(homeProxyOwner).addValidator(homeValidator2.address)
  await homeBridgeValidators.connect(homeProxyOwner).setRequiredSignatures(2)

  await homeHashiManager.connect(homeProxyOwner).setYaru(await homeYaru.getAddress())
  // NOTE: linking the 2 amb contracts

  await homeHashiManager.connect(homeProxyOwner).setTargetAddress(await foreignAmb.getAddress())

  console.log("Configuration on Gnosis is done")
  // E T H E R E U M   --->   G N O S I S
  await hre.changeNetwork("fmainnet")

  console.log("Switching to Ethereum")
  await foreignHashiManager.connect(foreignProxyOwner).setTargetAddress(await homeAmb.getAddress())

  await foreignHashiManager
    .connect(foreignProxyOwner)
    .setReportersAdaptersAndThreshold([foreignFakeReporter1.address], [homeFakeAdapter1.address], HASHI_THRESHOLD)
  await foreignHashiManager.connect(foreignProxyOwner).setExpectedAdaptersHash([foreignFakeAdapter1.address])

  await foreignHashiManager.connect(foreignProxyOwner).setYaru(await foreignYaru.getAddress())

  console.log("Initial Configuration done ")
  // Relay GNO from Ethereum

  // console.log("Relaying GNO from Ethereum")
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [GNO_WHALE],
  })

  let gnoWhale = await ethers.provider.getSigner(GNO_WHALE)
  const gnoAmount = ethers.parseUnits("10", 18)

  await gno.connect(gnoWhale).approve(FOREIGN_OMNIBRIDGE_PROXY_ADDRESS, await gno.balanceOf(GNO_WHALE))

  let tx = await foreignOmnibridge.connect(gnoWhale).relayTokens(GNO_ADDRESS, gnoWhale, gnoAmount)

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

  console.log("Switching to Gnosis")

  let wrappedGNOBalanceBefore = await wrappedGNO.balanceOf(GNO_WHALE)

  await homeYaru.executeMessages([decodeHashiMessage(foreignHashiMessage, { abiCoder })])
  if (!(await homeAmb.isApprovedByHashi(foreignMessageId))) throw new Error("Hashi didn't execute the message")
  await homeAmb.connect(homeValidator1).executeAffirmation(decodedForeignMessage)
  tx = await homeAmb.connect(homeValidator2).executeAffirmation(decodedForeignMessage)

  if ((await wrappedGNO.balanceOf(GNO_WHALE)) == wrappedGNOBalanceBefore + gnoAmount) {
    console.log("GNO successfully relayed to receiver on Gnosis")
  } else {
    console.log("Failed to relay GNO on Gnosis")
  }

  console.log("Ethereum -> Gnosis OK")

  // G N O S I S   --->   E T H E R E U M

  console.log("Relaying Wrapped GNO from Gnosis")

  await homeSigners[0].sendTransaction({
    to: GNO_WHALE,
    value: ethers.parseEther("1"),
    maxFeePerGas: 15562657581,
  })

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [GNO_WHALE],
  })

  wrappedGNOBalanceBefore = await wrappedGNO.balanceOf(GNO_WHALE)

  console.log("Sender's wrapped_GNO balance before relay", wrappedGNOBalanceBefore)

  await wrappedGNO.connect(gnoWhaleOnGnosis).approve(HOME_OMNIBRIDGE_PROXY_ADDRESS, gnoAmount)

  await wrappedGNO.allowance(GNO_WHALE, HOME_OMNIBRIDGE_PROXY_ADDRESS)

  tx = await homeOmnibridge.connect(gnoWhaleOnGnosis).relayTokens(WRAPPED_GNO, GNO_WHALE, gnoAmount)

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

  console.log("Switching to Ethereum")

  let gnoBalanceBefore = await gno.balanceOf(GNO_WHALE)

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [FOREIGN_OWNER_ADDRESS],
  })

  //   // NOTE: if Hashi is enabled the handleMessage fx is invoked with Hashi message execution
  await foreignYaru.executeMessages([decodeHashiMessage(homeHashiMessage, { abiCoder })])
  if (!(await foreignAmb.isApprovedByHashi(homeMessageId))) throw new Error("Hashi didn't execute the message")
  let packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))

  await foreignAmb.executeSignatures(decodedHomeMessage, packedSignatures)

  if ((await gno.balanceOf(GNO_WHALE)) == gnoBalanceBefore + gnoAmount) {
    console.log("Wrapped GNO relayed from Gnosis to Ethereum succeed")
  } else {
    console.log("Failed to relay wrapped GNO from Gnosis to Ethereum")
  }

  console.log("Gnosis -> Ethereum OK")

  // R E S E N D   E X I S T I N G   M E S S A G E        E T H E R E U M   --->   G N O S I S

  console.log("Resend data and change oracle set")

  await gno.connect(gnoWhale).approve(FOREIGN_OMNIBRIDGE_PROXY_ADDRESS, await gno.balanceOf(GNO_WHALE))

  tx = await foreignOmnibridge.connect(gnoWhale).relayTokens(GNO_ADDRESS, GNO_WHALE, gnoAmount)

  const {
    hashiMessage: foreignHashiMessage2,
    decodedMessage: decodedForeignMessage2,
    messageId: foreignMessageId2,
  } = getRelevantDataFromEvents({
    receipt: await tx.wait(1),
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
    abiCoder,
    ethers,
  })

  // oracle is down and need to be reset
  console.log("Changing oracle set as if the original oracle set is down")
  await foreignHashiManager
    .connect(foreignProxyOwner)
    .setReportersAdaptersAndThreshold([foreignFakeReporter2.address], [homeFakeAdapter2.address], HASHI_THRESHOLD)

  tx = await foreignAmb.resendDataWithHashi(decodedForeignMessage2)

  const { hashiMessage: foreignHashiMessage3 } = getRelevantDataFromEvents({
    onlyHashiMessage: true,
    receipt: await tx.wait(1),
    abiCoder,
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
    onlyHashiMessage: true,
    ethers,
  })

  //   // NOTE: At this point adapters on Gnosis go down so we need to change them
  await hre.changeNetwork("fgnosis")

  console.log("Switching to Gnosis")

  wrappedGNOBalanceBefore = await wrappedGNO.balanceOf(GNO_WHALE)

  homeSigners = await ethers.getSigners()

  console.log("Changing oracle set as if the origianl oracle set is down")
  await homeHashiManager.connect(homeProxyOwner).setExpectedAdaptersHash([homeFakeAdapter2.address])
  await homeHashiManager
    .connect(homeProxyOwner)
    .setReportersAdaptersAndThreshold([homeFakeReporter2.address], [foreignFakeAdapter2.address], HASHI_THRESHOLD)

  // foreignHashiMessage3 encoded decodedForeignMessage2 but with different oracle sets from foreignHashiMessage2
  await homeYaru.executeMessages([decodeHashiMessage(foreignHashiMessage3, { abiCoder })])
  if (!(await homeAmb.isApprovedByHashi(foreignMessageId2))) throw new Error("Hashi didn't execute the message")

  // the foreign message 2 is executed
  await homeAmb.connect(homeValidator1).executeAffirmation(decodedForeignMessage2)
  tx = await homeAmb.connect(homeValidator2).executeAffirmation(decodedForeignMessage2)

  if ((await wrappedGNO.balanceOf(GNO_WHALE)) == wrappedGNOBalanceBefore + gnoAmount) {
    console.log("Resend data with Hashi from Ethereum is successful")
  } else {
    console.log("Failed to resend data with Hashi from Ethereum ")
  }

  // R E S E N D   E X I S T I N G   M E S S A G E        G N O S I S   --->   E T H E R E U M

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [GNO_WHALE],
  })

  wrappedGNOBalanceBefore = await wrappedGNO.balanceOf(GNO_WHALE)

  approve = await wrappedGNO.connect(gnoWhaleOnGnosis).approve(HOME_OMNIBRIDGE_PROXY_ADDRESS, gnoAmount)
  allowance = await wrappedGNO.allowance(GNO_WHALE, HOME_OMNIBRIDGE_PROXY_ADDRESS)

  console.log("Relay wrapped GNO from Gnosis")
  tx = await homeOmnibridge.connect(gnoWhaleOnGnosis).relayTokens(WRAPPED_GNO, GNO_WHALE, gnoAmount)

  const { decodedMessage: decodedHomeMessage2, messageId: homeMessageId2 } = getRelevantDataFromEvents({
    receipt: await tx.wait(1),
    topic: USER_REQUEST_FOR_SIGNATURE_TOPIC,
    abiCoder,
    ethers,
  })

  console.log("Resend data with Hashi")
  tx = await homeAmb.connect(homeProxyOwner).resendDataWithHashi(decodedHomeMessage2)

  const { hashiMessage: homeHashiMessage3 } = getRelevantDataFromEvents({
    receipt: await tx.wait(1),
    topic: USER_REQUEST_FOR_SIGNATURE_TOPIC,
    onlyHashiMessage: true,
    abiCoder,
    ethers,
  })

  signatures = await getValidatorsSignatures({
    message: decodedHomeMessage2,
    validators: [homeValidator1, homeValidator2],
  })
  await Promise.all(
    [homeValidator1, homeValidator2].map((_validator, _index) =>
      homeAmb.connect(_validator).submitSignature(signatures[_index], decodedHomeMessage2),
    ),
  )

  await hre.changeNetwork("fmainnet")

  console.log("Switching to Ethereum")

  gnoBalanceBefore = await gno.balanceOf(GNO_WHALE)

  await foreignHashiManager.connect(foreignProxyOwner).setExpectedAdaptersHash([foreignFakeAdapter2.address])

  await foreignYaru.executeMessages([decodeHashiMessage(homeHashiMessage3, { abiCoder })])
  if (!(await foreignAmb.isApprovedByHashi(homeMessageId2))) throw new Error("Hashi didn't execute the message")
  packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))
  await foreignAmb.executeSignatures(decodedHomeMessage2, packedSignatures)

  if ((await gno.balanceOf(GNO_WHALE)) == gnoBalanceBefore + gnoAmount) {
    console.log("Resend data with Hashi from Gnosis is successful")
  } else {
    console.log("Failed to resend data with Hashi from Gnosis")
  }

  console.log("Gnosis -> Ethereum OK (resendDataWithHashi)")
})
