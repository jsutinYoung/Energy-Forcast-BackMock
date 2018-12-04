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
  return new Promise(function(resolve, reject) {
    db.all(sql, function(err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function verifyToken(req) {
  try {
    const newToken = req.headers.token.replace('Bearer ', '');
    // console.log(newToken);
    const decoded = await jwt.verify(newToken, SECRET);
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
//....................................................................................
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
      'CREATE TABLE IF NOT EXISTS comparisons (hour INTEGER PRIMARY KEY, forecast REAL, baseline REAL, stderr REAL);'
    );

    let m = moment('01-01-2015 00:00:00', 'MM-DD-YYYY hh:mm:s');

    // let counter = 0;
    for (let i = 1; i <= 262; i++) {
      DB.exec('BEGIN');
      for (let hr = 0; hr < 168; hr++) {
        [d, f, b, e] = sampleData[hr];

        const h = m.add(1, 'hour').toDate();
        // const aHour = [h, parseFloat(f), parseFloat(b), parseFloat(e)];

        const variabtion1 = 1 + Math.floor(Math.random() * 11) / 100.0;
        const variabtion2 = 1 + Math.floor(Math.random() * 11) / 100.0;
        const variabtion3 = 1 + Math.floor(Math.random() * 11) / 100.0;

        // hrs.push(aHour);
        const stmt = DB.prepare('INSERT INTO comparisons VALUES (?,?,?,?)');
        stmt.run(
          h.getTime(),
          parseFloat(f) * variabtion1,
          parseFloat(b) * variabtion2,
          parseFloat(e) * variabtion3
        );
        stmt.finalize();

        // console.log(`${counter++}  ${h}`);
      }
      DB.exec('COMMIT');
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
      user: { email: u, password: p }
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
          const token = jwt.sign(
            {
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
  const body = req.body;

  const user = await verifyToken(req);
  if (!user) {
    return;
  }

  try {
    const {
      user: { email: u, password: p, user_type: t }
    } = body;

    if (t === 1) {
      throw 'cannot create admin user';
    }

    //check if one is a mananger
    if (user.user_type >= 2) {
      throw 'no permission';
    }

    const db = await getDB(sqlite3.OPEN_READWRITE);
    // db.exec('BEGIN');
    // const stmt = db.prepare('INSERT INTO users VALUES (?,?,?)');
    // stmt.run(u, p, t);
    // stmt.finalize();
    // db.exec('COMMIT');

    const result = await new Promise(function(resolve, reject) {
      db.run(`INSERT INTO users(email,password,type) VALUES(?,?,?)`, [u, p, t], function(err) {
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
  if (!(await verifyToken(req))) {
    return;
  }

  try {
    // const param = req.params;
    const start = moment(req.query.start)
      .toDate()
      .getTime();
    const end = moment(req.query.end)
      .toDate()
      .getTime();

    const db = await getDB();
    const sql = `SELECT hour, forecast, baseline, stderr
        FROM comparisons WHERE hour
        BETWEEN "${start}" AND "${end}"
        ORDER BY hour DESC`;

    let data = [];
    const rows = await DbAsync(db, sql);

    data = rows.map(row => {
      const td = moment(row.hour).format('YYYY-MM-DDTHH:mm:ss');
      return [td, row.forecast, row.baseline, row.stderr];
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
async function onDefault(req, res) {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
}
app.get('*', onDefault);
app.get('/', onDefault);
