const { ethers } = require("hardhat")
const { expect } = require("chai")

const FOREIGN_AMB_PROXY_ADDRESS = "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e"
const FOREIGN_AMB_PROXY_OWNER = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2

// NOTE: be sure to run this in a mainnet forked environment
describe("ForeignAMB", () => {
  let foreignAmb, proxy, reporter1, reporter2, adapter1, adapter2, fakeReceiver

  beforeEach(async () => {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FOREIGN_AMB_PROXY_OWNER],
    })
    const proxyOwner = await ethers.provider.getSigner(FOREIGN_AMB_PROXY_OWNER)

    const signers = await ethers.getSigners()
    const owner = signers[0]
    fakeReceiver = signers[1]
    await owner.sendTransaction({
      to: FOREIGN_AMB_PROXY_OWNER,
      value: ethers.parseEther("1"),
    })

    const ForeignAMB = await ethers.getContractFactory("ForeignAMB")
    const OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
    const MockYaho = await ethers.getContractFactory("MockYaho")
    const MockReporter = await ethers.getContractFactory("MockReporter")
    const MockAdapter = await ethers.getContractFactory("MockAdapter")

    proxy = await OwnedUpgradeabilityProxy.attach(FOREIGN_AMB_PROXY_ADDRESS)

    foreignAmb = await ForeignAMB.deploy()
    await proxy.connect(proxyOwner).upgradeTo("6", await foreignAmb.getAddress())
    foreignAmb = ForeignAMB.attach(await proxy.getAddress())

    yaho = await MockYaho.deploy()
    reporter1 = await MockReporter.deploy(await yaho.getAddress())
    reporter2 = await MockReporter.deploy(await yaho.getAddress())
    adapter1 = await MockAdapter.deploy()
    adapter2 = await MockAdapter.deploy()

    await foreignAmb.connect(proxyOwner).setHashiTargetChainId(HASHI_TARGET_CHAIN_ID)
    await foreignAmb.connect(proxyOwner).setHashiThreshold(HASHI_THRESHOLD)
    await foreignAmb.connect(proxyOwner).setHashiReporters([await reporter1.getAddress(), await reporter2.getAddress()])
    await foreignAmb.connect(proxyOwner).setHashiAdapters([await adapter1.getAddress(), await adapter2.getAddress()])
    await foreignAmb.connect(proxyOwner).setYaho(await yaho.getAddress())
    //await foreignAmb.connect(proxyOwner).setTargetAmb()
    //await foreignAmb.connect(proxyOwner).setYaru()
  })

  it("should be able to send a message using hashi", async () => {
    await expect(foreignAmb.requireToPassMessage(fakeReceiver.address, "0x01", 200000))
      .to.emit(yaho, "MessageDispatched")
      .and.to.emit(reporter1, "MessageDispatched")
      .and.to.emit(reporter2, "MessageDispatched")
  })
})
