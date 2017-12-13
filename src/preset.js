'use strict'

const sqlite3 = require('sqlite3')
const fs = require('fs')
const dbfile = `${__dirname}/libra.db`

// eslint-disable-next-line no-unused-vars
function row (title, user) {
  let code = Math.floor(Math.random() * 1000)
  let d1 = new Date((new Date('2016/01/01')).getTime() + Math.random() * 1000 * 60 * 60 * 24 * 700)
  let d2 = new Date(d1.getTime() + (Math.random() * 1000 * 60 * 60 * 24) * 14)
  d1 = d1.toISOString().replace(/T.*/, '')
  d2 = d2.toISOString().replace(/T.*/, '')

  return {
    $title: title,
    $code: code,
    $user: user,
    $start: d1,
    $end: d2
  }
}

const users = [
  [ 21, '秋田一郎', 'akita@example.jp', '1234' ],
  [ 22, '福井ゆき', 'fukui@example.jp', '2393' ],
  [ 23, '三重隆之', 'mie@example.jp', '4123' ],
  [ 24, '長野弘子', 'nagano@example.jp', '5124' ],
  [ 25, '千葉博信', 'chiba@example.jp', '8113' ],
  [ 26, '山口未希', 'yamaguchi@example.jp', '7432' ],
  [ 27, '香川真理', 'kagawa@example.jp', '2321' ],
  [ 28, '宮崎のどか', 'miyazaki@example.jp', '9090' ],
  [ 29, '石川淳史', 'ishikawa@example.jp', '5263' ]
]

const books = [
  [ 1001, '押忍！空手道！', '2011-03-16', 82, 'A-1' ],
  [ 1002, '簡単に作る毎日のお弁当', '2011-05-12', 191, 'C-1' ],
  [ 1003, '悩みを吹き飛ばす30の方法', '2016-06-22', 172, 'C-4' ],
  [ 1004, '今年買う自転車', '2011-06-08', 140, 'B-2' ],
  [ 1005, 'Perfect Software', '2016-01-28', 320, 'D-2' ],
  [ 1006, '目からウロコのWindows', '2011-07-07', 133, 'D-3' ],
  [ 1008, '家庭の健康', '2011-07-15', 233, 'E-4' ],
  [ 1009, 'ゼロからのプログラミング', '2011-08-19', 103, 'B-1' ],
  [ 1010, '美味しい食卓', '2014-08-10', 110, 'C-2' ],
  [ 1011, '水の流れのように', '2012-02-02', 237, 'B-2' ],
  [ 1012, '水の流れのように', '2012-02-02', 237, 'B-2' ],
  [ 1013, 'いつかどこかで誰かと何か', '2012-02-02', 139, 'C-3' ],
  [ 1014, 'Rubyではじめる効率化', '2012-02-07', 145, 'C-4' ],
  [ 1016, '成功ダイエット', '2012-02-23', 203, 'B-1' ],
  [ 1017, '恋の実るプログラミング', '2012-04-28', 105, 'C-2' ],
  [ 1019, 'JavaScript徹底入門', '2012-06-16', 253, 'C-3' ],
  [ 1020, '恋に効く菓子作り', '2012-07-12', 299, 'B-1' ],
  [ 1022, '厳選 セキュリティ対策集', '2012-07-31', 104, 'C-4' ],
  [ 1023, '習慣化する貯金術', '2012-08-07', 151, 'A-1' ],
  [ 1024, '健康のための習慣作り', '2012-12-04', 179, 'C-1' ],
  [ 1025, '失敗しない夕食選び', '2012-12-25', 241, 'C-2' ],
  [ 1027, 'だからあなたは嫌われる', '2012-12-30', 159, 'C-3' ],
  [ 1028, '今日から学ぶJavaScript', '2013-02-02', 212, 'C-4' ],
  [ 1029, '名探偵と密室殺人', '2013-02-18', 171, 'A-1' ],
  [ 1030, 'いつまでも聞こえる', '2013-02-18', 103, 'C-2' ],
  [ 1032, '暮らしを豊かにする家具', '2013-04-11', 101, 'C-3' ],
  [ 1033, '犬と過ごす週末', '2013-08-31', 91, 'A-4' ],
  [ 1034, 'お金の溜まる家', '2013-09-10', 182, 'D-1' ],
  [ 1035, '今の職場で満足ですか?', '2014-01-25', 248, 'D-2' ],
  [ 1036, '家庭の節税', '2014-01-28', 80, 'D-3' ],
  [ 1037, '体をつくる生活習慣', '2014-01-31', 274, 'A-4' ],
  [ 1039, '明日の旅', '2014-03-17', 158, 'C-1' ],
  [ 1041, '本当においしいコーヒーを知っていますか', '2014-06-28', 289, 'B-2' ],
  [ 1043, 'モダンハウス殺人事件', '2014-06-28', 107, 'E-3' ],
  [ 1044, '人に好かれる眼鏡選び', '2014-09-22', 175, 'F-4' ],
  [ 1045, 'ペットと過ごす宿', '2014-12-21', 262, 'F-1' ],
  [ 1047, '大きな家の小さな殺人', '2015-02-28', 136, 'F-2' ],
  [ 1049, '山のほとりで', '2015-02-28', 209, 'F-3' ],
  [ 1051, '転職で変える人生', '2015-04-05', 263, 'E-4' ],
  [ 1053, 'よくわかるC言語 第2版', '2015-05-05', 134, 'B-1' ],
  [ 1054, '占い入門', '2015-05-06', 294, 'A-2' ],
  [ 1055, '老いても健康', '2015-06-15', 112, 'A-3' ],
  [ 1056, '1冊まるごと北海道', '2015-06-16', 183, 'B-4' ],
  [ 1057, 'やせるおかず50選', '2015-09-17', 111, 'F-1' ],
  [ 1059, '温泉100選', '2015-09-18', 230, 'C-2' ],
  [ 1061, 'やさしい野菜づくり', '2016-01-25', 95, 'B-3' ],
  [ 1062, '楽しい食事改善', '2016-02-14', 134, 'B-4' ],
  [ 1063, '国内旅行決定版', '2016-04-23', 226, 'B-1' ],
  [ 1065, '情報セキュリティ入門', '2016-07-17', 210, 'C-2' ]
]

