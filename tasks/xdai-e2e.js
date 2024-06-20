const { task } = require("hardhat/config")
const { packSignatures, signatureToVrs } = require("../test/utils/index")
const { decodeHashiMessage, getRelevantDataFromEvents, getValidatorsSignatures } = require("./utils/index")

const FOREIGN_XDAI_PROXY_ADDRESS = "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016"
const FOREIGN_OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const FOREIGN_BRIDGE_VALIDATOR_ADDRESS = "0xe1579dEbdD2DF16Ebdb9db8694391fa74EeA201E"
const FOREIGN_HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const DAI_FAUCET_ADDRESS = "0xD1668fB5F690C59Ab4B0CAbAd0f8C1617895052B"

const HOME_XDAI_PROXY_ADDRESS = "0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6"
const HOME_PROXY_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_ADDRESS = "0xb289f0e6fbdff8eee340498a56e1787b303f1b6d"
const HOME_HASHI_TARGET_CHAIN_ID = 1

const USER_REQUEST_FOR_AFFIRMATION_TOPIC = "0xf6968e689b3d8c24f22c10c2a3256bb5ca483a474e11bac08423baa049e38ae8"
const USER_REQUEST_FOR_SIGNATURE_TOPIC = "0xbcb4ebd89690a7455d6ec096a6bfc4a8a891ac741ffe4e678ea2614853248658"
const ADDED_RECEIVER_TOPIC = "0x3c798bbcf33115b42c728b8504cff11dd58736e9fa789f1cda2738db7d696b2a"

/**
 * How to run this:
 * - npx hardhat node --fork <your-ethereum-node>
 * - npx hardhat node --fork <your-gnosis-node> --port 8544
 * - npx hardhat XDAIBridge:e2e --network fmainnet
 *
 */
