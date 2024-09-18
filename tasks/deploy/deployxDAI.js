const { task } = require('hardhat/config')
const verify = require('./verify')
require('dotenv').config()

task('deploy:ForeignxDAIBridge')
  .addFlag('verify')
  .setAction(async (_taskArgs, hre) => {
    const [owner] = await hre.ethers.getSigners()
    let ProxyFactory = await hre.ethers.getContractFactory('EternalStorageProxy')
    let ForeignxDAIBridgeFactory = await hre.ethers.getContractFactory('XDaiForeignBridge')
    let HashiManagerFactory = await hre.ethers.getContractFactory('HashiManager')

    console.log('Deploying Foreign xDAI bridge implementation...')
    let ForeignxDAIBridge = await ForeignxDAIBridgeFactory.deploy()
    await ForeignxDAIBridge.deploymentTransaction().wait()
    const ForeignxDAIBridgeAddress = await ForeignxDAIBridge.getAddress()
    console.log('Foreign xDAI bridge deployed to ', ForeignxDAIBridgeAddress)

    let ForeignHashiManagerProxy
    let ForeignHashiManager

    if (!process.env.FOREIGN_HASHI_MANAGER_XDAI) {
      console.log('Deploying Hashi Manager....')
      ForeignHashiManagerProxy = await ProxyFactory.deploy()
      await ForeignHashiManagerProxy.deploymentTransaction().wait()
      ForeignHashiManager = await HashiManagerFactory.deploy()

      await ForeignHashiManager.deploymentTransaction().wait()
      console.log('Hashi Manager deployed to', await ForeignHashiManagerProxy.getAddress())

      console.log('Upgrading Foreign Hashi Manager Proxy...')
      let hashiManagerUpgradeTx = await ForeignHashiManagerProxy.connect(owner).upgradeTo(
        '1',
        await ForeignHashiManager.getAddress()
      )
      await hashiManagerUpgradeTx.wait()
      console.log(`Foreign Hashi Manager upgrade Tx ${hashiManagerUpgradeTx.hash}`)
      ForeignHashiManager = ForeignHashiManager.attach(await ForeignHashiManagerProxy.getAddress())

      console.log('Configuring Hashi Manager...')
      let setHashiOwner = await ForeignHashiManager.initialize(owner.address)
      await setHashiOwner.wait()
      console.log(`Hashi Owner set: ${setHashiOwner.hash}`)

      let setHashiTargetChainIDTx = await ForeignHashiManager.connect(owner).setTargetChainId(process.env.HOME_CHAIN_ID)
      await setHashiTargetChainIDTx.wait()
      console.log(`Target ChainID set to ${process.env.HOME_CHAIN_ID}: ${setHashiTargetChainIDTx.hash}`)

      let setTargetAddress = await ForeignHashiManager.connect(owner).setTargetAddress(process.env.HOME_XDAI)
      await setTargetAddress.wait()
      console.log(`Target Address set: ${setTargetAddress.hash}`)

      let setYahoTx = await ForeignHashiManager.connect(owner).setYaho(process.env.FOREIGN_YAHO)
      await setYahoTx.wait()
      console.log(`Yaho set: ${setYahoTx.hash}`)

      let setYaruTx = await ForeignHashiManager.connect(owner).setYaru(process.env.FOREIGN_YARU)
      await setYaruTx.wait()
      console.log(`Yaru set: ${setYaruTx.hash}`)
    }

    if (_taskArgs.verify) {
      console.log('Verifying contracts....')

      await verify(hre, ForeignxDAIBridgeAddress, [])
      if (!process.env.FOREIGN_HASHI_MANAGER_XDAI) {
        await verify(hre, await ForeignHashiManagerProxy.getAddress(), [])
        await verify(hre, await ForeignHashiManager.getAddress(), [])
      }
    }
    console.log('Foreign xDAI bridge deployment done')
  })

task('deploy:HomexDAIBridge')
  .addFlag('verify')
  .setAction(async (_taskArgs, hre) => {
    const [owner] = await hre.ethers.getSigners()
    let ProxyFactory = await hre.ethers.getContractFactory('EternalStorageProxy')

    let HomexDAIFactory = await hre.ethers.getContractFactory('HomeBridgeErcToNative')
    let HashiManagerFactory = await hre.ethers.getContractFactory('HashiManager')
    let HomeHashiManagerProxy
    let HomeHashiManager

    console.log('Deploying Home xDAI bridge implementation...')
    let HomexDAI = await HomexDAIFactory.deploy()
    await HomexDAI.deploymentTransaction().wait()
    const HomexDAIAddress = await HomexDAI.getAddress()

    console.log('Home xDAI bridge deployed to ', HomexDAIAddress)

    if (!process.env.HOME_HASHI_MANAGER_XDAI) {
      console.log('Deploying Hashi Manager....')
      HomeHashiManagerProxy = await ProxyFactory.deploy()
      await HomeHashiManagerProxy.deploymentTransaction().wait()

      HomeHashiManager = await HashiManagerFactory.deploy()
      await HomeHashiManager.deploymentTransaction().wait()

      console.log(`Home Hashi Manager deployed to ${await HomeHashiManagerProxy.getAddress()}`)

      console.log('Upgrading Home Hashi Manager Proxy...')
      let hashiManagerUpgradeTx = await HomeHashiManagerProxy.connect(owner).upgradeTo(
        '1',
        await HomeHashiManager.getAddress()
      )
      await hashiManagerUpgradeTx.wait()
      console.log(`Hashi Manager upgrade Tx ${hashiManagerUpgradeTx.hash}`)
      HomeHashiManager = HomeHashiManager.attach(await HomeHashiManagerProxy.getAddress())

      if (_taskArgs.verify) {
        console.log('Verifying contracts...')

        await verify(hre, HomexDAIAddress, [])
        if (!process.env.HOME_HASHI_MANAGER_XDAI) {
          await verify(hre, await HomeHashiManagerProxy.getAddress(), [])
          await verify(hre, await HomeHashiManager.getAddress(), [])
        }
      }

      let setHashiOwner = await HomeHashiManager.initialize(owner.address)
      await setHashiOwner.wait()
      console.log(`Hashi Manager Owner set: ${setHashiOwner.hash}`)

      let setHashiTargetChainIDTx = await HomeHashiManager.connect(owner).setTargetChainId(process.env.FOREIGN_CHAIN_ID)
      await setHashiTargetChainIDTx.wait()
      console.log(`Target ChainID set to ${process.env.FOREIGN_CHAIN_ID}: ${setHashiTargetChainIDTx.hash}`)

      let setYahoTx = await HomeHashiManager.connect(owner).setYaho(process.env.HOME_YAHO)
      await setYahoTx.wait()
      console.log(`Yaho set: ${setYahoTx.hash}`)

      let setYaruTx = await HomeHashiManager.connect(owner).setYaru(process.env.HOME_YARU)
      await setYaruTx.wait()
      console.log(`Yaru set: ${setYaruTx.hash}`)

      let setTargetAddress = await HomeHashiManager.connect(owner).setTargetAddress(process.env.FOREIGN_XDAI)
      await setTargetAddress.wait()
      console.log(`Target Address set: ${setTargetAddress.hash}`)
    }
    console.log('Home xDAI bridge deployment done')
  })
