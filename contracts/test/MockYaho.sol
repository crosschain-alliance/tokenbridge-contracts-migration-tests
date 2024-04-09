pragma solidity ^0.8.20;

interface IAdapter {
    function getHash(uint256 domain, uint256 id) external view returns (bytes32 hash);
}

interface IReporter {
    function dispatchBlocks(
        uint256 targetChainId,
        IAdapter adapter,
        uint256[] calldata blockNumbers
    ) external payable returns (bytes32);

    function dispatchMessages(
        uint256 targetChainId,
        IAdapter adapter,
        uint256[] calldata messageIds,
        bytes32[] calldata messageHashes
    ) external payable returns (bytes32);
}

contract MockYaho {
    uint256 public currentNonce;

    struct Message {
        uint256 nonce;
        uint256 targetChainId;
        uint256 threshold;
        address sender;
        address receiver;
        bytes data;
        IReporter[] reporters;
        IAdapter[] adapters;
    }

    event MessageDispatched(uint256 messageId, Message message);

    function dispatchMessageToAdapters(
        uint256 targetChainId,
        uint256 threshold,
        address receiver,
        bytes calldata data,
        IReporter[] calldata reporters,
        IAdapter[] calldata adapters
    ) external returns (uint256, bytes32[] memory) {
        Message memory message = Message(
            currentNonce,
            targetChainId,
            threshold,
            msg.sender,
            receiver,
            data,
            reporters,
            adapters
        );

        uint256 messageId = currentNonce;
        bytes32 mockMessageHash = keccak256(
            abi.encode(messageId, targetChainId, threshold, msg.sender, receiver, data, reporters, adapters)
        );

        uint256[] memory messageIds = new uint256[](1);
        bytes32[] memory messageHashes = new bytes32[](1);
        messageIds[0] = messageId;
        messageHashes[0] = mockMessageHash;

        bytes32[] memory receipts = new bytes32[](reporters.length);
        for (uint256 i = 0; i < reporters.length; i++) {
            receipts[i] = bytes32(i);
        }

        emit MessageDispatched(messageId, message);
        currentNonce += 1;

        return (messageId, receipts);
    }
}
