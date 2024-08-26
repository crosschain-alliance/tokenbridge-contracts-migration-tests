const { ethers, config } = require("hardhat")
const { expect } = require("chai")

const { strip0x } = require("./utils")

const HOME_OMNIBRIDGE_PROXY_ADDRESS = "0xf6A78083ca3e2a662D6dd1703c939c8aCE2e268d"
const HOME_AMB_PROXY_ADDRESS = "0x75Df5AF045d91108662D8080fD1FEFAd6aA0bb59"
const FOREIGN_AMB_PROXY_ADDRESS = "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e"
const FOREIGN_OMNIBRIDGE_PROXY_ADDRESS = "0x88ad09518695c6c3712ac10a214be5109a655671"
const OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"

const BRIDGE_VALIDATOR_ADDRESS = "0xa280fed8d7cad9a76c8b50ca5c33c2534ffa5008"
const HASHI_TARGET_CHAIN_ID = 1
const HASHI_THRESHOLD = 2
const MESSAGE_PACKING_VERSION = "00050000"
const USER_REQUEST_FOR_SIGNATURE_TOPIC = "0x520d2afde79cbd5db58755ac9480f81bc658e5c517fcae7365a3d832590b0183"
const WRAPPED_GNO = "0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb"
const WRAPPED_USDC = "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83"
const WRAPPED_USDT = "0x4ECaBa5870353805a9F068101A40E0f32ed605C6"
const WRAPPED_WETH = "0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1"
const GNO = "0x6810e776880C02933D47DB1b9fc05908e5386b96"

const GNO_WHALE = "0xEFBBfB08115B0F6a2825A9a186baA5777F5d2494"
const USDC_WHALE = "0x4E51f628Ec0813964c13107fFfa4C989069E5575"
const USDT_WHALE = "0x1098503a90c3224F0e6BE7c124a337888C0BA564"
const WETH_WHALE = "0xbb0ADb1fC2cb1B7b690BD45cFC8903CB04e1c06c"

