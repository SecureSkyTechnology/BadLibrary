// TODO: xss stored

const fs = require('fs')
const waf = require('./waf.js')
const sqlite3 = require('sqlite3')
const libxmljs = require('libxmljs')
const path = require('path')

let db, templates, config, wafConfig
const contactBuffer = {
  username: '',
  time: '',
  text: ''
}

function toJSTDateString (d) {
  if (d === undefined) d = new Date()
  d = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const s4 = function (n) { return /([\d]{4})$/.exec('000' + n)[1] }
  const s2 = function (n) { return /([\d]{2})$/.exec('0' + n)[1] }
  return `${s4(d.getUTCFullYear())}/${s2(1 + d.getUTCMonth())}/${s2(d.getUTCDate())} ${s2(d.getUTCHours())}:${s2(d.getUTCMinutes())}:${s2(d.getUTCSeconds())}`
}

const counter = (function (initial) {
  let val = initial
  return function () {
    return val++
  }
})(0)

function init (configFile) {
  config = JSON.parse(fs.readFileSync(configFile, 'utf-8'))
  if (typeof config.vulnerabilities !== 'object') {
    config.vulnerabilities = {}
  }
  (def => {
    Object.keys(def).forEach(v => {
      if (config.vulnerabilities[v] === undefined) config.vulnerabilities[v] = def[v]
    })
  })({
    sqli: [],
    xss: [],
    session: [],
    xxe: false,
    expose: [],
    csrf: false
  })
  if (config.vulnerabilities.xxe && (config.vulnerabilities.expose.indexOf('admin') < 0)) {
    console.warn('config.vulnerabilities.xxe must be set with `config.vulnerabilities.expose = ["admin"]`.')
  }
  if (config.vulnerabilities.expose.indexOf('dirindex') >= 0 && config.vulnerabilities.expose.indexOf('contact') < 0) {
    console.warn('`"dirindex"` must be set with `"contact"` in config.vulnerabilities.expose')
  }

  wafConfig = {
    origin: undefined,
    basic: config.global.basic,
    session: true,
    xfo: true,
    xcto: true,
    staticFiles: ['/static/'],
    protectCsrf: true,
    defaultHeaders: {}
  }

  if (config.vulnerabilities.session.indexOf('serial') >= 0) {
    wafConfig.sessionIdGenerator = counter
  }

  if (config.vulnerabilities.session.indexOf('no-httponly') >= 0) {
    wafConfig.httponly = false
  }
  if (config.vulnerabilities.csrf) {
    wafConfig.protectCsrf = false
  }
  if (config.vulnerabilities.xss.length) {
    wafConfig.defaultHeaders['X-XSS-Protection'] = '0'
  }

  sqlite3.verbose()
  db = new sqlite3.Database(path.resolve(__dirname, 'libra.db'), sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      throw new Error(err)
    }
  })
  db.on('trace', (sql) => {
    console.log('db.ontrace:', sql)
  })
  templates = {}
  const templateFiles = {
    row: 'row.html',
    history: 'history.html',
    contact: 'contact.html',
    contact1: 'contact1.html',
    contact2: 'contact2.html',
    login: 'login.html',
    book: 'book.html',
    search: 'search.html',
    bookRow: 'book-row.html',
    robots: 'robots.txt',
    500: '500.html',
    404: '404.html'
  }
  if (config.vulnerabilities.expose.indexOf('admin') >= 0) {
    templateFiles.admin = 'admin.html'
  }
  if (config.vulnerabilities.xss.indexOf('dom') >= 0) {
    templateFiles['404'] = '404-xss.html'
  }
  if (config.vulnerabilities.xss.indexOf('reflect') >= 0) {
    templateFiles.history = 'history-xss.html'
  }
  for (const n in templateFiles) {
    templates[n] = fs.readFileSync(path.resolve(__dirname, 'tmpl/', templateFiles[n]), 'utf-8')
  }
  if (config.vulnerabilities.csrf) {
    templates.csrf = ''
  } else {
    templates.csrf = '<input type="hidden" name="token" value="<@ csrf_token @>">'
  }

  const notice = fs.readFileSync(path.resolve(__dirname, 'tmpl/notice.html'), 'utf-8')
  for (const n in templates) {
    templates[n] = templates[n].replace(/<@ notice @>/g, notice)
  }
  if (!fs.existsSync(path.resolve(__dirname, 'log'))) {
    fs.mkdirSync(path.resolve(__dirname, 'log'))
  }
  if (!fs.lstatSync(path.resolve(__dirname, 'log')).isDirectory()) {
    throw new Error(`${path.resolve(__dirname, 'log')} is not a directory`)
  }
}

