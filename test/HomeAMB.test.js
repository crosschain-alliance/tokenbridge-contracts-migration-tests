const { ethers } = require("hardhat")
const { expect } = require("chai")

const { strip0x } = require("./utils")

const HOME_AMB_PROXY_ADDRESS = "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59"
const OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const BRIDGE_VALIDATOR_ADDRESS = "0xa280fed8d7cad9a76c8b50ca5c33c2534ffa5008"
const HASHI_TARGET_CHAIN_ID = 1
const HASHI_THRESHOLD = 2
const MESSAGE_PACKING_VERSION = "00050000"

// NOTE: be sure to run this in a gnosis chain forked environment
describe("HomeAMB", () => {
  let homeAmb,
    proxy,
    fakeReceiver,
    fakeReporter1,
    fakeReporter2,
    fakeAdapter1,
    fakeAdapter2,
    validator1,
    validator2,
    bridgeValidators,
    fakeTargetAmb,
    sender,
    receiver

  before(async () => {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [OWNER_ADDRESS],
    })
    const proxyOwner = await ethers.provider.getSigner(OWNER_ADDRESS)

    const signers = await ethers.getSigners()
    const owner = signers[0]
    fakeReceiver = signers[1]

    fakeReporter1 = signers[2]
    fakeAdapter1 = signers[3]
    fakeReporter2 = signers[4]
    fakeAdapter2 = signers[5]
    validator1 = signers[6]
    validator2 = signers[7]
    fakeTargetAmb = signers[8]
    sender = signers[9]
    receiver = signers[10]

    await owner.sendTransaction({
      to: OWNER_ADDRESS,
      value: ethers.parseEther("1"),
    })

    const HomeAMB = await ethers.getContractFactory("HomeAMB")
    const OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
    const BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    const MockYaho = await ethers.getContractFactory("MockYaho")
    const MockYaru = await ethers.getContractFactory("MockYaru")

    proxy = await OwnedUpgradeabilityProxy.attach(HOME_AMB_PROXY_ADDRESS)
    bridgeValidators = await BridgeValidators.attach(BRIDGE_VALIDATOR_ADDRESS)

    homeAmb = await HomeAMB.deploy()
    await proxy.connect(proxyOwner).upgradeTo("6", await homeAmb.getAddress())
    homeAmb = HomeAMB.attach(await proxy.getAddress())

    yaho = await MockYaho.deploy()
    yaru = await MockYaru.deploy(HASHI_TARGET_CHAIN_ID)

    await homeAmb.connect(proxyOwner).setHashiTargetChainId(HASHI_TARGET_CHAIN_ID)
    await homeAmb.connect(proxyOwner).setHashiThreshold(HASHI_THRESHOLD)
    await homeAmb.connect(proxyOwner).setHashiReporters([fakeReporter1.address, fakeReporter2.address])
    await homeAmb.connect(proxyOwner).setHashiAdapters([fakeAdapter1.address, fakeAdapter2.address])
    await homeAmb.connect(proxyOwner).setYaho(await yaho.getAddress())
    await homeAmb.connect(proxyOwner).setHashiTargetAddress(fakeTargetAmb.address)
    await homeAmb.connect(proxyOwner).setYaru(await yaru.getAddress())

    // NOTE: Add fake validators in order to be able to sign the message
    await bridgeValidators.connect(proxyOwner).addValidator(validator1.address)
    await bridgeValidators.connect(proxyOwner).addValidator(validator2.address)
    await bridgeValidators.connect(proxyOwner).setRequiredSignatures(2)
  })

  it("should be able to send a message using hashi", async () => {
    await expect(homeAmb.requireToPassMessage(fakeReceiver.address, "0x01", 200000)).to.emit(yaho, "MessageDispatched")
  })

  it("should be able to execute an affirmation only once after hashi approval", async () => {
    const msgId = "0x" + MESSAGE_PACKING_VERSION.padEnd(63, "0") + "1"
    const message =
      `${msgId}${strip0x(await yaho.getAddress())}` + // sender
      `${strip0x(receiver.address)}` + // contractAddress
      "001E8480" + // gasLimit
      "01" + // source chain id length
      "01" + // destination chain id length
      "00" + // dataType
      "01" + // source chain id
      "64" + // destination chain id
      "11" // data

    await homeAmb.connect(validator1).executeAffirmation(message)
    await homeAmb.connect(validator2).executeAffirmation(message)

    const hashiMessage = [
      1, // nonce
      100, // target chain id
      2, // threshold
      fakeTargetAmb.address,
      await homeAmb.getAddress(), // receiver
      message,
      [fakeReporter1, fakeReporter2].map(({ address }) => address),
      [fakeAdapter1, fakeAdapter2].map(({ address }) => address),
    ]
    await expect(yaru.executeMessages([hashiMessage])).to.emit(homeAmb, "AffirmationCompleted")
  })
})
