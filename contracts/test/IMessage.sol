pragma solidity ^0.8.0;

struct Message {
    uint256 nonce;
    uint256 targetChainId;
    uint256 threshold;
    address sender;
    address receiver;
    bytes data;
    address[] reporters;
    address[] adapters;
}
