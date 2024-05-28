const { ethers } = require("hardhat")
const { expect } = require("chai")

const HOME_XDAI_PROXY_ADDRESS = "0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6"
const PROXY_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const BRIDGE_VALIDATOR_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const BRIDGE_VALIDATOR_ADDRESS = "0xb289f0e6fbdff8eee340498a56e1787b303f1b6d"
const HASHI_TARGET_CHAIN_ID = 1
const HASHI_THRESHOLD = 2

// NOTE: be sure to run this in a gnosis chain forked environment
describe("HomeBridgeErcToNative", () => {
  let homeBridgeErcToNative,
    proxy,
    fakeReceiver,
    fakeReporter1,
    fakeReporter2,
    fakeAdapter1,
    fakeAdapter2,
    validator1,
    validator2,
    bridgeValidators,
    fakeTargetHomeBridgeErcToNative,
    owner,
    hashiManager

  beforeEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: config.networks.hardhat.forking.url,
            blockNumber: config.networks.hardhat.forking.blockNumber,
          },
        },
      ],
    })
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [PROXY_OWNER_ADDRESS],
    })
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [BRIDGE_VALIDATOR_OWNER_ADDRESS],
    })

    const proxyOwner = await ethers.provider.getSigner(PROXY_OWNER_ADDRESS)
    const bridgeValidatorOwner = await ethers.provider.getSigner(BRIDGE_VALIDATOR_OWNER_ADDRESS)

    const signers = await ethers.getSigners()
    owner = signers[0]
    fakeReceiver = signers[1]

    fakeReporter1 = signers[2]
    fakeAdapter1 = signers[3]
    fakeReporter2 = signers[4]
    fakeAdapter2 = signers[5]
    validator1 = signers[6]
    validator2 = signers[7]
    fakeTargetHomeBridgeErcToNative = signers[8]
    sender = signers[9]
    receiver = signers[10]

    await owner.sendTransaction({
      to: PROXY_OWNER_ADDRESS,
      value: ethers.parseEther("1"),
    })
    await owner.sendTransaction({
      to: BRIDGE_VALIDATOR_OWNER_ADDRESS,
      value: ethers.parseEther("1"),
    })

    const HomeBridgeErcToNative = await ethers.getContractFactory("HomeBridgeErcToNative")
    const OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
    const BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    const HashiManager = await ethers.getContractFactory("HashiManager")
    const EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
    const MockYaho = await ethers.getContractFactory("MockYaho")
    const MockYaru = await ethers.getContractFactory("MockYaru")

    proxy = await OwnedUpgradeabilityProxy.attach(HOME_XDAI_PROXY_ADDRESS)
    bridgeValidators = await BridgeValidators.attach(BRIDGE_VALIDATOR_ADDRESS)

    homeBridgeErcToNative = await HomeBridgeErcToNative.deploy()
    await proxy.connect(proxyOwner).upgradeTo("6", await homeBridgeErcToNative.getAddress())
    homeBridgeErcToNative = HomeBridgeErcToNative.attach(await proxy.getAddress())

    yaho = await MockYaho.deploy()
    yaru = await MockYaru.deploy(HASHI_TARGET_CHAIN_ID)

    hashiManager = await EternalStorageProxy.deploy()
    const hashiManagerImp = await HashiManager.deploy()
    await hashiManager.upgradeTo("1", await hashiManagerImp.getAddress())
    await hashiManager.transferProxyOwnership(proxyOwner.address)
    hashiManager = await HashiManager.attach(await hashiManager.getAddress())
    await hashiManager.connect(proxyOwner).initialize(proxyOwner.address)

    await homeBridgeErcToNative.connect(proxyOwner).setHashiManager(await hashiManager.getAddress())
    await hashiManager.connect(proxyOwner).setTargetChainId(HASHI_TARGET_CHAIN_ID)
    await hashiManager
      .connect(proxyOwner)
      .setReportersAdaptersAndThreshold(
        [fakeReporter1.address, fakeReporter2.address],
        [fakeAdapter1.address, fakeAdapter2.address],
        HASHI_THRESHOLD,
      )
    await hashiManager.connect(proxyOwner).setYaho(await yaho.getAddress())
    await hashiManager.connect(proxyOwner).setTargetAddress(fakeTargetHomeBridgeErcToNative.address)
    await hashiManager.connect(proxyOwner).setYaru(await yaru.getAddress())

    // NOTE: Add fake validators in order to be able to sign the message
    await bridgeValidators.connect(bridgeValidatorOwner).addValidator(validator1.address)
    await bridgeValidators.connect(bridgeValidatorOwner).addValidator(validator2.address)
    await bridgeValidators.connect(bridgeValidatorOwner).setRequiredSignatures(2)
  })

  it("should be able to execute an affirmation and mint 10 dai with the hashi approval", async () => {
    const amount = ethers.parseEther("10")
    const nonce = ethers.toBeHex(1, 32)
    const message = ethers.solidityPacked(["address", "uint256", "bytes32"], [fakeReceiver.address, amount, nonce])

    await yaru.executeMessages([
      [
        1, // hashi nonce
        100, // target chain id
        2, // threshold
        fakeTargetHomeBridgeErcToNative.address,
        await homeBridgeErcToNative.getAddress(), // receiver
        message,
        [fakeReporter1, fakeReporter2].map(({ address }) => address),
        [fakeAdapter1, fakeAdapter2].map(({ address }) => address),
      ],
    ])
    expect(await homeBridgeErcToNative.isApprovedByHashi(ethers.keccak256(message))).to.be.true
    await homeBridgeErcToNative.connect(validator1).executeAffirmation(fakeReceiver.address, amount, nonce)
    await expect(
      homeBridgeErcToNative.connect(validator2).executeAffirmation(fakeReceiver.address, amount, nonce),
    ).to.emit(homeBridgeErcToNative, "AffirmationCompleted")
  })

  it("should be able to execute an affirmation and mint 10 dai without the hashi approval as it's optional", async () => {
    const amount = ethers.parseEther("10")
    const nonce = ethers.toBeHex(1, 32)
    await homeBridgeErcToNative.connect(validator1).executeAffirmation(fakeReceiver.address, amount, nonce)
    await expect(
      homeBridgeErcToNative.connect(validator2).executeAffirmation(fakeReceiver.address, amount, nonce),
    ).to.emit(homeBridgeErcToNative, "AffirmationCompleted")
  })
})