task("XDAIBridge:e2e").setAction(async (_taskArgs, hre) => {
  const { ethers, network } = hre
  const abiCoder = new ethers.AbiCoder()

  let ForeignBridgeErcToNative = await ethers.getContractFactory("ForeignBridgeErcToNative")
  let OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
  let BridgeValidators = await ethers.getContractFactory("BridgeValidators")
  let HashiManager = await ethers.getContractFactory("HashiManager")
  let EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
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

  foreignHashiManager = await EternalStorageProxy.deploy()
  const foreignHashiManagerImp = await HashiManager.deploy()
  await foreignHashiManager.upgradeTo("1", await foreignHashiManagerImp.getAddress())
  await foreignHashiManager.transferProxyOwnership(foreignProxyOwner.address)
  foreignHashiManager = await HashiManager.attach(await foreignHashiManager.getAddress())
  await foreignHashiManager.connect(foreignProxyOwner).initialize(foreignProxyOwner.address)
  await foreignBridgeErcToNative.connect(foreignProxyOwner).setHashiManager(await foreignHashiManager.getAddress())
  await foreignHashiManager.connect(foreignProxyOwner).setExpectedThreshold(HASHI_THRESHOLD)
  await foreignHashiManager.connect(foreignProxyOwner).setTargetChainId(FOREIGN_HASHI_TARGET_CHAIN_ID)
  await foreignHashiManager
    .connect(foreignProxyOwner)
    .setReportersAdaptersAndThreshold(
      [foreignFakeReporter1.address, foreignFakeReporter2.address],
      [foreignFakeAdapter1.address, foreignFakeAdapter2.address],
      HASHI_THRESHOLD,
    )
  await foreignHashiManager.connect(foreignProxyOwner).setYaho(await foreignYaho.getAddress())
  await foreignHashiManager.connect(foreignProxyOwner).setYaru(await foreignYaru.getAddress())

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
  HashiManager = await ethers.getContractFactory("HashiManager")
  EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
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

  homeHashiManager = await EternalStorageProxy.deploy()
  const homeHashiManagerImp = await HashiManager.deploy()
  await homeHashiManager.upgradeTo("1", await homeHashiManagerImp.getAddress())
  await homeHashiManager.transferProxyOwnership(homeProxyOwner.address)
  homeHashiManager = await HashiManager.attach(await homeHashiManager.getAddress())
  await homeHashiManager.connect(homeProxyOwner).initialize(homeProxyOwner.address)
  await homeBridgeErcToNative.connect(homeProxyOwner).setHashiManager(await homeHashiManager.getAddress())
  await homeHashiManager.connect(homeProxyOwner).setExpectedThreshold(HASHI_THRESHOLD)
  await homeHashiManager.connect(homeProxyOwner).setTargetChainId(HOME_HASHI_TARGET_CHAIN_ID)
  await homeHashiManager
    .connect(homeProxyOwner)
    .setReportersAdaptersAndThreshold(
      [homeFakeReporter1.address, homeFakeReporter2.address],
      [foreignFakeAdapter1.address, foreignFakeAdapter2.address],
      HASHI_THRESHOLD,
    )
  await homeHashiManager.connect(homeProxyOwner).setYaho(await homeYaho.getAddress())
  await homeHashiManager.connect(homeProxyOwner).setYaru(await homeYaru.getAddress())
  await homeHashiManager
    .connect(homeProxyOwner)
    .setExpectedAdaptersHash([homeFakeAdapter1.address, homeFakeAdapter2.address])

  // NOTE: Add fake validators in order to be able to sign the message
  await homeBridgeValidators.connect(homeBridgeValidatorOwner).addValidator(homeValidator1.address)
  await homeBridgeValidators.connect(homeBridgeValidatorOwner).addValidator(homeValidator2.address)
  await homeBridgeValidators.connect(homeBridgeValidatorOwner).setRequiredSignatures(2)

  await foreignHashiManager.connect(foreignProxyOwner).setTargetAddress(await homeBridgeErcToNative.getAddress())
  await homeHashiManager.connect(homeProxyOwner).setTargetAddress(await foreignBridgeErcToNative.getAddress())

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

  let amount = ethers.parseUnits("10", 18)
  await dai.approve(await foreignBridgeErcToNative.getAddress(), amount)
  let tx = await foreignBridgeErcToNative.relayTokens(homeReceiver.address, amount)
  const { messageArgs: foreignMessageArgs, hashiMessage: foreignHashiMessage } = getRelevantDataFromEvents({
    bridge: "xdai",
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
    receipt: await tx.wait(1),
  })

  await hre.changeNetwork("fgnosis")
  await homeBridgeErcToNative.connect(homeValidator1).executeAffirmation(...foreignMessageArgs)
  const decodedForeignHashiMessage = decodeHashiMessage(foreignHashiMessage, { abiCoder })
  await homeYaru.executeMessages([decodedForeignHashiMessage])
  if (!(await homeBridgeErcToNative.isApprovedByHashi(ethers.keccak256(decodedForeignHashiMessage[5]))))
    throw new Error("Hashi didn't execute the message")
  tx = await homeBridgeErcToNative.connect(homeValidator2).executeAffirmation(...foreignMessageArgs)
  receipt = await tx.wait()
  let addedReceiverLog = receipt.logs.find((_log) => _log.topics[0] === ADDED_RECEIVER_TOPIC)
  if (!addedReceiverLog) throw new Error("Ops, AddedReceiver not found")
  console.log("Ethereum -> Gnosis OK")

  // G N O S I S   --->   E T H E R E U M
  tx = await homeOwner.sendTransaction({
    to: await homeBridgeErcToNative.getAddress(),
    value: amount,
  })
  const { message: homeMessage, hashiMessage: homeHashiMessage } = getRelevantDataFromEvents({
    bridge: "xdai",
    receipt: await tx.wait(),
    topic: USER_REQUEST_FOR_SIGNATURE_TOPIC,
  })

  const [receiver, value, nonce] = abiCoder.decode(["address", "uint256", "bytes32"], homeMessage)
  const homeMessageToSign = ethers.solidityPacked(
    ["address", "uint256", "bytes32", "address"],
    [receiver, value, nonce, await foreignBridgeErcToNative.getAddress()],
  )

  let signatures = await getValidatorsSignatures({
    bridge: "xdai",
    message: homeMessageToSign,
    validators: [homeValidator1, homeValidator2],
  })

  await Promise.all(
    [homeValidator1, homeValidator2].map((_validator, _index) =>
      homeBridgeErcToNative.connect(_validator).submitSignature(signatures[_index], homeMessageToSign),
    ),
  )

  await hre.changeNetwork("fmainnet")
  let balancePre = await dai.balanceOf(homeOwner.address)
  const decodedHomeHashiMessage = decodeHashiMessage(homeHashiMessage, { abiCoder })
  await foreignYaru.executeMessages([decodedHomeHashiMessage])
  if (!(await foreignBridgeErcToNative.isApprovedByHashi(ethers.keccak256(decodedHomeHashiMessage[5]))))
    throw new Error("Hashi didn't execute the message")
  await foreignBridgeErcToNative.executeSignatures(
    homeMessageToSign,
    packSignatures(signatures.map((_sig) => signatureToVrs(_sig))),
  )
  balancePost = await dai.balanceOf(homeOwner.address)
  if (balancePre + BigInt(amount.toString()) != balancePost) throw new Error("Ops, someting weird happened")
  console.log("Gnosis -> Ethereum OK")

  // R E S E N D   E X I S T I N G   M E S S A G E        E T H E R E U M   --->   G N O S I S
  await hre.changeNetwork("fmainnet")
  amount = ethers.parseUnits("10", 18)
  await dai.approve(await foreignBridgeErcToNative.getAddress(), amount)
  tx = await foreignBridgeErcToNative.relayTokens(homeReceiver.address, amount)
  const { messageArgs: foreignMessageArgs2 } = getRelevantDataFromEvents({
    bridge: "xdai",
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
    receipt: await tx.wait(1),
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
  let encodedData = ethers.solidityPacked(["address", "uint256", "bytes32"], foreignMessageArgs2)
  tx = await foreignBridgeErcToNative.resendDataWithHashi(encodedData)
  const { hashiMessage: foreignHashiMessage3 } = getRelevantDataFromEvents({
    onlyHashiMessage: true,
    receipt: await tx.wait(1),
    abiCoder,
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
  })

  await hre.changeNetwork("fgnosis")
  const decodedForeignHashiMessage3 = decodeHashiMessage(foreignHashiMessage3, { abiCoder })
  await homeYaru.executeMessages([decodeHashiMessage(foreignHashiMessage3, { abiCoder })])
  if (!(await homeBridgeErcToNative.isApprovedByHashi(ethers.keccak256(decodedForeignHashiMessage3[5]))))
    throw new Error("Hashi didn't execute the message")
  await homeBridgeErcToNative.connect(homeValidator1).executeAffirmation(...foreignMessageArgs2)
  tx = await homeBridgeErcToNative.connect(homeValidator2).executeAffirmation(...foreignMessageArgs2)
  receipt = await tx.wait()
  addedReceiverLog = receipt.logs.find((_log) => _log.topics[0] === ADDED_RECEIVER_TOPIC)
  if (!addedReceiverLog) throw new Error("Ops, AddedReceiver not found")
  console.log("Ethereum -> Gnosis OK (resendDataWithHashi)")

  // R E S E N D   E X I S T I N G   M E S S A G E        G N O S I S   --->   E T H E R E U M
  tx = await homeOwner.sendTransaction({
    to: await homeBridgeErcToNative.getAddress(),
    value: amount,
  })
  const { hashiMessage: homeHashiMessage2, message: homeMessage2 } = getRelevantDataFromEvents({
    bridge: "xdai",
    receipt: await tx.wait(),
    topic: USER_REQUEST_FOR_SIGNATURE_TOPIC,
  })

  const [receiver2, value2, nonce2] = abiCoder.decode(["address", "uint256", "bytes32"], homeMessage2)
  const homeMessageToSign2 = ethers.solidityPacked(
    ["address", "uint256", "bytes32", "address"],
    [receiver2, value2, nonce2, await foreignBridgeErcToNative.getAddress()],
  )

  signatures = await getValidatorsSignatures({
    bridge: "xdai",
    message: homeMessageToSign2,
    validators: [homeValidator1, homeValidator2],
  })

  await Promise.all(
    [homeValidator1, homeValidator2].map((_validator, _index) =>
      homeBridgeErcToNative.connect(_validator).submitSignature(signatures[_index], homeMessageToSign2),
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
  encodedData = ethers.solidityPacked(["address", "uint256", "bytes32"], [receiver2, value2, nonce2])
  tx = await homeBridgeErcToNative.resendDataWithHashi(encodedData)
  const { hashiMessage: homeHashiMessage3 } = getRelevantDataFromEvents({
    onlyHashiMessage: true,
    receipt: await tx.wait(1),
    abiCoder,
    topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
  })

  await hre.changeNetwork("fmainnet")
  balancePre = await dai.balanceOf(homeOwner.address)
  await foreignYaru.executeMessages([decodeHashiMessage(homeHashiMessage3, { abiCoder })])
  const decodedHomeHashiMessage2 = decodeHashiMessage(homeHashiMessage2, { abiCoder })
  if (!(await foreignBridgeErcToNative.isApprovedByHashi(ethers.keccak256(decodedHomeHashiMessage2[5]))))
    throw new Error("Hashi didn't execute the message")
  packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))
  await foreignBridgeErcToNative.executeSignatures(homeMessageToSign2, packedSignatures)
  balancePost = await dai.balanceOf(homeOwner.address)
  if (balancePre + BigInt(amount.toString()) != balancePost) throw new Error("Ops, someting weird happened")
  console.log("Gnosis -> Ethereum OK (resendDataWithHashi)")
})