function init () {
  let db = new sqlite3.Database(dbfile, (err) => {
    if (err) {
      throw new Error(err)
    }
    db.run('create table users (id integer priomary key, name text, mail text, pass text);', () => {
      const sql = 'INSERT INTO users VALUES(?, ?, ?, ?);'
      let i
      for (i = 0; i < users.length; i++) {
        let user = users[i]
        db.run(sql, user, () => {})
      }
    })
    db.run('create table books (id integer primary key, title text, date text, pages integer, loc text);', () => {
      const sql = 'INSERT INTO books VALUES(?, ?, ?, ?, ?);'
      let i
      for (i = 0; i < books.length; i++) {
        db.run(sql, books[i])
      }
    })
    db.run('create table history (uid integer, bid integer, date1 text, date2 text);', () => {
      console.log('created')
      let d = new Date()
      let i
      const sql = 'INSERT INTO history VALUES(?, ?, ?, ?);'
      for (i = 0; i < 120; i++) {
        let bindex, uindex
        bindex = Math.floor(Math.random() * books.length)
        uindex = Math.floor(Math.random() * users.length)
        let user = users[uindex]
        let book = books[bindex]
        let d1, d2, d3
        d1 = new Date(book[2])
        d2 = 0
        d3 = 0
        while (d1 >= d2 || d2 >= d || d3 >= d) {
          d2 = new Date((new Date('2016/01/01')).getTime() + Math.random() * 1000 * 60 * 60 * 24 * 700)
          d3 = new Date(d2.getTime() + (Math.random() * 1000 * 60 * 60 * 24) * 14)
        }
        d2 = d2.toISOString().replace(/T.*/, '')
        d3 = d3.toISOString().replace(/T.*/, '')
        db.run(sql, [user[0], book[0], d2, d3], (err) => {
          if (err) console.log(err)
        })
      }
    })
  })
}

if (fs.existsSync(dbfile)) {
  fs.unlinkSync(dbfile)
}
init()
