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

app.use(express.static('public'));

const DbAsync = (db, sql) => {
  return new Promise(function(resolve, reject) {
    db.all(sql, function(err, row) {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function startServer() {
  // app.get('/', (req, res) => res.send('Ready'));

  // createDB();
  app.listen(8000, () => console.log('express listening on port 8000...'));
}

startServer();

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

async function onLogin(req, res) {
  const body = req.body;

  try {
    const {
      user: { email: u, password: p }
    } = body;

    let found = false;
    if (u && p) {
      for (user of userList) {
        if (user.email === u && user.password === p) {
          // console.log('matched');
          const token = jwt.sign(
            {
              exp: Math.floor(Date.now() / 1000) + 60 * 60,
              email: u,
              user_type: user.type
            },
            'secret'
          );

          res.json({ Token: token });
          found = true;
          break;
        }
      }
    }

    if (!found) {
      res.json({ status: 'failed', description: 'User/Password not matched' });
    }
  } catch (error) {
    console.log(error);
    res.json({ status: 'failed', description: error });
  }
}
app.post('/oauth/login', jsonParser, onLogin);

async function onComparisonData(req, res) {
  try {
    // const param = req.params;
    const start = moment(req.query.start)
      .toDate()
      .getTime();
    const end = moment(req.query.end)
      .toDate()
      .getTime();

    const db = await new sqlite3.Database('./data/comparisons.db', sqlite3.OPEN_READONLY, err => {
      if (err) {
        console.error(err.message);
      }
      // console.log('Connected to the forecast database.');
    });

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
    console.log('error:' + error);
    res.json({ status: 'failed', description: error });
  }
}
app.get('/forecasts/comparisons', onComparisonData);

async function onDefault(req, res) {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
}
app.get('*', onDefault);
app.get('/', onDefault);
