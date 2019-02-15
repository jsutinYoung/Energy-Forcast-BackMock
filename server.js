const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const userList = require('./secrete/users.json');
const jwt = require('jsonwebtoken');
const sampleData = require('./data/week_data.json');
const moment = require('moment');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const jsonParser = bodyParser.json();
const SECRET = 'shhhhh';

app.use(cors());
// app.use(bodyParser);
// app.use(app.router);
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
  app.listen(8000, () => console.log('express listening on port 8000...'));
}

startServer();
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
      description: error.message
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
      user: { email: u, password: p, user_type: t }
    } = body;

    if (t === 1) {
      throw 'cannot create admin user';
    }

    // check if one is a mananger
    // if (t > 2) {
    //   throw 'no permission';
    // }

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
      error.message = 'email already exists';
    }
    // console.log(error);
    res.json({
      status: 'fail',
      description: error.message
    });
  }
}
app.post('/users/create', jsonParser, onRegister);
//....................................................................................
async function onComparisonData(req, res) {
  if (!verifyToken(req, res)) {
    return;
  }

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
      reason: error.message
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
    // const model = req.query.model;

    if (!req.query.forecast_date) {
      res.json({
        status: 'fail',
        reason: 'gen_date missing'
      });
      return;
    }

    const gen_date = local
      ? moment(req.query.forecast_date)
          .toDate()
          .getTime()
      : moment
          .utc(req.query.forecast_date)
          .toDate()
          .getTime();

    let sql;
    if (req.query.start_date && req.query.end_date) {
      const start_date = local
        ? moment(req.query.start_date)
            .toDate()
            .getTime()
        : moment
            .utc(req.query.start_date)
            .toDate()
            .getTime();

      const end_date = local
        ? moment(req.query.end_date)
            .toDate()
            .getTime()
        : moment
            .utc(req.query.end_date)
            .toDate()
            .getTime();

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
      const td = local
        ? moment(row.time)
            .local()
            .format('YYYY-MM-DDTHH:mm:ss')
        : moment(row.time).format('YYYY-MM-DDTHH:mm:ss');

      return [td, row.forecast, row.stderr, row.temperature];
    });
    db.close();
    res.json(data);
  } catch (error) {
    res.json({
      status: 'fail',
      reason: error.message
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
    const start = local
      ? moment(req.query.start_date)
          .toDate()
          .getTime()
      : moment
          .utc(req.query.start_date)
          .toDate()
          .getTime();

    const now = local
      ? moment()
          .startOf('day')
          .utc()
          .toDate()
          .getTime()
      : moment()
          .startOf('day')
          .toDate()
          .getTime();

    if (start >= now) {
      res.json([]);
      return;
    }

    const end = local
      ? moment(req.query.end_date)
          .toDate()
          .getTime()
      : moment
          .utc(req.query.end_date)
          .toDate()
          .getTime();

    sql = `SELECT  time, actual FROM loads
        WHERE time BETWEEN "${start}" AND "${end}"
        ORDER BY time DESC`;

    const db = await getDB();
    let data = [];
    const rows = await DbAsync(db, sql);

    data = rows.map(row => {
      const td = local
        ? moment(row.time)
            .local()
            .format('YYYY-MM-DDTHH:mm:ss')
        : moment(row.time).format('YYYY-MM-DDTHH:mm:ss');

      return [td, row.actual];
    });
    db.close();
    res.json(data);
  } catch (error) {
    res.json({
      status: 'fail',
      reason: error.message
    });
  }
}
app.get('/demand/', onLoadData);
//....................................................................................
async function onUserUpdate(req, res) {
  if (!verifyToken(req, res)) {
    return;
  }

  const body = req.body;
  try {
    const {
      email: u,
      update: { password: p }
    } = body;

    const db = await getDB(sqlite3.OPEN_READWRITE);

    const result = await new Promise(function(resolve, reject) {
      db.run(`UPDATE users SET password=? WHERE email=?`, [p, u], function(err) {
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
      error.message = 'email already exists';
    }
    // console.log(error);
    res.json({
      status: 'fail',
      description: error.message
    });
  }
}
app.put('/users/update', jsonParser, onUserUpdate);
//....................................................................................
async function onDeleteUser(req, res) {
  // if (!verifyToken(req, res)) {
  //   return;
  // }

  try {

    const id = req.param("id");
    if (!id) {
      throw { message: "No user specified" };
    }

    const db = await getDB(sqlite3.OPEN_READWRITE);

    const result = await new Promise(function(resolve, reject) {
      db.run(`DELETE FROM users WHERE email=? AND type<>1`, [id], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });

    db.close();
    if (!result) {
      throw { message: "user not found" };
    }

    res.json({
      status: 'ok',
      description: ''
    });
  } catch (error) {
    res.json({
      status: 'fail',
      description: error.message
    });
  }
}

app.delete('/users/delete/:id', jsonParser, onDeleteUser);

//....................................................................................
async function onDefault(req, res) {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
}
app.get('*', onDefault);
app.get('/', onDefault);
