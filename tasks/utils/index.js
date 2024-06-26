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
