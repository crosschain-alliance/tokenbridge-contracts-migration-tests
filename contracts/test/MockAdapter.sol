pragma solidity ^0.8.20;

contract MockAdapter {
    mapping(uint256 => mapping(uint256 => bytes32)) private _hashes;

    event HashStored(uint256 indexed id, bytes32 indexed hash);

    function getHash(uint256 domain, uint256 id) public view returns (bytes32) {
        return _hashes[domain][id];
    }

    function _storeHashes(uint256 domain, uint256[] calldata ids, bytes32[] calldata hashes) internal {
        for (uint256 i = 0; i < ids.length; i++) {
            _storeHash(domain, ids[i], hashes[i]);
        }
    }

    function _storeHash(uint256 domain, uint256 id, bytes32 hash) internal {
        bytes32 currentHash = _hashes[domain][id];
        if (currentHash != hash) {
            _hashes[domain][id] = hash;
            emit HashStored(id, hash);
        }
    }

    function setHashes(uint256 domain, uint256[] calldata ids, bytes32[] calldata hashes) external {
        for (uint256 i = 0; i < ids.length; i++) {
            _storeHash(domain, ids[i], hashes[i]);
        }
    }
}
