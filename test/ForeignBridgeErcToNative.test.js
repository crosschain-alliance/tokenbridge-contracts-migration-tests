const { ethers } = require("hardhat")
const { expect } = require("chai")

const FOREIGN_XDAI_PROXY_ADDRESS = "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016"
const OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const BRIDGE_VALIDATOR_ADDRESS = "0xed84a648b3c51432ad0fD1C2cD2C45677E9d4064"
const HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const DAI_FAUCET_ADDRESS = "0x6FF8E4DB500cBd77d1D181B8908E022E29e0Ec4A"

// NOTE: be sure to run this in a mainnet forked environment
describe("ForeignBridgeErcToNative", () => {
  let foreignBridgeErcToNative,
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
    dai

  before(async () => {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [OWNER_ADDRESS],
    })
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DAI_FAUCET_ADDRESS],
    })

    const proxyOwner = await ethers.provider.getSigner(OWNER_ADDRESS)
    const daiFaucet = await ethers.provider.getSigner(DAI_FAUCET_ADDRESS)

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

    const ForeignBridgeErcToNative = await ethers.getContractFactory("ForeignBridgeErcToNative")
    const OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
    const BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    const MockYaho = await ethers.getContractFactory("MockYaho")
    const MockYaru = await ethers.getContractFactory("MockYaru")
    const Token = await ethers.getContractFactory("Token")

    proxy = await OwnedUpgradeabilityProxy.attach(FOREIGN_XDAI_PROXY_ADDRESS)
    bridgeValidators = await BridgeValidators.attach(BRIDGE_VALIDATOR_ADDRESS)

    foreignBridgeErcToNative = await ForeignBridgeErcToNative.deploy()
    await proxy.connect(proxyOwner).upgradeTo("9", await foreignBridgeErcToNative.getAddress())
    foreignBridgeErcToNative = ForeignBridgeErcToNative.attach(await proxy.getAddress())

    yaho = await MockYaho.deploy()
    yaru = await MockYaru.deploy(HASHI_TARGET_CHAIN_ID)

    await foreignBridgeErcToNative.connect(proxyOwner).setHashiTargetChainId(HASHI_TARGET_CHAIN_ID)
    await foreignBridgeErcToNative.connect(proxyOwner).setHashiThreshold(HASHI_THRESHOLD)
    await foreignBridgeErcToNative.connect(proxyOwner).setHashiReporters([fakeReporter1.address, fakeReporter2.address])
    await foreignBridgeErcToNative.connect(proxyOwner).setHashiAdapters([fakeAdapter1.address, fakeAdapter2.address])
    await foreignBridgeErcToNative.connect(proxyOwner).setYaho(await yaho.getAddress())
    await foreignBridgeErcToNative.connect(proxyOwner).setTargetAmb(fakeTargetAmb.address)
    await foreignBridgeErcToNative.connect(proxyOwner).setYaru(await yaru.getAddress())

    // NOTE: Add fake validators in order to be able to sign the message
    await bridgeValidators.connect(proxyOwner).addValidator(validator1.address)
    await bridgeValidators.connect(proxyOwner).addValidator(validator2.address)
    await bridgeValidators.connect(proxyOwner).setRequiredSignatures(2)

    dai = await Token.attach(DAI_ADDRESS)
    await dai.connect(daiFaucet).transfer(owner.address, ethers.parseUnits("100000", 18))
  })

  it("should be able to relay 10 dai", async () => {
    const amount = ethers.parseUnits("10", 18)
    await dai.approve(await foreignBridgeErcToNative.getAddress(), amount)
    await expect(foreignBridgeErcToNative.relayTokens(fakeReceiver.address, amount)).to.emit(yaho, "MessageDispatched")
  })
})
