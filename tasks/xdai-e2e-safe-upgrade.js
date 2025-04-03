const { task } = require("hardhat/config")

const { packSignatures, signatureToVrs } = require("../test/utils/index")
const {
  getRelevantDataFromEvents,
  getValidatorsSignatures,
  getSafeHomeAndForeignPendingTransactionsFromLinks,
  getApprovedHashSignerAndConfirmationFromPendingTransactions,
} = require("./utils/index")

const FOREIGN_XDAI_PROXY_ADDRESS = "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016"
const FOREIGN_SAFE_PROXY_OWNER_ADDRESS = "0x42F38ec5A75acCEc50054671233dfAC9C0E7A3F6"
const FOREIGN_BRIDGE_VALIDATOR_ADDRESS = "0xe1579dEbdD2DF16Ebdb9db8694391fa74EeA201E"
const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const DAI_FAUCET_ADDRESS = "0xD1668fB5F690C59Ab4B0CAbAd0f8C1617895052B"

const HOME_XDAI_PROXY_ADDRESS = "0x7301CFA0e1756B71869E93d4e4Dca5c7d0eb0AA6"
const HOME_SAFE_PROXY_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS = "0x7a48dac683da91e4faa5ab13d91ab5fd170875bd"
const HOME_BRIDGE_VALIDATOR_ADDRESS = "0xb289f0e6fbdff8eee340498a56e1787b303f1b6d"

const USER_REQUEST_FOR_AFFIRMATION_TOPIC = "0xf6968e689b3d8c24f22c10c2a3256bb5ca483a474e11bac08423baa049e38ae8"
const USER_REQUEST_FOR_SIGNATURE_TOPIC = "0xbcb4ebd89690a7455d6ec096a6bfc4a8a891ac741ffe4e678ea2614853248658"
const ADDED_RECEIVER_TOPIC = "0x3c798bbcf33115b42c728b8504cff11dd58736e9fa789f1cda2738db7d696b2a"

/**
 * How to run this:
 * - npx hardhat node --fork <your-ethereum-node>
 * - npx hardhat node --fork <your-gnosis-node> --port 8544
 * - npx hardhat XDAIBridge:e2e-safe-upgrade --network fmainnet --home-safe-tx-link "" --foreign-safe-tx-link ""
 */
