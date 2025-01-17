const https = require('https')
const chalk = require('chalk')

const createClient = ({ auth, hostname, port }) => (operation, ...args) =>
  new Promise((resolve, reject) => {
    const opts = {
      auth,
      hostname,
      port,
      method: 'POST',
      rejectUnauthorized: false,
      path:
        '/admin/jolokia/exec/org.apache.karaf:type=config,name=root/setProperty/org.apache.karaf.command.acl.shell/*/admin',
      headers: {
        'User-Agent': 'ace',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://${hostname}:${port}`,
      },
    }

    const req = https.request(opts, res => {
      let body = ''
      res.on('data', data => {
        body += data
      })
      res.on('end', () => {
        resolve(body)
      })
    })

    req.on('error', reject)

    req.write(
      JSON.stringify({
        operation,
        type: 'EXEC',
        arguments: args,
        mbean:
          'org.codice.ddf.ui.admin.api.ConfigurationAdmin:service=ui,version=2.3.0',
      })
    )

    req.end()
  })

const defaultConfig = [{ properties: require('./default-wcpm-config.json') }]

module.exports = async ({ args }) => {
  const auth = process.env.AUTH || args.auth || 'admin:admin'
  const hostname = process.env.HOST || args.host || 'localhost'
  const port = process.env.PORT || args.port || 8993

  const exec = createClient({ auth, hostname, port })
  const pid = 'org.codice.ddf.security.policy.context.impl.PolicyManager'

  try {
    const { value } = JSON.parse(await exec('listServices'))
    const [{ configurations = defaultConfig }] = value.filter(
      ({ id }) => id === pid
    )
    const [{ properties }] = configurations

    properties.authenticationTypes = ['/=BASIC']

    const { whitelist: contextPath } = args

    if (contextPath !== undefined) {
      if (!properties.whiteListContexts.includes(contextPath)) {
        properties.whiteListContexts.push(contextPath)
      }
    }

    await exec('update', pid, properties)
  } catch (e) {
    console.error(
      chalk.yellow(
        'WARNING: unable to auto disable IDP authentication, you may need to do this manually.'
      )
    )
    console.error(e)
  }
}
