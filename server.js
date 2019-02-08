const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const userList = require('./secrete/users.json');
const jwt = require('jsonwebtoken');
const sampleData = require('./data/week_data.json');
const moment = require('moment');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const jsonParser = bodyParser.json();
const SECRET = 'shhhhh';

app.use(express.static('public'));
//....................................................................................
const DbAsync = (db, sql) => {
  return new Promise(function (resolve, reject) {
    db.all(sql, function (err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

function verifyToken(req, res) {
  try {
    const newToken = req.headers.token.replace('Bearer ', '');
    // console.log(newToken);
    const decoded = jwt.verify(newToken, SECRET);
    // console.log(decoded);
    return decoded;
  } catch (err) {
    // console.log(err);
    res.json({
      status: 'fail',
      reason: 'invalid token'
    });
    return null;
  }
}

async function getDB(mode) {
  const m = mode ? mode : sqlite3.OPEN_READONLY;

  return await new sqlite3.Database('./data/comparisons.db', m, err => {
    if (err) {
      console.error(err.message);
    }
  });
}
//....................................................................................
async function startServer() {
  // createDB();
  app.listen(8000, () => console.log('express listening on port 8000...'));
}

startServer();

function randomIntFromInterval(min, max) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}
//....................................................................................
function mockData(m) {
  const variabtion1 = 1 + Math.floor(Math.random() * 11) / 100.0;
  const variabtion2 = 1 + Math.floor(Math.random() * 11) / 100.0;
  const variabtion3 = 1 + Math.floor(Math.random() * 11) / 100.0;

  let temp;
  const month = m.month();
  if (month >= 0 && month <= 2) {
    temp = randomIntFromInterval(28, 45);
  } else if (month >= 3 && month <= 5) {
    temp = randomIntFromInterval(34, 52);
  } else if (month >= 6 && month <= 8) {
    temp = randomIntFromInterval(40, 105);
  } else {
    temp = randomIntFromInterval(38, 50);
  }

  return [variabtion1, variabtion2, variabtion3, temp];
}

function addUser(DB) {
  DB.exec('BEGIN');
  const stmt2 = DB.prepare('INSERT INTO users VALUES (?,?,?)');
  stmt2.run('j@j.com', '111111', 2);
  DB.exec('COMMIT');
}
async function createDB() {
  // console.log(moment('12-31-2017', 'MMDDYYYY').isoWeek());
  let DB = new sqlite3.Database(
    './data/comparisons.db',
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    err => {
      if (err) {
        console.error(err.message);
      }
      // console.log('Connected to the forecast database.');
    }
  );

  DB.serialize(() => {
    DB.run(
      'CREATE TABLE IF NOT EXISTS comparisons (hour INTEGER PRIMARY KEY, forecast REAL, baseline REAL, stderr REAL, temperature REAL);'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `users` ( `email` TEXT NOT NULL, `password` TEXT NOT NULL, `type` INTEGER NOT NULL, PRIMARY KEY(`email`) )'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `forecasts` (`time`	INTEGER NOT NULL UNIQUE,PRIMARY KEY(`time`))'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `loads` ( `time` INTEGER, `actual` REAL, PRIMARY KEY(`time`))'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `sevendays` ( `time` INTEGER, `forecast` REAL, `stderr` REAL, `temperature` REAL, `gen_time` INTEGER NOT NULL, FOREIGN KEY(`gen_time`) REFERENCES `forecasts`(`time`))'
    );

    DB.run(
      'CREATE TABLE IF NOT EXISTS `sevendays` ( `time` INTEGER, `forecast` REAL, `stderr` REAL, `temperature` REAL, `gen_time` INTEGER NOT NULL, FOREIGN KEY(`gen_time`) REFERENCES `forecasts`(`time`))'
    );

    DB.run('CREATE INDEX `idx1` ON `sevendays` ( `gen_time`	ASC)');

    addUser(DB);

    //generate on local time bondary
    // let gen_date = moment.utc('01-01-2017 00:00:00', 'MM-DD-YYYY hh:mm:s');
    let gen_date = moment('01-01-2017 00:00:00', 'MM-DD-YYYY hh:mm:s').utc();

    for (let day = 1; day <= 1095; day++) {
      // console.log(`${day}`);
      // console.log(gen_date.local().format('YYYY-MM-DDTHH:mm:ss'))
      // console.log(gen_date.toDate().getTime());

      DB.exec('BEGIN');

      //execute this every day
      let gen_time = gen_date.toDate().getTime();
      let stmt1 = DB.prepare('INSERT INTO forecasts VALUES(?)');
      stmt1.run(gen_time);
      stmt1.finalize();

      //produce 7 days forcast worth data
      let gen_moment = gen_date.clone();
      for (let hr = 0; hr < 168; hr++) {
        [d, f, b, e] = sampleData[hr];
        const h = gen_moment.toDate();

        [variabtion1, variabtion2, variabtion3, temp] = mockData(gen_moment);

        const stmt2 = DB.prepare('INSERT INTO sevendays VALUES (?,?,?,?,?)');
        stmt2.run(
          h.getTime(),
          parseFloat(f) * variabtion1,
          parseFloat(e) * variabtion3,
          temp,
          //foreign key
          gen_time
        );

        gen_moment.add(1, 'hour');
        stmt2.finalize();
        // console.log(`${counter++}  ${h}`);
      }

      // simulate 24 hr values
      let m = gen_date.clone();
      for (let hr = 0; hr < 24; hr++) {
        [d, f, b, e] = sampleData[hr];
        const h = m.toDate();

        //loads table
        [variabtion1, variabtion2, variabtion3, temp] = mockData(m);
        let stmt3 = DB.prepare('INSERT INTO loads VALUES(?,?)');
        stmt3.run(h.getTime(), parseFloat(b) * variabtion2);
        stmt3.finalize();

        //old comparisons table
        const stmt4 = DB.prepare('INSERT INTO comparisons VALUES (?,?,?,?,?)');
        stmt4.run(
          h.getTime(),
          parseFloat(f) * variabtion1,
          parseFloat(b) * variabtion2,
          parseFloat(e) * variabtion3,
          temp
        );

        m.add(1, 'hour');
        stmt4.finalize();
      }

      DB.exec('COMMIT');
      gen_date.add(1, 'day');
    }
  });

  DB.close(err => {
    if (err) {
      console.error(err.message);
    }
    // console.log('Close the database connection.');
  });
}
//....................................................................................
async function onLogin(req, res) {
  const body = req.body;

  try {
    const {
      user: {
        email: u,
        password: p
      }
    } = body;

    let found = false;
    if (u && p) {
      const db = await getDB();
      const sql = `SELECT email, password ,type
          FROM users
          WHERE email = "${u}"`;

      const rows = await DbAsync(db, sql);
      db.close();

      if (rows && rows.length > 0) {
        const record = rows[0];
        if (p === record.password) {
          const token = jwt.sign({
              exp: Math.floor(Date.now() / 1000) + 60 * 60,
              email: u,
              user_type: record.type
            },
            SECRET
          );

          res.json({
            Token: token
          });
          found = true;
        }
      }
    }

    if (!found) {
      res.json({
        status: 'fail',
        description: 'User/Password not matched'
      });
    }
  } catch (error) {
    res.json({
      status: 'fail',
      description: error
    });
  }
}
app.post('/oauth/login', jsonParser, onLogin);
//....................................................................................
async function onRegister(req, res) {
  if (!verifyToken(req, res)) {
    return;
  }

  const body = req.body;
  try {
    const {
      user: {
        email: u,
        password: p,
        user_type: t
      }
    } = body;

    if (t === 1) {
      throw 'cannot create admin user';
    }

    // check if one is a mananger
    if (user.user_type > 2) {
      throw 'no permission';
    }

    const db = await getDB(sqlite3.OPEN_READWRITE);
    // db.exec('BEGIN');
    // const stmt = db.prepare('INSERT INTO users VALUES (?,?,?)');
    // stmt.run(u, p, t);
    // stmt.finalize();
    // db.exec('COMMIT');

    const result = await new Promise(function (resolve, reject) {
      db.run(`INSERT INTO users(email,password,type) VALUES(?,?,?)`, [u, p, t], function (err) {
        if (err) reject(err);
        else resolve();
      });
    });

    db.close();

    res.json({
      status: 'ok',
      description: ''
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      error = 'email already exists';
    }
    // console.log(error);
    res.json({
      status: 'fail',
      description: error
    });
  }
}
app.post('/users/create', jsonParser, onRegister);
//....................................................................................
async function onComparisonData(req, res) {
  // if (!verifyToken(req, res)) {
  //   return;
  // }

  try {
    // const param = req.params;
    const start = moment(req.query.start)
      .utc()
      .toDate()
      .getTime();
    const end = moment(req.query.end)
      .utc()
      .toDate()
      .getTime();

    const db = await getDB();
    const sql = `SELECT hour, forecast, baseline, stderr, temperature
        FROM comparisons WHERE hour
        BETWEEN "${start}" AND "${end}"
        ORDER BY hour DESC`;

    let data = [];
    const rows = await DbAsync(db, sql);

    data = rows.map(row => {
      const td = moment(row.hour).format('YYYY-MM-DDTHH:mm:ss');
      return [td, row.forecast, row.baseline, row.stderr, row.temperature];
    });
    // console.log(data);
    db.close();
    res.json(data);
  } catch (error) {
    // console.log('error:' + error);
    res.json({
      status: 'fail',
      reason: error
    });
  }
}
app.get('/forecasts/comparisons', onComparisonData);
//....................................................................................
async function onForecastData(req, res) {
  const local = req.query.local;
  if (!local) {
    if (!verifyToken(req, res)) {
      return;
    }
  }

  try {
    const model = req.query.model;

    if (!req.query.forecast_date) {
      res.json({
        status: 'fail',
        reason: 'gen_date missing'
      });
      return;
    }

    // const g = moment(req.query.gen_date).utc();
    // console.log(g.local().format('YYYY-MM-DDTHH:mm:ss'))
    // console.log(g.toDate().getTime());

    const gen_date = local ?
      moment(req.query.forecast_date)
      .toDate()
      .getTime() :
      moment.utc(req.query.forecast_date)
      .toDate()
      .getTime();

    let sql;
    if (req.query.start_date && req.query.end_date) {
      const start_date = local ?
        moment(req.query.start_date)
        .toDate()
        .getTime() :
        moment.utc(req.query.start_date)
        .toDate()
        .getTime()


      const end_date = local ?
        moment(req.query.end_date)
        .toDate()
        .getTime() :
        moment.utc(req.query.end_date)
        .toDate()
        .getTime()


      sql = `SELECT  s.time, s.forecast, s.stderr,  s.temperature FROM forecasts f , sevendays s
        WHERE f.time = s.gen_time AND
        f.time = "${gen_date}" AND
        s.time BETWEEN "${start_date}" AND "${end_date}"
        ORDER BY s.time DESC`;
    } else {
      sql = `SELECT  s.time, s.forecast, s.stderr,  s.temperature FROM forecasts f , sevendays s
        WHERE f.time = s.gen_time AND
        f.time = "${gen_date}"
        ORDER BY s.time DESC`;
    }

    const db = await getDB();
    let data = [];
    const rows = await DbAsync(db, sql);

    data = rows.map(row => {
      const td = local ?
        moment(row.time).local().format('YYYY-MM-DDTHH:mm:ss') :
        moment(row.time).format('YYYY-MM-DDTHH:mm:ss');

      return [td, row.forecast, row.stderr, row.temperature];
    });
    // console.log(data);
    db.close();
    res.json(data);
  } catch (error) {
    // console.log('error:' + error);
    res.json({
      status: 'fail',
      reason: error
    });
  }
}
app.get('/demand/forecast/', onForecastData);

//....................................................................................
async function onLoadData(req, res) {
  const local = req.query.local;
  if (!local) {
    if (!verifyToken(req, res)) {
      return;
    }
  }

  try {
    // const model = req.query.model;
    let sql;
    if (!(req.query.start_date && req.query.end_date)) {
      res.json({
        status: 'fail',
        reason: 'need start + end'
      });
    }
    const start = local ?
      moment(req.query.start_date)
      .toDate()
      .getTime() :
      moment.utc(req.query.start_date)
      .toDate()
      .getTime();

    const now = local ? moment().startOf('day').utc().toDate().getTime() :
      moment().startOf('day').toDate().getTime()

    if (start >= now) {
      res.json([]);
      return
    }


    const end = local ?
      moment(req.query.end_date)
      .toDate()
      .getTime() :
      moment.utc(req.query.end_date)
      .toDate()
      .getTime();

    sql = `SELECT  time, actual FROM loads
        WHERE time BETWEEN "${start}" AND "${end}"
        ORDER BY time DESC`;

    const db = await getDB();
    let data = [];
    const rows = await DbAsync(db, sql);

    data = rows.map(row => {
      const td = local ?
        moment(row.time).local().format('YYYY-MM-DDTHH:mm:ss') :
        moment(row.time).format('YYYY-MM-DDTHH:mm:ss');

      return [td, row.actual];
    });
    // console.log(data);
    db.close();
    res.json(data);
  } catch (error) {
    // console.log('error:' + error);
    res.json({
      status: 'fail',
      reason: error
    });
  }
}
app.get('/demand/', onLoadData);

//....................................................................................
async function onDefault(req, res) {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
}
app.get('*', onDefault);
app.get('/', onDefault);