task("XDAIBridge:e2e-safe-upgrade")
  .addParam("homeSafeTxLink", "ex: https://app.safe.global/transactions/tx?safe=gno:&id=")
  .addParam("foreignSafeTxLink", "ex: https://app.safe.global/transactions/tx?safe=eth:&id=")
  .setAction(async (args, hre) => {
    const { homeSafeTxLink, foreignSafeTxLink } = args
    const { ethers, network } = hre
    const abiCoder = new ethers.AbiCoder()

    let ForeignBridgeErcToNative = await ethers.getContractFactory("ForeignBridgeErcToNative")
    let BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    let Token = await ethers.getContractFactory("Token")
    let Safe = await ethers.getContractFactory("Safe")

    console.log("fetching transactions from safe api ...")
    const { homePendingTransaction, foreignPendingTransaction } =
      await getSafeHomeAndForeignPendingTransactionsFromLinks(homeSafeTxLink, foreignSafeTxLink)

    // M A I N N E T
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [FOREIGN_SAFE_PROXY_OWNER_ADDRESS],
    })

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [DAI_FAUCET_ADDRESS],
    })

    const foreignSafeProxyOwner = await ethers.provider.getSigner(FOREIGN_SAFE_PROXY_OWNER_ADDRESS)
    const daiFaucet = await ethers.provider.getSigner(DAI_FAUCET_ADDRESS)
    signers = await ethers.getSigners()
    const foreignOwner = signers[0]

    await foreignOwner.sendTransaction({
      to: FOREIGN_SAFE_PROXY_OWNER_ADDRESS,
      value: ethers.parseEther("1"),
    })

    const { owner: foreignSafeOwner1, confirmation: foreignConfirmation } =
      await getApprovedHashSignerAndConfirmationFromPendingTransactions(foreignPendingTransaction, foreignOwner)

    // NOTE: Add fake validators in order to be able to sign the message
    const foreignValidator1 = signers[6]
    const foreignValidator2 = signers[7]
    foreignBridgeValidators = await BridgeValidators.attach(FOREIGN_BRIDGE_VALIDATOR_ADDRESS)
    foreignBridgeErcToNative = await ForeignBridgeErcToNative.attach(FOREIGN_XDAI_PROXY_ADDRESS)
    await foreignBridgeValidators.connect(foreignSafeProxyOwner).addValidator(foreignValidator1.address)
    await foreignBridgeValidators.connect(foreignSafeProxyOwner).addValidator(foreignValidator2.address)
    await foreignBridgeValidators.connect(foreignSafeProxyOwner).setRequiredSignatures(2)

    dai = await Token.attach(DAI_ADDRESS)
    await dai.connect(daiFaucet).transfer(foreignOwner.address, ethers.parseUnits("100000", 18))

    const foreignSafe = await Safe.attach(FOREIGN_SAFE_PROXY_OWNER_ADDRESS)
    // forcing the safe to have threshold = 1
    await network.provider.send("hardhat_setStorageAt", [
      FOREIGN_SAFE_PROXY_OWNER_ADDRESS,
      "0x4", //threshold slot
      "0x0000000000000000000000000000000000000000000000000000000000000001", // threshold = 1
    ])
    await foreignSafe.connect(foreignSafeOwner1).approveHash(foreignPendingTransaction.safeTxHash)
    // these parameters are taken from the safe UI
    await foreignSafe
      .connect(foreignSafeOwner1)
      .execTransaction(
        foreignPendingTransaction.to,
        foreignPendingTransaction.value,
        foreignPendingTransaction.data,
        foreignPendingTransaction.operation,
        foreignPendingTransaction.safeTxGas,
        foreignPendingTransaction.baseGas,
        foreignPendingTransaction.gasPrice,
        foreignPendingTransaction.gasToken,
        foreignPendingTransaction.refundReceiver,
        foreignConfirmation.signature,
      )
    console.log("Upgrade on Ethereum correctly executed ...")

    // G N O S I S
    await hre.changeNetwork("fgnosis")
    ForeignBridgeErcToNative = await ethers.getContractFactory("ForeignBridgeErcToNative")
    BridgeValidators = await ethers.getContractFactory("BridgeValidators")
    EternalStorageProxy = await ethers.getContractFactory("EternalStorageProxy")
    Token = await ethers.getContractFactory("Token")
    HomeBridgeErcToNative = await ethers.getContractFactory("HomeBridgeErcToNative")
    BridgeValidators = await ethers.getContractFactory("BridgeValidators")

    signers = await ethers.getSigners()
    const homeOwner = signers[0]
    const homeReceiver = signers[1]
    const homeBridgeValidatorOwner = await ethers.provider.getSigner(HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS)

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [HOME_SAFE_PROXY_OWNER_ADDRESS],
    })
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS],
    })

    const { owner: homeSafeOwner1, confirmation: homeConfirmation } =
      await getApprovedHashSignerAndConfirmationFromPendingTransactions(homePendingTransaction, homeOwner)

    await homeOwner.sendTransaction({
      to: HOME_SAFE_PROXY_OWNER_ADDRESS,
      value: ethers.parseEther("1"),
    })
    await homeOwner.sendTransaction({
      to: HOME_BRIDGE_VALIDATOR_OWNER_ADDRESS,
      value: ethers.parseEther("1"),
    })

    // NOTE: Add fake validators in order to be able to sign the message
    homeBridgeValidators = await BridgeValidators.attach(HOME_BRIDGE_VALIDATOR_ADDRESS)
    homeBridgeErcToNative = await HomeBridgeErcToNative.attach(HOME_XDAI_PROXY_ADDRESS)
    const homeValidator1 = signers[6]
    const homeValidator2 = signers[7]
    await homeBridgeValidators.connect(homeBridgeValidatorOwner).addValidator(homeValidator1.address)
    await homeBridgeValidators.connect(homeBridgeValidatorOwner).addValidator(homeValidator2.address)
    await homeBridgeValidators.connect(homeBridgeValidatorOwner).setRequiredSignatures(2)

    const homeSafe = await Safe.attach(HOME_SAFE_PROXY_OWNER_ADDRESS)
    await network.provider.send("hardhat_setStorageAt", [
      HOME_SAFE_PROXY_OWNER_ADDRESS,
      "0x4", //threshold slot
      "0x0000000000000000000000000000000000000000000000000000000000000001", // threshold = 1
    ])
    await homeSafe.connect(homeSafeOwner1).approveHash(homePendingTransaction.safeTxHash)
    await homeSafe
      .connect(homeSafeOwner1)
      .execTransaction(
        homePendingTransaction.to,
        homePendingTransaction.value,
        homePendingTransaction.data,
        homePendingTransaction.operation,
        homePendingTransaction.safeTxGas,
        homePendingTransaction.baseGas,
        homePendingTransaction.gasPrice,
        homePendingTransaction.gasToken,
        homePendingTransaction.refundReceiver,
        homeConfirmation.signature,
      )
    console.log("Upgrade on Gnosis correctly executed ...")

    // E T H E R E U M   --->   G N O S I S
    await hre.changeNetwork("fmainnet")
    let amount = ethers.parseUnits("10", 18)
    await dai.approve(await foreignBridgeErcToNative.getAddress(), amount)

    balancePre = await dai.balanceOf(homeOwner.address)
    let tx = await foreignBridgeErcToNative.relayTokens(homeReceiver.address, amount)
    balancePost = await dai.balanceOf(homeOwner.address)
    if (balancePre - BigInt(amount.toString()) != balancePost) throw new Error("Ops, someting weird happened")

    const { messageArgs: foreignMessageArgs } = getRelevantDataFromEvents({
      bridge: "xdai",
      topic: USER_REQUEST_FOR_AFFIRMATION_TOPIC,
      receipt: await tx.wait(1),
    })

    await hre.changeNetwork("fgnosis")
    await homeBridgeErcToNative.connect(homeValidator1).executeAffirmation(...foreignMessageArgs)
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
    const { message: homeMessage } = getRelevantDataFromEvents({
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
    balancePre = await dai.balanceOf(homeOwner.address)
    await foreignBridgeErcToNative.executeSignatures(
      homeMessageToSign,
      packSignatures(signatures.map((_sig) => signatureToVrs(_sig))),
    )
    balancePost = await dai.balanceOf(homeOwner.address)
    if (balancePre + BigInt(amount.toString()) != balancePost) throw new Error("Ops, someting weird happened")
    console.log("Gnosis -> Ethereum OK")
  })
