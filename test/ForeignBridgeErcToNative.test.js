const { ethers } = require("hardhat")
const { expect } = require("chai")

const { packSignatures, signatureToVrs } = require("./utils")

const FOREIGN_XDAI_PROXY_ADDRESS = "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016"
const OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const BRIDGE_VALIDATOR_ADDRESS = "0xe1579dEbdD2DF16Ebdb9db8694391fa74EeA201E"
const HASHI_TARGET_CHAIN_ID = 100
const HASHI_THRESHOLD = 2
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const DAI_FAUCET_ADDRESS = "0xD1668fB5F690C59Ab4B0CAbAd0f8C1617895052B"

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
    fakeTargetForeignBridgeErcToNative,
    dai,
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
    fakeTargetForeignBridgeErcToNative = signers[8]
    sender = signers[9]
    receiver = signers[10]

    await owner.sendTransaction({
      to: OWNER_ADDRESS,
      value: ethers.parseEther("1"),
    })

    const ForeignBridgeErcToNative = await ethers.getContractFactory("ForeignBridgeErcToNative")
    const OwnedUpgradeabilityProxy = await ethers.getContractFactory("OwnedUpgradeabilityProxy")
    const BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    const HashiManager = await ethers.getContractFactory("HashiManager")
    const EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
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

    hashiManager = await EternalStorageProxy.deploy()
    const hashiManagerImp = await HashiManager.deploy()
    await hashiManager.upgradeTo("1", await hashiManagerImp.getAddress())
    await hashiManager.transferProxyOwnership(proxyOwner.address)
    hashiManager = await HashiManager.attach(await hashiManager.getAddress())
    await hashiManager.connect(proxyOwner).initialize(proxyOwner.address)

    await foreignBridgeErcToNative.connect(proxyOwner).setHashiManager(await hashiManager.getAddress())
    await hashiManager.connect(proxyOwner).setTargetChainId(HASHI_TARGET_CHAIN_ID)
    await hashiManager
      .connect(proxyOwner)
      .setReportersAdaptersAndThreshold(
        [fakeReporter1.address, fakeReporter2.address],
        [fakeAdapter1.address, fakeAdapter2.address],
        HASHI_THRESHOLD,
      )
    await hashiManager.connect(proxyOwner).setYaho(await yaho.getAddress())
    await hashiManager.connect(proxyOwner).setTargetAddress(fakeTargetForeignBridgeErcToNative.address)
    await hashiManager.connect(proxyOwner).setYaru(await yaru.getAddress())
    await hashiManager.connect(proxyOwner).setExpectedThreshold(HASHI_THRESHOLD)
    await hashiManager
      .connect(proxyOwner)
      .setExpectedAdaptersHash([fakeAdapter1, fakeAdapter2].map(({ address }) => address))

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

  it("should be able to release 10 event without hashi approval as it's optional", async () => {
    const amount = ethers.parseEther("10")
    const nonce = ethers.toBeHex(1, 32)
    const message = ethers.solidityPacked(
      ["address", "uint256", "bytes32", "address"],
      [fakeReceiver.address, amount, nonce, await foreignBridgeErcToNative.getAddress()],
    )

    const signatures = await Promise.all(
      [validator1, validator2].map((_validator) => _validator.signMessage(ethers.toBeArray(message))),
    )
    const packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))
    await expect(foreignBridgeErcToNative.executeSignatures(message, packedSignatures)).to.emit(dai, "Transfer")
    await expect(foreignBridgeErcToNative.executeSignatures(message, packedSignatures)).to.be.reverted
  })

  it("should be able to release 10 only once after hashi approval", async () => {
    const amount = ethers.parseEther("10")
    const nonce = ethers.toBeHex(1, 32)
    const message = ethers.solidityPacked(
      ["address", "uint256", "bytes32", "address"],
      [fakeReceiver.address, amount, nonce, await foreignBridgeErcToNative.getAddress()],
    )

    const signatures = await Promise.all(
      [validator1, validator2].map((_validator) => _validator.signMessage(ethers.toBeArray(message))),
    )
    const packedSignatures = packSignatures(signatures.map((_sig) => signatureToVrs(_sig)))
    const hashiMessage = ethers.solidityPacked(["address", "uint256", "bytes32"], [fakeReceiver.address, amount, nonce])
    await yaru.executeMessages([
      [
        1,
        HASHI_TARGET_CHAIN_ID,
        2,
        fakeTargetForeignBridgeErcToNative.address,
        await foreignBridgeErcToNative.getAddress(),
        hashiMessage,
        [fakeReporter1, fakeReporter2].map(({ address }) => address),
        [fakeAdapter1, fakeAdapter2].map(({ address }) => address),
      ],
    ])
    expect(await foreignBridgeErcToNative.isApprovedByHashi(ethers.keccak256(hashiMessage))).to.be.true
    await expect(foreignBridgeErcToNative.executeSignatures(message, packedSignatures)).to.emit(dai, "Transfer")
    await expect(foreignBridgeErcToNative.executeSignatures(message, packedSignatures)).to.be.reverted
  })
})
