pragma solidity ^0.8.20;

import "./MockYaho.sol";

contract MockReporter {
    address public YAHO;

    event MessageDispatched(
        uint256 indexed targetChainId,
        IAdapter adapter,
        uint256 indexed messageId,
        bytes32 messageHash
    );

    modifier onlyYaho() {
        require(msg.sender == YAHO, "not yaho");
        _;
    }

    constructor(address yaho) {
        YAHO = yaho;
    }

    function dispatchMessages(
        uint256 targetChainId,
        IAdapter adapter,
        uint256[] calldata messageIds,
        bytes32[] calldata messageHashes
    ) external payable onlyYaho returns (bytes32) {
        for (uint256 i = 0; i < messageIds.length; i++) {
            emit MessageDispatched(targetChainId, adapter, messageIds[i], messageHashes[i]);
        }
        return bytes32(0);
    }
}
