const { ethers } = require("hardhat")
const { expect } = require("chai")

const { strip0x, packSignatures, signatureToVrs, append0 } = require("./utils")

const FOREIGN_AMB_PROXY_ADDRESS = "0x4C36d2919e407f0Cc2Ee3c993ccF8ac26d9CE64e"
const FOREIGN_OMNIBRIDGE_PROXY_ADDRESS = "0x88ad09518695c6c3712AC10a214bE5109a655671"
const OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const BRIDGE_VALIDATOR_ADDRESS = "0xed84a648b3c51432ad0fD1C2cD2C45677E9d4064"
const HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2
const MESSAGE_PACKING_VERSION = "00050000"

const GNO_ADDRESS = "0x6810e776880c02933d47db1b9fc05908e5386b96"
const USDC_ADDRESS = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
const WETH_OMNIBRIDGE_ROUTER_ADDRESS = "0xa6439Ca0FCbA1d0F80df0bE6A17220feD9c9038a"

const GNO_WHALE = "0xf0B253afFdE4d348A63e2A5971C3978342c28461"
const USDC_WHALE = "0x55FE002aefF02F77364de339a1292923A15844B8"
const USDT_WHALE = "0x9bC81bAEf5743eb49Ef9ff2D19562080CB519D09"

// NOTE: be sure to run this in a mainnet forked environment
describe("ForeignOmnibridge", () => {
  let foreignAmb,
    foreignOmnibridge,
    WETHOmnibridgeRouter,
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
    gno,
    usdc,
    usdt,
    weth,
    yaho

  beforeEach(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: config.networks.hardhat.forking.url,
            // blockNumber: config.networks.hardhat.forking.blockNumber,
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

    foreignOmnibridge = await ethers.getContractAt("IForeignOmnibridge", FOREIGN_OMNIBRIDGE_PROXY_ADDRESS)
    WETHOmnibridgeRouter = await ethers.getContractAt("IWETHOmnibridgeRouter", WETH_OMNIBRIDGE_ROUTER_ADDRESS)
    gno = await ethers.getContractAt("IERC20", GNO_ADDRESS)
    usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS)
    usdt = await ethers.getContractAt("IERC20", USDT_ADDRESS)
    weth = await ethers.getContractAt("IERC20", WETH_ADDRESS)

    const ForeignAMB = await ethers.getContractFactory("ForeignAMB")
    const BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    const HashiManager = await ethers.getContractFactory("HashiManager")
    const EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
    const MockYaho = await ethers.getContractFactory("MockYaho")
    const MockYaru = await ethers.getContractFactory("MockYaru")

    proxy = await EternalStorageProxy.attach(FOREIGN_AMB_PROXY_ADDRESS)
    bridgeValidators = await BridgeValidators.attach(BRIDGE_VALIDATOR_ADDRESS)

    foreignAmb = await ForeignAMB.deploy()
    await proxy.connect(proxyOwner).upgradeTo("6", await foreignAmb.getAddress())
    foreignAmb = ForeignAMB.attach(await proxy.getAddress())
    await foreignOmnibridge.connect(proxyOwner).setBridgeContract(await proxy.getAddress())

    yaho = await MockYaho.deploy()
    yaru = await MockYaru.deploy(HASHI_TARGET_CHAIN_ID)

    hashiManager = await EternalStorageProxy.deploy()
    const hashiManagerImp = await HashiManager.deploy()
    await hashiManager.upgradeTo("1", await hashiManagerImp.getAddress())
    await hashiManager.transferProxyOwnership(proxyOwner.address)
    hashiManager = await HashiManager.attach(await hashiManager.getAddress())
    await hashiManager.connect(proxyOwner).initialize(proxyOwner.address)

    await foreignAmb.connect(proxyOwner).setHashiManager(await hashiManager.getAddress())
    await hashiManager.connect(proxyOwner).setTargetChainId(HASHI_TARGET_CHAIN_ID)
    await hashiManager
      .connect(proxyOwner)
      .setReportersAdaptersAndThreshold(
        [fakeReporter1.address, fakeReporter2.address],
        [fakeAdapter1.address, fakeAdapter2.address],
        HASHI_THRESHOLD,
      )
    await hashiManager.connect(proxyOwner).setYaho(await yaho.getAddress())
    await hashiManager.connect(proxyOwner).setTargetAddress(fakeTargetAmb.address)
    await hashiManager.connect(proxyOwner).setYaru(await yaru.getAddress())
    await hashiManager.connect(proxyOwner).setExpectedThreshold(HASHI_THRESHOLD)
    await hashiManager
      .connect(proxyOwner)
      .setExpectedAdaptersHash([fakeAdapter1, fakeAdapter2].map(({ address }) => address))

    // NOTE: Add fake validators in order to be able to sign the message
    await bridgeValidators.connect(proxyOwner).addValidator(validator1.address)
    await bridgeValidators.connect(proxyOwner).addValidator(validator2.address)
    await bridgeValidators.connect(proxyOwner).setRequiredSignatures(2)

    expect(await foreignOmnibridge.bridgeContract()).to.equal(await foreignAmb.getAddress())
  })

  it("should be able to relay major tokens", async () => {
    // GNO
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [GNO_WHALE],
    })
    const gnoWhale = await ethers.getSigner(GNO_WHALE)
    const gnoAmount = ethers.parseUnits("10", 18)
    const gnoBalanceBefore = await gno.balanceOf(GNO_WHALE)
    const bridgeGNOBalanceBefore = await gno.balanceOf(await foreignOmnibridge.getAddress())

    await gno.connect(gnoWhale).approve(await foreignOmnibridge.getAddress(), await gno.balanceOf(GNO_WHALE))

    await expect(foreignOmnibridge.connect(gnoWhale).relayTokens(GNO_ADDRESS, fakeReceiver.address, gnoAmount))
      .to.emit(foreignOmnibridge, "TokensBridgingInitiated")
      .to.emit(foreignAmb, "UserRequestForAffirmation")
      .to.emit(yaho, "MessageDispatched")
    expect(await gno.balanceOf(GNO_WHALE)).to.equal(gnoBalanceBefore - gnoAmount)
    expect(await gno.balanceOf(await foreignOmnibridge.getAddress())).to.equal(bridgeGNOBalanceBefore + gnoAmount)

    // USDC
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_WHALE],
    })
    const usdcWhale = await ethers.getSigner(USDC_WHALE)
    const usdcAmount = ethers.parseUnits("10", 6)
    const usdcBalanceBefore = await usdc.balanceOf(USDC_WHALE)
    const bridgeUSDCBalanceBefore = await usdc.balanceOf(await foreignOmnibridge.getAddress())

    await usdc.connect(usdcWhale).approve(await foreignOmnibridge.getAddress(), await usdc.balanceOf(USDC_WHALE))

    await expect(foreignOmnibridge.connect(usdcWhale).relayTokens(USDC_ADDRESS, fakeReceiver.address, usdcAmount))
      .to.emit(foreignOmnibridge, "TokensBridgingInitiated")
      .to.emit(foreignAmb, "UserRequestForAffirmation")
      .to.emit(yaho, "MessageDispatched")

    expect(await usdc.balanceOf(USDC_WHALE)).to.equal(usdcBalanceBefore - usdcAmount)
    expect(await usdc.balanceOf(await foreignOmnibridge.getAddress())).to.equal(bridgeUSDCBalanceBefore + usdcAmount)

    // USDT
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDT_WHALE],
    })
    const usdtWhale = await ethers.getSigner(USDT_WHALE)
    const usdtAmount = ethers.parseUnits("10", 6)
    const usdtBalanceBefore = await usdt.balanceOf(USDT_WHALE)
    const bridgeUSDTBalanceBefore = await usdt.balanceOf(await foreignOmnibridge.getAddress())

    await usdt.connect(usdtWhale).approve(await foreignOmnibridge.getAddress(), await usdt.balanceOf(USDT_WHALE))

    await expect(foreignOmnibridge.connect(usdtWhale).relayTokens(USDT_ADDRESS, fakeReceiver.address, usdtAmount))
      .to.emit(foreignOmnibridge, "TokensBridgingInitiated")
      .to.emit(foreignAmb, "UserRequestForAffirmation")
      .to.emit(yaho, "MessageDispatched")

    expect(await usdt.balanceOf(USDT_WHALE)).to.equal(usdtBalanceBefore - usdtAmount)
    expect(await usdt.balanceOf(await foreignOmnibridge.getAddress())).to.equal(bridgeUSDTBalanceBefore + usdtAmount)
  })

  it("WETH Omnibridge Router should work correctly", async () => {
    const amount = ethers.parseEther("10")
    const senderBalanceBefore = await ethers.provider.getBalance(fakeReceiver.address)
    const bridgeWETHBalanceBefore = await weth.balanceOf(await foreignOmnibridge.getAddress())
    await expect(WETHOmnibridgeRouter.connect(fakeReceiver).wrapAndRelayTokens(fakeReceiver.address, { value: amount }))
      .to.emit(foreignOmnibridge, "TokensBridgingInitiated")
      .to.emit(foreignAmb, "UserRequestForAffirmation")
      .to.emit(yaho, "MessageDispatched")

    expect(await ethers.provider.getBalance(fakeReceiver.address)).to.lessThan(senderBalanceBefore - amount)
    expect(await weth.balanceOf(await foreignOmnibridge.getAddress())).to.equal(bridgeWETHBalanceBefore + amount)
  })

  it("should receive token correctly without Hashi as it's optional", async () => {
    // USDC
    const usdcAmount = ethers.parseUnits("10", 6)
    const usdcAmountBefore = await usdc.balanceOf(fakeReceiver.address)
    const bridgeUSDCAmountBefore = await usdc.balanceOf(await foreignOmnibridge.getAddress())
    const msgId = "0x" + MESSAGE_PACKING_VERSION.padEnd(63, "0") + "1"
    const message =
      `${msgId}` +
      "f6a78083ca3e2a662d6dd1703c939c8ace2e268d" + // sender: Omnibridge on Home Chain
      `${strip0x(await foreignOmnibridge.getAddress())}` + // contractAddress
      "000927c0" + // gasLimit
      "01" + // source chain id length
      "01" + // destination chain id length
      "80" + // dataType
      "64" + // source chain id
      "01" + // destination chain id
      "272255bb" + // function signature (handleNativeToken)
      `${strip0x(USDC_ADDRESS).padStart(64, "0")}` +
      `${strip0x(fakeReceiver.address).padStart(64, "0")}` +
      `${strip0x(ethers.toBeHex(usdcAmount)).padStart(64, "0")}`

    const signatures = await Promise.all(
      [validator1, validator2].map((_validator) => _validator.signMessage(append0(ethers.toBeArray(message)))),
    )
    const packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))
    await expect(foreignAmb.executeSignatures(message, packedSignatures))
      .to.emit(foreignAmb, "RelayedMessage")
      .to.emit(foreignOmnibridge, "TokensBridged")
    await expect(foreignAmb.executeSignatures(message, packedSignatures)).to.be.reverted

    expect(await usdc.balanceOf(fakeReceiver.address)).to.equal(usdcAmountBefore + usdcAmount)
    expect(await usdc.balanceOf(await foreignOmnibridge.getAddress())).to.equal(bridgeUSDCAmountBefore - usdcAmount)
  })

  it("should receive token corretly with Hashi as it's optional", async () => {
    // USDC
    const usdcAmount = ethers.parseUnits("10", 6)
    const usdcAmountBefore = await usdc.balanceOf(fakeReceiver.address)
    const bridgeUSDCAmountBefore = await usdc.balanceOf(await foreignOmnibridge.getAddress())
    const msgId = "0x" + MESSAGE_PACKING_VERSION.padEnd(63, "0") + "1"
    const message =
      `${msgId}` +
      "f6a78083ca3e2a662d6dd1703c939c8ace2e268d" + // sender: Omnibridge on Home Chain
      `${strip0x(await foreignOmnibridge.getAddress())}` + // contractAddress
      "000927c0" + // gasLimit
      "01" + // source chain id length
      "01" + // destination chain id length
      "80" + // dataType
      "64" + // source chain id
      "01" + // destination chain id
      "272255bb" + // function signature (handleNativeToken)
      `${strip0x(USDC_ADDRESS).padStart(64, "0")}` +
      `${strip0x(fakeReceiver.address).padStart(64, "0")}` +
      `${strip0x(ethers.toBeHex(usdcAmount)).padStart(64, "0")}`
    console.log("message ", message)

    const signatures = await Promise.all(
      [validator1, validator2].map((_validator) => _validator.signMessage(append0(ethers.toBeArray(message)))),
    )
    const packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))

    expect(
      await yaru.executeMessages([
        [
          1, // nonce
          HASHI_TARGET_CHAIN_ID,
          2, // threshold
          fakeTargetAmb.address,
          await foreignAmb.getAddress(), // receiver
          message,
          [fakeReporter1, fakeReporter2].map(({ address }) => address),
          [fakeAdapter1, fakeAdapter2].map(({ address }) => address),
        ],
      ]),
    ).to.emit(yaru, "MessageExecuted")
    expect(await foreignAmb.isApprovedByHashi(ethers.solidityPackedKeccak256(["bytes"], [message]))).to.be.true

    await expect(foreignAmb.executeSignatures(message, packedSignatures))
      .to.emit(foreignAmb, "RelayedMessage")
      .to.emit(foreignOmnibridge, "TokensBridged")
    await expect(foreignAmb.executeSignatures(message, packedSignatures)).to.be.reverted

    expect(await usdc.balanceOf(fakeReceiver.address)).to.equal(usdcAmountBefore + usdcAmount)
    expect(await usdc.balanceOf(await foreignOmnibridge.getAddress())).to.equal(bridgeUSDCAmountBefore - usdcAmount)
  })
})
