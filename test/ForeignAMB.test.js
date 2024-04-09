const { ethers } = require("hardhat")
const { expect } = require("chai")

const { strip0x, packSignatures, signatureToVrs, append0 } = require("./utils")

const FOREIGN_AMB_PROXY_ADDRESS = "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e"
const OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const BRIDGE_VALIDATOR_ADDRESS = "0xed84a648b3c51432ad0fD1C2cD2C45677E9d4064"
const HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2
const MESSAGE_PACKING_VERSION = "00050000"

// NOTE: be sure to run this in a mainnet forked environment
describe("ForeignAMB", () => {
  let foreignAmb,
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

    const ForeignAMB = await ethers.getContractFactory("ForeignAMB")
    const OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
    const BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    const MockYaho = await ethers.getContractFactory("MockYaho")
    const MockYaru = await ethers.getContractFactory("MockYaru")

    proxy = await OwnedUpgradeabilityProxy.attach(FOREIGN_AMB_PROXY_ADDRESS)
    bridgeValidators = await BridgeValidators.attach(BRIDGE_VALIDATOR_ADDRESS)

    foreignAmb = await ForeignAMB.deploy()
    await proxy.connect(proxyOwner).upgradeTo("6", await foreignAmb.getAddress())
    foreignAmb = ForeignAMB.attach(await proxy.getAddress())

    yaho = await MockYaho.deploy()
    yaru = await MockYaru.deploy(HASHI_TARGET_CHAIN_ID)

    await foreignAmb.connect(proxyOwner).setHashiTargetChainId(HASHI_TARGET_CHAIN_ID)
    await foreignAmb.connect(proxyOwner).setHashiThreshold(HASHI_THRESHOLD)
    await foreignAmb.connect(proxyOwner).setHashiReporters([fakeReporter1.address, fakeReporter2.address])
    await foreignAmb.connect(proxyOwner).setHashiAdapters([fakeAdapter1.address, fakeAdapter2.address])
    await foreignAmb.connect(proxyOwner).setYaho(await yaho.getAddress())
    await foreignAmb.connect(proxyOwner).setTargetAmb(fakeTargetAmb.address)
    await foreignAmb.connect(proxyOwner).setYaru(await yaru.getAddress())

    // NOTE: Add fake validators in order to be able to sign the message
    await bridgeValidators.connect(proxyOwner).addValidator(validator1.address)
    await bridgeValidators.connect(proxyOwner).addValidator(validator2.address)
    await bridgeValidators.connect(proxyOwner).setRequiredSignatures(2)
  })

  it("should be able to send a message using hashi", async () => {
    await expect(foreignAmb.requireToPassMessage(fakeReceiver.address, "0x01", 200000)).to.emit(
      yaho,
      "MessageDispatched",
    )
  })

  it("should be able to execute an affirmation only once after hashi approval", async () => {
    const msgId = "0x" + MESSAGE_PACKING_VERSION.padEnd(63, "0") + "1"
    const message =
      `${msgId}${strip0x(await yaho.getAddress())}` + // sender
      `${strip0x(receiver.address)}` + // contractAddress
      "001E8480" + // gasLimit
      "02" + // source chain id length
      "01" + // destination chain id length
      "00" + // dataType
      "0100" + // source chain id
      "01" + // destination chain id
      "11" // data

    const signatures = await Promise.all(
      [validator1, validator2].map((_validator) => _validator.signMessage(append0(ethers.toBeArray(message)))),
    )

    const packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))
    await expect(foreignAmb.executeSignatures(message, packedSignatures)).to.be.reverted

    const hashiMessage = [
      1, // nonce
      1, // target chain id
      2, // threshold
      fakeTargetAmb.address,
      await foreignAmb.getAddress(), // receiver
      message,
      [fakeReporter1, fakeReporter2].map(({ address }) => address),
      [fakeAdapter1, fakeAdapter2].map(({ address }) => address),
    ]
    await yaru.executeMessages([hashiMessage])
    await expect(foreignAmb.executeSignatures(message, packedSignatures)).to.emit(foreignAmb, "RelayedMessage")
    await expect(foreignAmb.executeSignatures(message, packedSignatures)).to.be.reverted
  })
})
