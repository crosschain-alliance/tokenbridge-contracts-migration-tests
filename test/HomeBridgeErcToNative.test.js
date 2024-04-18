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
    fakeTargetAmb,
    owner

  before(async () => {
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
    fakeTargetAmb = signers[8]
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
    const MockYaho = await ethers.getContractFactory("MockYaho")
    const MockYaru = await ethers.getContractFactory("MockYaru")

    proxy = await OwnedUpgradeabilityProxy.attach(HOME_XDAI_PROXY_ADDRESS)
    bridgeValidators = await BridgeValidators.attach(BRIDGE_VALIDATOR_ADDRESS)

    homeBridgeErcToNative = await HomeBridgeErcToNative.deploy()
    await proxy.connect(proxyOwner).upgradeTo("6", await homeBridgeErcToNative.getAddress())
    homeBridgeErcToNative = HomeBridgeErcToNative.attach(await proxy.getAddress())

    yaho = await MockYaho.deploy()
    yaru = await MockYaru.deploy(HASHI_TARGET_CHAIN_ID)

    await homeBridgeErcToNative.connect(proxyOwner).setHashiTargetChainId(HASHI_TARGET_CHAIN_ID)
    await homeBridgeErcToNative.connect(proxyOwner).setHashiThreshold(HASHI_THRESHOLD)
    await homeBridgeErcToNative.connect(proxyOwner).setHashiReporters([fakeReporter1.address, fakeReporter2.address])
    await homeBridgeErcToNative.connect(proxyOwner).setHashiAdapters([fakeAdapter1.address, fakeAdapter2.address])
    await homeBridgeErcToNative.connect(proxyOwner).setYaho(await yaho.getAddress())
    await homeBridgeErcToNative.connect(proxyOwner).setHashiTargetAddress(fakeTargetAmb.address)
    await homeBridgeErcToNative.connect(proxyOwner).setYaru(await yaru.getAddress())

    // NOTE: Add fake validators in order to be able to sign the message
    await bridgeValidators.connect(bridgeValidatorOwner).addValidator(validator1.address)
    await bridgeValidators.connect(bridgeValidatorOwner).addValidator(validator2.address)
    await bridgeValidators.connect(bridgeValidatorOwner).setRequiredSignatures(2)
  })

  it("should be able to execute an affirmation and mint 10 dai", async () => {
    const amount = ethers.parseEther("10")
    const nonce = ethers.toBeHex(1, 32)
    await homeBridgeErcToNative.connect(validator1).executeAffirmation(fakeReceiver.address, amount, nonce)
    await homeBridgeErcToNative.connect(validator2).executeAffirmation(fakeReceiver.address, amount, nonce)

    const message = ethers.solidityPacked(["address", "uint256", "bytes32"], [fakeReceiver.address, amount, nonce])
    await expect(
      yaru.executeMessages([
        [
          1, // hashi nonce
          100, // target chain id
          2, // threshold
          fakeTargetAmb.address,
          await homeBridgeErcToNative.getAddress(), // receiver
          message,
          [fakeReporter1, fakeReporter2].map(({ address }) => address),
          [fakeAdapter1, fakeAdapter2].map(({ address }) => address),
        ],
      ]),
    ).to.emit(homeBridgeErcToNative, "AffirmationCompleted")
  })

  it("should be able to relay 1 dai by transfering them to the xdai home contract", async () => {
    const amount = ethers.parseEther("10")
    const nonce = ethers.toBeHex(2, 32)
    await homeBridgeErcToNative.connect(validator1).executeAffirmation(fakeReceiver.address, amount, nonce)
    await homeBridgeErcToNative.connect(validator2).executeAffirmation(fakeReceiver.address, amount, nonce)

    const message = ethers.solidityPacked(["address", "uint256", "bytes32"], [fakeReceiver.address, amount, nonce])
    await expect(
      yaru.executeMessages([
        [
          1, // hashi nonce
          100, // target chain id
          2, // threshold
          fakeTargetAmb.address,
          await homeBridgeErcToNative.getAddress(), // receiver
          message,
          [fakeReporter1, fakeReporter2].map(({ address }) => address),
          [fakeAdapter1, fakeAdapter2].map(({ address }) => address),
        ],
      ]),
    ).to.emit(homeBridgeErcToNative, "AffirmationCompleted")

    await expect(
      owner.sendTransaction({
        to: await homeBridgeErcToNative.getAddress(),
        value: amount,
      }),
    ).to.emit(yaho, "MessageDispatched")
  })
})