// NOTE: be sure to run this in a gnosis chain forked environment
describe("HomeOmnibridge", () => {
  let homeAmb,
    homeOmnibridge,
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
    hashiManager,
    receiver,
    wrappedGNO,
    wrappedUSDC,
    wrappedUSDT,
    wrappedWETH,
    yaho

  beforeEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: config.networks.hardhat.forking.url,
            //   blockNumber: config.networks.hardhat.forking.blockNumber,
          },
        },
      ],
    })
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

    homeOmnibridge = await ethers.getContractAt("IHomeOmnibridge", HOME_OMNIBRIDGE_PROXY_ADDRESS)
    wrappedGNO = await ethers.getContractAt("IPermittableToken", WRAPPED_GNO)
    wrappedUSDC = await ethers.getContractAt("IPermittableToken", WRAPPED_USDC)
    wrappedUSDT = await ethers.getContractAt("IPermittableToken", WRAPPED_USDT)
    wrappedWETH = await ethers.getContractAt("IPermittableToken", WRAPPED_WETH)
    const HomeAMB = await ethers.getContractFactory("HomeAMB")

    const BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    const HashiManager = await ethers.getContractFactory("HashiManager")
    const EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
    const MockYaho = await ethers.getContractFactory("MockYaho")
    const MockYaru = await ethers.getContractFactory("MockYaru")

    proxy = await EternalStorageProxy.attach(HOME_AMB_PROXY_ADDRESS)
    bridgeValidators = await BridgeValidators.attach(BRIDGE_VALIDATOR_ADDRESS)

    homeAmb = await HomeAMB.deploy()
    await proxy.connect(proxyOwner).upgradeTo("6", await homeAmb.getAddress())
    homeAmb = HomeAMB.attach(await proxy.getAddress())

    yaho = await MockYaho.deploy()
    yaru = await MockYaru.deploy(HASHI_TARGET_CHAIN_ID)

    hashiManager = await EternalStorageProxy.deploy()
    const hashiManagerImp = await HashiManager.deploy()
    await hashiManager.upgradeTo("1", await hashiManagerImp.getAddress())
    await hashiManager.transferProxyOwnership(proxyOwner.address)
    hashiManager = await HashiManager.attach(await hashiManager.getAddress())
    await hashiManager.connect(proxyOwner).initialize(proxyOwner.address)

    await homeAmb.connect(proxyOwner).setHashiManager(await hashiManager.getAddress())
    await hashiManager.connect(proxyOwner).setTargetChainId(HASHI_TARGET_CHAIN_ID)
    await hashiManager
      .connect(proxyOwner)
      .setReportersAdaptersAndThreshold(
        [fakeReporter1.address, fakeReporter2.address],
        [fakeAdapter1.address, fakeAdapter2.address],
        HASHI_THRESHOLD,
      )
    await hashiManager.connect(proxyOwner).setYaho(await yaho.getAddress())
    await hashiManager.connect(proxyOwner).setTargetAddress(FOREIGN_AMB_PROXY_ADDRESS)
    await hashiManager.connect(proxyOwner).setYaru(await yaru.getAddress())
    await hashiManager.connect(proxyOwner).setExpectedThreshold(HASHI_THRESHOLD)
    await hashiManager
      .connect(proxyOwner)
      .setExpectedAdaptersHash([fakeAdapter1, fakeAdapter2].map(({ address }) => address))

    // NOTE: Add fake validators in order to be able to sign the message
    await bridgeValidators.connect(proxyOwner).addValidator(validator1.address)
    await bridgeValidators.connect(proxyOwner).addValidator(validator2.address)
    await bridgeValidators.connect(proxyOwner).setRequiredSignatures(2)
  })

  it("should be able to relay major tokens", async () => {
    // GNO
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GNO_WHALE],
    })
    const gnoWhale = await ethers.getSigner(GNO_WHALE)
    const gnoAmount = ethers.parseUnits("10", 18)
    const gnoBalanceBefore = await wrappedGNO.balanceOf(GNO_WHALE)
    const bridgeGNOBalanceBefore = await wrappedGNO.balanceOf(await homeOmnibridge.getAddress())
    await wrappedGNO.connect(gnoWhale).approve(await homeOmnibridge.getAddress(), await wrappedGNO.balanceOf(GNO_WHALE))
    await expect(homeOmnibridge.connect(gnoWhale).relayTokens(WRAPPED_GNO, fakeReceiver.address, gnoAmount))
      .to.emit(homeOmnibridge, "TokensBridgingInitiated")
      .to.emit(homeAmb, "UserRequestForSignature")
      .to.emit(yaho, "MessageDispatched")
    expect(await wrappedGNO.balanceOf(GNO_WHALE)).to.equal(gnoBalanceBefore - gnoAmount)
    expect(await wrappedGNO.balanceOf(await homeOmnibridge.getAddress())).to.equal(bridgeGNOBalanceBefore)
    // USDC
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_WHALE],
    })
    const usdcWhale = await ethers.getSigner(USDC_WHALE)
    const usdcAmount = ethers.parseUnits("10", 6)
    const usdcBalanceBefore = await wrappedUSDC.balanceOf(USDC_WHALE)
    const bridgeUSDCBalanceBefore = await wrappedUSDC.balanceOf(await homeOmnibridge.getAddress())
    await wrappedUSDC
      .connect(usdcWhale)
      .approve(await homeOmnibridge.getAddress(), await wrappedUSDC.balanceOf(USDC_WHALE))
    await expect(homeOmnibridge.connect(usdcWhale).relayTokens(WRAPPED_USDC, fakeReceiver.address, usdcAmount))
      .to.emit(homeOmnibridge, "TokensBridgingInitiated")
      .to.emit(homeAmb, "UserRequestForSignature")
      .to.emit(yaho, "MessageDispatched")
    expect(await wrappedUSDC.balanceOf(USDC_WHALE)).to.equal(usdcBalanceBefore - usdcAmount)
    expect(await wrappedUSDC.balanceOf(await homeOmnibridge.getAddress())).to.equal(bridgeUSDCBalanceBefore)
    // USDT
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDT_WHALE],
    })
    const usdtWhale = await ethers.getSigner(USDT_WHALE)
    const usdtAmount = ethers.parseUnits("10", 6)
    const usdtBalanceBefore = await wrappedUSDT.balanceOf(USDT_WHALE)
    const bridgeUSDTBalanceBefore = await wrappedUSDT.balanceOf(await homeOmnibridge.getAddress())
    await wrappedUSDT
      .connect(usdtWhale)
      .approve(await homeOmnibridge.getAddress(), await wrappedUSDT.balanceOf(USDT_WHALE))
    await expect(homeOmnibridge.connect(usdtWhale).relayTokens(WRAPPED_USDT, fakeReceiver.address, usdtAmount))
      .to.emit(homeOmnibridge, "TokensBridgingInitiated")
      .to.emit(homeAmb, "UserRequestForSignature")
      .to.emit(yaho, "MessageDispatched")
    expect(await wrappedUSDT.balanceOf(USDT_WHALE)).to.equal(usdtBalanceBefore - usdtAmount)
    expect(await wrappedUSDT.balanceOf(await homeOmnibridge.getAddress())).to.equal(bridgeUSDTBalanceBefore)
    // WETH
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [WETH_WHALE],
    })
    const wethWhale = await ethers.getSigner(WETH_WHALE)
    const wethAmount = ethers.parseUnits("10", 18)
    const wethBalanceBefore = await wrappedWETH.balanceOf(WETH_WHALE)
    const bridgeWETHBalanceBefore = await wrappedWETH.balanceOf(await homeOmnibridge.getAddress())
    await wrappedWETH
      .connect(wethWhale)
      .approve(await homeOmnibridge.getAddress(), await wrappedWETH.balanceOf(WETH_WHALE))
    await expect(homeOmnibridge.connect(wethWhale).relayTokens(WRAPPED_WETH, fakeReceiver.address, wethAmount))
      .to.emit(homeOmnibridge, "TokensBridgingInitiated")
      .to.emit(homeAmb, "UserRequestForSignature")
      .to.emit(yaho, "MessageDispatched")
    expect(await wrappedWETH.balanceOf(WETH_WHALE)).to.equal(wethBalanceBefore - wethAmount)
    expect(await wrappedWETH.balanceOf(await homeOmnibridge.getAddress())).to.equal(bridgeWETHBalanceBefore)
  })

  it("should be able to execute an affirmation even without the Hashi approval as it's optional", async () => {
    expect(await homeOmnibridge.bridgeContract()).to.equal(await homeAmb.getAddress())

    const gnoAmount = ethers.parseUnits("1", 18)
    const gnoAmountBefore = await wrappedGNO.balanceOf(fakeReceiver.address)
    const bridgeGNOAmountBefore = await wrappedGNO.balanceOf(HOME_OMNIBRIDGE_PROXY_ADDRESS)
    const msgId = "0x" + MESSAGE_PACKING_VERSION.padEnd(63, "0") + "9"
    const message =
      `${msgId}` +
      `${strip0x(FOREIGN_OMNIBRIDGE_PROXY_ADDRESS)}` + // sender: foreign Omnibridge
      `${strip0x(HOME_OMNIBRIDGE_PROXY_ADDRESS)}` + // executor: home Omnibridge
      "001e8480" + // gasLimit
      "01" + // source chain id length
      "01" + // destination chain id length
      "00" + // dataType
      "01" + // source chain id
      "64" + // destination chain id
      "125e4cfb" + // function signature (handle bridged Token)
      `${strip0x(GNO).padStart(64, "0")}` +
      `${strip0x(fakeReceiver.address).padStart(64, "0")}` +
      `${strip0x(ethers.toBeHex(gnoAmount)).padStart(64, "0")}`

    await expect(homeAmb.connect(validator1).executeAffirmation(message)).to.emit(homeAmb, "SignedForAffirmation")

    await expect(homeAmb.connect(validator2).executeAffirmation(message))
      .to.emit(homeAmb, "AffirmationCompleted")
      .to.emit(homeAmb, "SignedForAffirmation")
      .to.emit(homeOmnibridge, "TokensBridged")
    await expect(homeAmb.connect(validator1).executeAffirmation(message)).to.be.reverted

    expect(await wrappedGNO.balanceOf(fakeReceiver.address)).to.equal(gnoAmountBefore + gnoAmount)
    expect(await wrappedGNO.balanceOf(HOME_OMNIBRIDGE_PROXY_ADDRESS)).to.equal(bridgeGNOAmountBefore)
  })

  it("should be able to execute an affirmation with a validator after the message has been approved by hashi", async () => {
    expect(await homeOmnibridge.bridgeContract()).to.equal(await homeAmb.getAddress())
    const gnoAmount = ethers.parseUnits("10", 18)
    const gnoAmountBefore = await wrappedGNO.balanceOf(fakeReceiver.address)
    const bridgeGNOAmountBefore = await wrappedGNO.balanceOf(HOME_OMNIBRIDGE_PROXY_ADDRESS)
    const msgId = "0x" + MESSAGE_PACKING_VERSION.padEnd(63, "0") + "1"
    const message =
      `${msgId}` +
      `${strip0x(FOREIGN_OMNIBRIDGE_PROXY_ADDRESS)}` + // sender: foreign Omnibridge
      `${strip0x(HOME_OMNIBRIDGE_PROXY_ADDRESS)}` +
      //   `${strip0x(HOME_OMNIBRIDGE_PROXY_ADDRESS)}` + // contractAddress
      "001e8480" + // gasLimit
      "01" + // source chain id length
      "01" + // destination chain id length
      "00" + // dataType
      "01" + // source chain id
      "64" + // destination chain id
      "125e4cfb" + // function signature (handle bridged Token)
      `${strip0x(GNO).padStart(64, "0")}` +
      `${strip0x(fakeReceiver.address).padStart(64, "0")}` +
      `${strip0x(ethers.toBeHex(gnoAmount)).padStart(64, "0")}`

    await yaru.executeMessages([
      [
        1, // nonce
        100, // target chain id
        2, // threshold
        FOREIGN_AMB_PROXY_ADDRESS,
        HOME_AMB_PROXY_ADDRESS, // receiver
        message,
        [fakeReporter1, fakeReporter2].map(({ address }) => address),
        [fakeAdapter1, fakeAdapter2].map(({ address }) => address),
      ],
    ])
    expect(await homeAmb.isApprovedByHashi(ethers.solidityPackedKeccak256(["bytes"], [message]))).to.be.true

    await expect(homeAmb.connect(validator1).executeAffirmation(message)).to.emit(homeAmb, "SignedForAffirmation")

    await expect(homeAmb.connect(validator2).executeAffirmation(message))
      .to.emit(homeAmb, "AffirmationCompleted")
      .to.emit(homeAmb, "SignedForAffirmation")
      .to.emit(homeOmnibridge, "TokensBridged")

    await expect(homeAmb.connect(validator1).executeAffirmation(message)).to.be.reverted

    expect(await wrappedGNO.balanceOf(fakeReceiver.address)).to.equal(gnoAmountBefore + gnoAmount)
    expect(await wrappedGNO.balanceOf(HOME_OMNIBRIDGE_PROXY_ADDRESS)).to.equal(bridgeGNOAmountBefore)
  })
})