const handlers = [
  {
    pattern: '/',
    method: 'GET',
    callback: (conn) => {
      const user = conn.session.get('user')
      if (!user) {
        conn.res.redirect('./login')
      } else {
        conn.res.redirect('./history')
      }
    }
  },
  {
    pattern: '/login',
    method: 'GET',
    callback: (conn) => {
      const html = waf.render(templates.login, {})
      conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      conn.res.end(html)
    }
  },
  {
    pattern: '/login',
    method: 'POST',
    callback: (conn) => {
      let mail = conn.body.get('mail')
      let pass = conn.body.get('pass')
      if (mail === undefined) mail = ''
      if (pass === undefined) pass = ''
      if (mail === '' || pass === '') {
        conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        const html = waf.render(templates.login, { errormsg: 'display:block', mail, pass })
        conn.res.end(html)
        return
      }
      const cb = (err, row) => {
        if (err) {
          console.error(err)
          conn.res.respondError(500)
        } else if (row === undefined) {
          conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          const html = waf.render(templates.login, { errormsg: 'display:block', mail, pass })
          conn.res.end(html)
        } else {
          if (config.vulnerabilities.session.indexOf('no-refresh') < 0) {
            conn.session.renew()
          }
          conn.session.set('user', row.name)
          conn.session.set('id', row.id)
          conn.res.redirect('./')
        }
      }
      if (config.vulnerabilities.sqli.indexOf('auth') >= 0) {
        // sqli here
        const sql = `SELECT * FROM users WHERE (mail='${mail.replace(/'/g, '\'\'')}') and (pass='${pass}');`
        db.get(sql, cb)
      } else {
        // no sqli
        const sql = 'SELECT * FROM users WHERE (mail=?) and (pass=?);'
        const stmt = db.prepare(sql)
        stmt.get(mail, pass, cb)
      }
    }
  },
  {
    pattern: '/history',
    method: 'GET',
    callback: (conn) => {
      const user = conn.session.get('user')
      const uid = conn.session.get('id')
      const htmlParams = {}
      const params = {
        q: conn.location.searchParams.get('q'),
        d: conn.location.searchParams.get('d')
      }
      const q = params.q || ''
      let sql

      if (user === undefined) {
        return conn.res.redirect('./')
      }
      conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      const cb = (err, rows) => {
        let s = ''
        try {
          if (err) {
            s = sql + '<br>' + err
          }
          if (rows && typeof rows === 'object') {
            for (let i = 0; i < rows.length; i++) {
              s += waf.render(templates.row, rows[i])
            }
          }
        } catch (e) {
          console.error(e)
          s = e
        }
        htmlParams.table = s
        htmlParams['selected' + params.d] = 'selected'
        htmlParams.q = q
        htmlParams.user = user
        if (params.d) {
          htmlParams.range = `${(params.d || '').substr(0, 4)}年${(params.d || '').substr(4)}月`
        } else {
          htmlParams.range = '全て'
        }
        const html = waf.render(templates.history, htmlParams)
        conn.res.end(html)
      }

      if (config.vulnerabilities.sqli.indexOf('search') >= 0) {
        // sqli here
        sql = `select * from (history inner join books on history.bid=books.id) inner join users on history.uid=users.id where books.title like '%${q}%' and uid = ${uid}`
        if (/^\d{6}$/.test(params.d)) {
          sql += ` AND date1 LIKE '${params.d.substr(0, 4)}-${params.d.substr(4, 2)}%'`
        }
        sql += ' ORDER BY date1;'
        db.all(sql, cb)
      } else {
        // no sqli
        sql = 'select * from (history inner join books on history.bid=books.id) inner join users on history.uid=users.id where books.title like ? and uid = ?'
        let date
        if (/^\d{6}$/.test(params.d)) {
          sql += ' AND date1 LIKE ?'
          date = `%${params.d.substr(0, 4)}-${params.d.substr(4, 2)}%`
        }
        sql += ' ORDER BY date1;'
        console.log('sql=', sql)
        const stmt = db.prepare(sql)
        stmt.all(`%${q}%`, uid, date, cb)
      }
    }
  },
  {
    pattern: '/contact',
    method: 'GET',
    callback: (conn) => {
      const user = conn.session.get('user')
      const htmlParams = { user }
      if (user === undefined) return conn.res.redirect('./')

      conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      const html = waf.render(templates.contact, htmlParams)
      conn.res.end(html)
    }
  },
  {
    pattern: '/contact',
    method: 'POST',
    callback: (conn) => {
      const d = new Date()
      const user = conn.session.get('user')
      const uid = conn.session.get('id')
      let html
      if (user === undefined) return conn.res.redirect('./')
      if (conn.body.get('send') === '1') {
        const htmlParams = { user }
        if (config.vulnerabilities.racecondition) {
          htmlParams.username = contactBuffer.username
          htmlParams.time = contactBuffer.time
          htmlParams.text = contactBuffer.text
        } else {
          htmlParams.username = user
          htmlParams.time = conn.body.get('time') || ''
          htmlParams.text = conn.body.get('text') || ''
        }
        html = waf.render(templates.contact2, htmlParams)
        {
          const date =
            d.getFullYear().toString().padStart(4, '0') +
            (d.getMonth() + 1).toString().padStart(2, '0') +
            d.getDate().toString().padStart(2, '0')
          const filename = path.resolve(__dirname, 'log', `/${date}.txt`)
          if (config.vulnerabilities.expose.indexOf('contact') >= 0) {
            fs.open(filename, 'a', (err, fd) => {
              if (err) {
                conn.res.respondError(500)
                console.error(filename, err)
                return
              }
              conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
              fs.write(fd, `Date: ${htmlParams.time}\nFrom: ${htmlParams.user}\nUser-Id: ${uid}\n\n${htmlParams.text}\n---\n`, (err) => {
                if (err) {
                  console.error(err)
                }
                fs.close(fd, () => {})
              })
              conn.res.end(html)
            })
          } else {
            conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            conn.res.end(html)
          }
        }
      } else {
        conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        const htmlParams = {
          user,
          username: user,
          time: toJSTDateString(d),
          text: conn.body.get('text')
        }
        if (config.vulnerabilities.racecondition) {
          contactBuffer.username = user
          contactBuffer.time = toJSTDateString(d)
          contactBuffer.text = conn.body.get('text')
        } else {
          const hiddenHtml = '<input type="hidden" name="text" value="<@ text @>"><input type="hidden" name="time" value="<@ time @>">'
          htmlParams.hidden = waf.render(hiddenHtml, htmlParams)
        }
        html = waf.render(templates.contact1, htmlParams)
        conn.res.end(html)
      }
    }
  },
  {
    pattern: '/logout',
    method: ['POST'],
    callback: (conn) => {
      conn.session.expire()
      conn.res.redirect('./')
    }
  },
  {
    pattern: '/search',
    method: 'GET',
    callback: (conn) => {
      let html
      let q = conn.location.searchParams.get('q')
      const user = conn.session.get('user')
      const params = {
        user,
        login: user ? 'inline' : 'none',
        logout: user ? 'none' : 'inline',
        q: q || '',
        display: 'display: none;',
        notfound: 'display:none;'
      }
      if (q === undefined || q === '') q = '\0'
      else q = '%' + q + '%'
      const sql = 'select * from books where title like ?;'
      db.all(sql, q, (err, rows) => {
        let s = ''
        if (err) {
          console.error(sql, err)
          conn.res.respondError(500)
          return
        }
        if (typeof rows === 'object') {
          if (params.q !== '') {
            if (rows.length) {
              params.notfound = 'display:none;'
            } else {
              params.notfound = ''
            }
          }
          if (rows.length !== 0) {
            params.display = ''
          }
          for (let i = 0; i < rows.length; i++) {
            s += waf.render(templates.bookRow, rows[i])
          }
        }
        params.table = s
        html = waf.render(templates.search, params)
        conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        conn.res.end(html)
      })
    }
  },
  {
    pattern: '/book',
    method: 'GET',
    callback: (conn) => {
      let html
      const bid = conn.location.searchParams.get('id')
      const q = conn.location.searchParams.get('q')
      const user = conn.session.get('user')
      const params = {
        user,
        login: user ? 'inline' : 'none',
        logout: user ? 'none' : 'inline',
        q,
        past: ''
      }
      if (!bid) {
        return conn.res.respondError(404)
      }
      const cb = (err, row) => {
        if (err) {
          console.error(err)
          return conn.res.respondError(500)
        } else if (row === undefined) {
          return conn.res.respondError(404)
        } else {
          for (const prop in row) {
            params[prop] = row[prop]
          }
        }
        const cb2 = (err, row) => {
          if (err) {
            console.error(err)
            return conn.res.respondError(500)
          } else {
            if (row && row['count(*)'] >= 1) {
              params.past = 'あり'
            } else if (row && row['count(*)'] === 0) {
              params.past = 'なし'
            }
            conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            html = waf.render(templates.book, params)
            return conn.res.end(html)
          }
        }
        const uid = conn.session.get('id')
        if (uid) {
          if (config.vulnerabilities.sqli.indexOf('blind') >= 0) {
            const sql = `select count(*) from history where uid=${uid} and bid=${bid};`
            db.get(sql, cb2)
          } else {
            const sql = 'select count(*) from history where uid=?;'
            const stmt = db.prepare(sql)
            stmt.get(bid, cb2)
          }
        } else {
          cb2()
        }
      }
      const sql = 'select * from books where id=CAST(? AS INTEGER);'
      const stmt = db.prepare(sql)
      stmt.get(bid, cb)
    }
  },
  {
    pattern: ':404',
    method: '*',
    callback: (conn) => {
      conn.res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      conn.res.end(templates['404'])
    }
  },
  {
    pattern: ':500',
    method: '*',
    callback: (conn) => {
      conn.res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      conn.res.end(templates['500'])
    }
  },
  {
    pattern: '/admin',
    method: 'get',
    callback: (conn) => {
      if (config.vulnerabilities.expose.indexOf('admin') >= 0) {
        conn.res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        conn.res.end(waf.render(templates.admin, {}))
      } else {
        return conn.res.respondError(404)
      }
    }
  },
  {
    pattern: '/admin/reboot',
    method: 'post',
    callback: (conn) => {
      if (config.vulnerabilities.expose.indexOf('admin') < 0) {
        return conn.res.respondError(404)
      }
      const conn_ = conn
      conn.res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      setTimeout(() => {
        conn_.res.end('ng')
      }, 3000)
    }
  },
  {
    pattern: '/admin/add-book',
    method: 'post',
    callback: (conn) => {
      if (config.vulnerabilities.expose.indexOf('admin') < 0) {
        return conn.res.respondError(404)
      }

      const template = '<response><result>ng</result><msg><@ msg @></msg><@ raw:book @></response>'
      const t = (xmldoc, xpath) => {
        const e = xmldoc.get(xpath)
        return e !== undefined ? e.text() : e
      }
      conn.res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' })

      if (conn.body === undefined || conn.body.get('xml') === undefined) {
        return conn.res.end(waf.render(template, { msg: 'invalid parameter', book: '' }))
      }
      let doc
      const xml = conn.body.get('xml')
      try {
        doc = libxmljs.Document.fromXml(xml, { dtdvalid: false, noent: config.vulnerabilities.xxe })
      } catch (e) {
        console.error(e)
        console.error(xml)
        return conn.res.end(waf.render(template, { msg: e.toString(), book: '' }))
      }
      const title = t(doc, '//title')
      const pages = t(doc, '//pages')
      const date = t(doc, '//date')
      const loc = t(doc, '//loc')
      if (title === '' || !/^[\d]+$/.test(pages) || !/^[\d]{4}-[\d]{1,2}-[\d]{1,2}$/.test(date) || !/^[A-Z]{1,2}-[\d]{1,3}$/.test(loc)) {
        return conn.res.end(waf.render(template, { msg: 'invalid parameter', book: '' }))
      }
      return conn.res.end(waf.render(template, { msg: 'internal error', book: doc.root().toString() }))
    }
  },
  {
    pattern: '/robots.txt',
    method: ['get', 'post'],
    callback: (conn) => {
      conn.res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      conn.res.end(templates.robots)
    }
  },
  {
    pattern: '/contact/log',
    method: ['get', 'post'],
    callback: (conn) => {
      conn.res.redirect('/contact/log/')
    }
  },
  {
    pattern: /^\/contact\/log\/(.*)/,
    method: 'get',
    callback: (conn, match) => {
      if (config.vulnerabilities.expose.indexOf('dirindex') >= 0) {
        const file = match[1]
        if (file) {
          fs.readFile(path.resolve(__dirname, 'log/', file), (err, data) => {
            if (err) {
              return conn.res.respondError(err.code === 'ENOENT' ? 404 : 500)
            }
            conn.res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
            conn.res.end(data)
          })
        } else {
          conn.res.respondDirIndex(path.resolve(__dirname, 'log'))
        }
      } else {
        return conn.res.respondError(404)
      }
    }
  }
]

function main () {
  const opt = {
    port: undefined,
    host: undefined,
    config: path.resolve(__dirname, 'config.json')
  }
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '-p' || process.argv[i] === '--port') {
      opt.port = process.argv[++i]
    } else if (process.argv[i] === '-h' || process.argv[i] === '--host') {
      opt.host = process.argv[++i]
    } else if (process.argv[i] === '-c' || process.argv[i] === '--config') {
      opt.config = process.argv[++i]
    }
  }

  init(opt.config)
  if (opt.port === undefined || opt.port === 0) opt.port = process.envPORT || 8080
  const server = waf.createServer(wafConfig, handlers)
  console.log('Starting httpd on port ' + opt.port)
  server.listen(opt.port, opt.host)
}

main()
