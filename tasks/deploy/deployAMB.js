const { task } = require('hardhat/config')
const verify = require('./verify')
require('dotenv').config()

task('deploy:ForeignAMB')
  .addFlag('verify')
  .setAction(async (_taskArgs, hre) => {
    const [owner] = await hre.ethers.getSigners()
    let ProxyFactory = await hre.ethers.getContractFactory('EternalStorageProxy')
    let ForeignAMBFactory = await hre.ethers.getContractFactory('ForeignAMB')
    let HashiManagerFactory = await hre.ethers.getContractFactory('HashiManager')

    console.log('Deploying Foreign AMB implementation...')
    let ForeignAMB = await ForeignAMBFactory.deploy()
    await ForeignAMB.deploymentTransaction().wait()
    const ForeignAMBAddress = await ForeignAMB.getAddress()
    console.log('Foreign AMB deployed to ', ForeignAMBAddress)

    let ForeignHashiManagerProxy
    let ForeignHashiManager

    if (!process.env.FOREIGN_HASHI_MANAGER_AMB) {
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

      let setTargetAddress = await ForeignHashiManager.connect(owner).setTargetAddress(process.env.HOME_AMB)
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

      await verify(hre, ForeignAMBAddress, [])
      if (!process.env.FOREIGN_HASHI_MANAGER_AMB) {
        await verify(hre, await ForeignHashiManagerProxy.getAddress(), [])
        await verify(hre, await ForeignHashiManager.getAddress(), [])
      }
    }
    console.log('Foreign AMB deployment done')
  })

task('deploy:HomeAMB')
  .addFlag('verify')
  .setAction(async (_taskArgs, hre) => {
    const [owner] = await hre.ethers.getSigners()
    let ProxyFactory = await hre.ethers.getContractFactory('EternalStorageProxy')

    let HomeAMBFactory = await hre.ethers.getContractFactory('HomeAMB')
    let HashiManagerFactory = await hre.ethers.getContractFactory('HashiManager')
    let HomeHashiManagerProxy
    let HomeHashiManager

    console.log('Deploying Home AMB implementation...')
    let HomeAMB = await HomeAMBFactory.deploy()
    await HomeAMB.deploymentTransaction().wait()
    const HomeAMBAddress = await HomeAMB.getAddress()

    console.log('Home AMB deployed to ', HomeAMBAddress)

    if (!process.env.HOME_HASHI_MANAGER_AMB) {
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

        await verify(hre, HomeAMBAddress, [])
        if (!process.env.HOME_HASHI_MANAGER_AMB) {
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

      let setTargetAddress = await HomeHashiManager.connect(owner).setTargetAddress(process.env.FOREIGN_AMB)
      await setTargetAddress.wait()
      console.log(`Target Address set: ${setTargetAddress.hash}`)
    }
    console.log('Home AMB deployment done')
  })
