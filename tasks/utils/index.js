const SafeApiKit = require("@safe-global/api-kit").default

const { append0 } = require("../../test/utils/index")

const MESSAGE_DISPATCHED_TOPIC = "0x218247aabc759e65b5bb92ccc074f9d62cd187259f2a0984c3c9cf91f67ff7cf"

module.exports.decodeHashiMessage = (_message, { abiCoder }) => {
  const [[nonce, targetChainId, threshold, sender, receiver, data, reporters, adapters]] = abiCoder.decode(
    ["(uint256,uint256,uint256,address,address,bytes,address[],address[])"],
    _message,
  )

  return [
    nonce,
    targetChainId,
    threshold,
    sender,
    receiver,
    data,
    reporters.map((_reporter) => _reporter),
    adapters.map((_adapter) => _adapter),
  ]
}

module.exports.getRelevantDataFromEvents = ({
  receipt,
  abiCoder,
  topic,
  onlyHashiMessage = false,
  bridge = "amb",
  ethers,
}) => {
  const { data: hashiMessage } = receipt.logs.find((_log) => _log.topics[0] === MESSAGE_DISPATCHED_TOPIC)

  if (bridge === "amb") {
    if (onlyHashiMessage) {
      return {
        hashiMessage,
      }
    }

    const { data: message } = receipt.logs.find((_log) => _log.topics[0] === topic)
    const [decodedMessage] = abiCoder.decode(["bytes"], message)
    const messageId = ethers.solidityPackedKeccak256(["bytes"], [decodedMessage])

    return {
      decodedMessage,
      hashiMessage,
      message,
      messageId,
    }
  }
  if (bridge === "xdai") {
    const log = receipt.logs.find((_log) => _log.topics[0] === topic)

    if (
      topic === "0xf6968e689b3d8c24f22c10c2a3256bb5ca483a474e11bac08423baa049e38ae8" ||
      topic === "0xbcb4ebd89690a7455d6ec096a6bfc4a8a891ac741ffe4e678ea2614853248658"
    ) {
      return {
        message: log.data,
        messageArgs: log.args,
        hashiMessage,
      }
    }

    return {
      message: log.data,
      hashiMessage,
    }
  }
}

module.exports.getValidatorsSignatures = ({ validators, message, bridge = "amb" }) =>
  Promise.all(
    validators.map((_validator) =>
      _validator.signMessage(bridge === "amb" ? append0(ethers.toBeArray(message)) : ethers.toBeArray(message)),
    ),
  )

module.exports.getApprovedHashSignerAndConfirmationFromPendingTransactions = async (pendingTransaction, owner) => {
  const confirmation = pendingTransaction.confirmations.find(({ signatureType }) => signatureType === "APPROVED_HASH")
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [confirmation.owner],
  })
  const confOwner = await ethers.provider.getSigner(confirmation.owner)
  await owner.sendTransaction({
    to: confOwner.address,
    value: ethers.parseEther("1"),
  })

  return { confirmation, owner: confOwner }
}

module.exports.getSafeHomeAndForeignPendingTransactionsFromLinks = async (homeSafeTxLink, foreignSafeTxLink) => {
  const extractSafeAddressAndSafeTxHashFromLink = (link) => {
    const parts = new URL(link).searchParams.get("id").split("_")
    return {
      safe: parts[1],
      safeTxHash: parts[2],
    }
  }
  const homeData = extractSafeAddressAndSafeTxHashFromLink(homeSafeTxLink)
  const foreigData = extractSafeAddressAndSafeTxHashFromLink(foreignSafeTxLink)
  const foreignSafeApi = new SafeApiKit({ chainId: 1n })
  const foreignPendingTransactions = await foreignSafeApi.getPendingTransactions(foreigData.safe)
  const foreignPendingTransaction = foreignPendingTransactions.results.find(
    ({ safeTxHash }) => safeTxHash === foreigData.safeTxHash,
  )
  const homeSafeApi = new SafeApiKit({ chainId: 100n })
  const homePendingTransactions = await homeSafeApi.getPendingTransactions(homeData.safe)
  const homePendingTransaction = homePendingTransactions.results.find(
    ({ safeTxHash }) => safeTxHash === homeData.safeTxHash,
  )

  return {
    homePendingTransaction,
    foreignPendingTransaction,
  }
}
